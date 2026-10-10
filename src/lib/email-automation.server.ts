import { createPublicServerClient, type PublicServerClient } from "./supabase-public.server";
import { getSessionCalendar, ROOM_URL } from "./calendar";
import {
  TEMPLATE_MAP,
  applyOverride,
  renderEmail,
  type EmailLinks,
  type TemplateOverrides,
} from "./email-templates";


/**
 * Server-only engine for the whole email sequence.
 * Schedules the rows, sends the due ones through Resend, records the result.
 * Everything goes through password gated SECURITY DEFINER functions because
 * the host only has the publishable key.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function adminPassword(override?: string | undefined): string {
  const password = override || process.env["ADMIN_PASSWORD"];
  if (!password) throw new Error("ADMIN_PASSWORD is not configured on the server.");
  return password;
}

export type EmailSettings = EmailLinks & { nurture_enabled: boolean };

export async function loadSettings(
  db: PublicServerClient,
  password?: string | undefined,
): Promise<EmailSettings> {
  const { data, error } = await db.rpc("admin_get_email_settings", {
    p_password: adminPassword(password),
  });
  if (error) throw error;
  const row = (data ?? {}) as Partial<EmailSettings>;
  const rawJoining = (row.joining_link || "").trim();
  // Ensure the link never goes to webinar.gg; default to onepageplan.in/room
  const joining =
    !rawJoining || rawJoining.includes("webinar.gg") ? ROOM_URL : rawJoining;
  return {
    joining_link: joining,
    calendar_link: row.calendar_link || "",
    registration_link: row.registration_link || "https://onepageplan.in",
    whatsapp_link: row.whatsapp_link || "",
    monthly_checkout_link: row.monthly_checkout_link || "",
    annual_checkout_link: row.annual_checkout_link || "",
    nurture_enabled: row.nurture_enabled !== false,
  };
}

/** Fills in the calendar link automatically when it has not been overridden. */
export function resolveLinks(
  settings: EmailSettings,
  sessionDate?: string | null,
  email?: string | null,
): EmailLinks {
  const rawJoining = (settings.joining_link || "").trim();
  // Ensure the link never goes to webinar.gg; default to onepageplan.in/room
  const baseJoining =
    !rawJoining || rawJoining.includes("webinar.gg") ? ROOM_URL : rawJoining;
  const joining = email
    ? `${baseJoining}${baseJoining.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`
    : baseJoining;
  const calendar =
    settings.calendar_link ||
    getSessionCalendar(baseJoining, sessionStart(sessionDate) ?? undefined).googleUrl;
  return { ...settings, joining_link: joining, calendar_link: calendar };
}

/** The admin's edited copy for any template, keyed by template key. */
export async function loadOverrides(
  db: PublicServerClient,
  password?: string | undefined,
): Promise<TemplateOverrides> {
  const { data, error } = await db.rpc("admin_get_templates", {
    p_password: adminPassword(password),
  });
  if (error) throw error;
  return (data ?? {}) as unknown as TemplateOverrides;
}


/** 19:00 IST on the given yyyy-mm-dd, as a UTC instant. */
export function sessionStart(sessionDate?: string | null): Date | null {
  if (!sessionDate) return null;
  const parts = sessionDate.split("-").map((value) => Number(value));
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 13, 30, 0, 0));
}

type LeadRow = {
  id: string;
  email: string;
  full_name: string;
  phone_e164?: string | null;
  whatsapp_consent?: boolean | null;
  status: string;
  session_date: string | null;
  tags: string[] | null;
  tag_dates: Record<string, string> | null;
};

const EMAIL_TO_WHATSAPP_KEY: Record<string, string> = {
  confirmation: "confirmation",
  reminder_24h: "reminder-2h",
  reminder_1h: "reminder-15m",
  live_now: "live",
  missed_session: "no-show",
};

type QueueRow = {
  registration_id: string;
  email: string;
  template: string;
  session_date: string | null;
  scheduled_at: string;
  idempotency_key: string;
};

/** Everything the sequence should contain for one lead, as absolute times. */
export function plannedRows(lead: LeadRow, nurtureEnabled: boolean): QueueRow[] {
  const rows: QueueRow[] = [];
  const tags = (lead.tags ?? []).map((tag) => tag.toLowerCase());
  const purchased = tags.includes("purchased");
  const start = sessionStart(lead.session_date);

  const push = (template: string, at: Date) => {
    rows.push({
      registration_id: lead.id,
      email: lead.email,
      template,
      session_date: lead.session_date ?? null,
      scheduled_at: at.toISOString(),
      idempotency_key: `${lead.id}:${template}:${lead.session_date ?? "na"}`,
    });
  };

  if (start) {
    push("reminder_24h", new Date(start.getTime() - 24 * HOUR));
    push("reminder_1h", new Date(start.getTime() - HOUR));
    push("live_now", start);
    push("late_entry", new Date(start.getTime() + 20 * 60 * 1000));

    // Sunday 09:00 IST is fourteen hours after a 19:00 IST start.
    const morningAfter = new Date(start.getTime() + 14 * HOUR);
    const attended = lead.status === "attended" || lead.status === "dropped_off";
    push(attended ? "post_session" : "missed_session", morningAfter);

    if (nurtureEnabled && !purchased) {
      for (let day = 1; day <= 11; day += 1) {
        push(`nurture_${day}`, new Date(morningAfter.getTime() + day * 24 * HOUR));
      }
    }
  }

  if (purchased) {
    const tagged = lead.tag_dates?.["purchased"];
    const base = tagged ? new Date(tagged) : new Date();
    for (let step = 1; step <= 5; step += 1) {
      rows.push({
        registration_id: lead.id,
        email: lead.email,
        template: `post_purchase_${step}`,
        session_date: lead.session_date ?? null,
        scheduled_at: new Date(base.getTime() + (step - 1) * 7 * 24 * HOUR).toISOString(),
        idempotency_key: `${lead.id}:post_purchase_${step}`,
      });
    }
  }

  return rows;
}

/** Queues every missing row for recent leads. Old slots are never back-filled. */
export async function scheduleSequence(db: PublicServerClient, override?: string | undefined) {
  const password = adminPassword(override);
  const settings = await loadSettings(db, password);
  const from = new Date(Date.now() - 45 * 24 * HOUR).toISOString();

  const { data, error } = await db.rpc("admin_leads", { p_password: password, p_from: from });
  if (error) throw error;

  const leads = (data ?? []) as unknown as LeadRow[];
  const graceFloor = Date.now() - 6 * HOUR;
  const rows: QueueRow[] = [];
  for (const lead of leads) {
    for (const row of plannedRows(lead, settings.nurture_enabled)) {
      if (new Date(row.scheduled_at).getTime() >= graceFloor) rows.push(row);
    }
  }

  if (rows.length === 0) return 0;
  const { data: inserted, error: queueError } = await db.rpc("queue_emails", {
    p_password: password,
    p_rows: JSON.parse(JSON.stringify(rows)) as never,
  });
  if (queueError) throw queueError;
  return Number(inserted ?? 0);
}

/**
 * Dispatches due WhatsApp webinar reminders (2h, 15m, live_now, missed) for consented leads.
 * Deduplicated automatically in whatsapp_sends by (registration_id, message_key, occurrence).
 */
export async function dispatchDueWebinarWhatsAppReminders(
  db: PublicServerClient,
  override?: string | undefined,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (process.env["WHATSAPP_ENABLED"] === "false") {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const password = adminPassword(override);
    const settings = await loadSettings(db, password);
    const from = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
    const { data, error } = await db.rpc("admin_leads", { p_password: password, p_from: from });
    if (error || !data) return { sent: 0, failed: 0, skipped: 0 };

    const { sendWhatsAppAutomation } = await import("@/services/whatsapp/whatsapp-nurture.server");
    const leads = (data ?? []) as unknown as LeadRow[];
    const nowMs = Date.now();

    for (const lead of leads) {
      if (lead.whatsapp_consent === false || !lead.phone_e164 || !lead.session_date) continue;
      const start = sessionStart(lead.session_date);
      if (!start) continue;

      const startMs = start.getTime();
      const morningAfterMs = startMs + 14 * HOUR;
      const links = resolveLinks(settings, lead.session_date, lead.email);
      const roomUrl = links.joining_link || ROOM_URL;
      const occurrence = lead.session_date;

      const dueKeys: Array<{ key: string; url: string }> = [];

      // 1. 2-Hour Reminder (strict window around 5:00 PM IST: 4:55 PM to 5:20 PM IST)
      if (nowMs >= startMs - 2 * HOUR - 5 * 60 * 1000 && nowMs <= startMs - 2 * HOUR + 20 * 60 * 1000) {
        dueKeys.push({ key: "reminder-2h", url: roomUrl });
      }
      // 2. 15-Minute Reminder (strict window around 6:45 PM IST: 6:40 PM to 6:58 PM IST)
      if (nowMs >= startMs - 20 * 60 * 1000 && nowMs < startMs - 2 * 60 * 1000) {
        dueKeys.push({ key: "reminder-15m", url: roomUrl });
      }
      // 3. Live Now Alert (strict window around 7:00 PM IST: 6:58 PM to 7:12 PM IST — never late)
      if (nowMs >= startMs - 2 * 60 * 1000 && nowMs <= startMs + 12 * 60 * 1000) {
        dueKeys.push({ key: "live", url: roomUrl });
      }
      // 4. Missed Session Follow-up (Sunday 9:00 AM to 9:30 AM IST for non-attendees)
      const attended = lead.status === "attended" || lead.status === "dropped_off";
      if (!attended && nowMs >= morningAfterMs && nowMs <= morningAfterMs + 30 * 60 * 1000) {
        dueKeys.push({
          key: "no-show",
          url: `https://onepageplan.in/checkout/money-reality-check?email=${encodeURIComponent(lead.email)}`,
        });
      }

      for (const item of dueKeys) {
        const res = await sendWhatsAppAutomation(
          db,
          {
            id: lead.id,
            phone_e164: lead.phone_e164,
            full_name: lead.full_name,
            status: lead.status,
            whatsapp_consent: lead.whatsapp_consent ?? true,
          },
          item.key,
          occurrence,
          item.url,
        );
        if (res === "sent") sent += 1;
        else if (res === "failed") failed += 1;
        else skipped += 1;
      }
    }
  } catch (err) {
    console.warn("[WhatsApp Reminders] dispatchDueWebinarWhatsAppReminders warning:", err);
  }

  return { sent, failed, skipped };
}

async function sendEmailUsingProvider(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string | null> {
  const resendKey = process.env["RESEND_API_KEY"];
  if (resendKey) {
    const fromEmail = process.env["FROM_EMAIL"] || "connect@onepageplan.in";
    const fromName = process.env["FROM_NAME"] || "Milan Dodhia";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    if (!response.ok) {
      throw new Error(`Resend responded ${response.status}: ${JSON.stringify(payload)?.slice(0, 200)}`);
    }
    return payload?.id ?? null;
  }

  throw new Error("RESEND_API_KEY is not configured on the server. Resend is the active email provider.");
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "there";
}

/** Sends up to `limit` due emails. Safe to call repeatedly. */
export async function sendDueEmails(
  db: PublicServerClient,
  limit = 25,
  override?: string | undefined,
) {
  const password = adminPassword(override);
  const settings = await loadSettings(db, password);
  const overrides = await loadOverrides(db, password);


  const { data, error } = await db.rpc("claim_due_emails", {
    p_password: password,
    p_limit: limit,
  });
  if (error) throw error;

  const due = (data ?? []) as unknown as {
    id: string;
    email: string;
    template: string;
    session_date: string | null;
    full_name: string;
  }[];

  // Build email -> lead lookup so companion WhatsApp reminders can be triggered alongside emails
  const leadByEmail = new Map<string, LeadRow>();
  if (due.some((r) => Boolean(EMAIL_TO_WHATSAPP_KEY[r.template]))) {
    try {
      const from = new Date(Date.now() - 45 * 24 * HOUR).toISOString();
      const { data: leadsData } = await db.rpc("admin_leads", { p_password: password, p_from: from });
      for (const l of ((leadsData ?? []) as unknown as LeadRow[])) {
        if (l.email) leadByEmail.set(l.email.trim().toLowerCase(), l);
      }
    } catch {
      /* non-fatal */
    }
  }

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const base = TEMPLATE_MAP[row.template];
    if (!base) {
      await db.rpc("mark_email_send", {
        p_password: password,
        p_id: row.id,
        p_status: "failed",
        p_error: `Unknown template ${row.template}`,
      });
      failed += 1;
      continue;
    }
    const spec = applyOverride(base, overrides[row.template]);
    const resolvedLinks = resolveLinks(settings, row.session_date, row.email);
    try {
      const { subject, html, text } = renderEmail(spec, {
        firstName: firstName(row.full_name),
        links: resolvedLinks,
      });

      const providerId = await sendEmailUsingProvider({ to: row.email, subject, html, text });
      await db.rpc("mark_email_send", {
        p_password: password,
        p_id: row.id,
        p_status: "sent",
        ...(providerId ? { p_provider_id: providerId } : {}),
      });
      sent += 1;
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      console.error("email send failed", row.template, message);
      await db.rpc("mark_email_send", {
        p_password: password,
        p_id: row.id,
        p_status: "failed",
        p_error: message.slice(0, 400),
      });
      failed += 1;
    }

    // Companion WhatsApp dispatch for webinar lifecycle/reminder templates
    const waKey = EMAIL_TO_WHATSAPP_KEY[row.template];
    const matchedLead = leadByEmail.get(row.email.trim().toLowerCase());
    if (
      waKey &&
      matchedLead &&
      matchedLead.whatsapp_consent !== false &&
      matchedLead.phone_e164 &&
      process.env["WHATSAPP_ENABLED"] !== "false"
    ) {
      const sDate = row.session_date || matchedLead.session_date;
      const start = sessionStart(sDate);
      const nowMs = Date.now();
      let withinWindow = true;
      if (start) {
        const startMs = start.getTime();
        if (waKey === "reminder-2h") {
          // Never send a 2-hour countdown reminder less than 45 minutes before or after 7:00 PM start
          withinWindow = nowMs <= startMs - 45 * 60 * 1000;
        } else if (waKey === "reminder-15m") {
          // Never send a 15-minute countdown reminder after the 7:00 PM webinar has already started
          withinWindow = nowMs < startMs;
        } else if (waKey === "live") {
          // Only send 'live now' within 15 minutes of the 7:00 PM start — never late into or after the session
          withinWindow = nowMs >= startMs - 5 * 60 * 1000 && nowMs <= startMs + 15 * 60 * 1000;
        }
      }

      if (withinWindow) {
        try {
          const { sendWhatsAppAutomation } = await import("@/services/whatsapp/whatsapp-nurture.server");
          const targetUrl =
            waKey === "no-show"
              ? `https://onepageplan.in/checkout/money-reality-check?email=${encodeURIComponent(row.email)}`
              : resolvedLinks.joining_link || ROOM_URL;
          await sendWhatsAppAutomation(
            db,
            {
              id: matchedLead.id,
              phone_e164: matchedLead.phone_e164,
              full_name: matchedLead.full_name || row.full_name,
              status: matchedLead.status,
              whatsapp_consent: matchedLead.whatsapp_consent ?? true,
            },
            waKey,
            sDate || "once",
            targetUrl,
          );
        } catch (waErr) {
          console.warn("companion whatsapp send failed:", waKey, waErr);
        }
      }
    }
  }

  return { claimed: due.length, sent, failed };
}

export async function runDispatch(limit = 25, password?: string | undefined) {
  const db = createPublicServerClient();
  const queued = await scheduleSequence(db, password);
  const result = await sendDueEmails(db, limit, password);
  const whatsapp = await dispatchDueWebinarWhatsAppReminders(db, password);
  return { queued, ...result, whatsapp };
}

export function istLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}
