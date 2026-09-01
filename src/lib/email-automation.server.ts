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
  return {
    joining_link: row.joining_link || "",
    calendar_link: row.calendar_link || "",
    registration_link: row.registration_link || "",
    whatsapp_link: row.whatsapp_link || "",
    monthly_checkout_link: row.monthly_checkout_link || "",
    annual_checkout_link: row.annual_checkout_link || "",
    nurture_enabled: row.nurture_enabled !== false,
  };
}

/** Fills in the calendar link automatically when it has not been overridden. */
export function resolveLinks(settings: EmailSettings, sessionDate?: string | null): EmailLinks {
  const joining = settings.joining_link || ROOM_URL;
  const calendar =
    settings.calendar_link ||
    getSessionCalendar(joining, sessionStart(sessionDate) ?? undefined).googleUrl;
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
  status: string;
  session_date: string | null;
  tags: string[] | null;
  tag_dates: Record<string, string> | null;
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

async function sendThroughResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string | null> {
  const key = process.env["RESEND_API_KEY"];
  const fromEmail = process.env["FROM_EMAIL"] || "connect@onepageplan.in";
  const fromName = process.env["FROM_NAME"] || "Milan Dodhia";
  if (!key) throw new Error("RESEND_API_KEY is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
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
    try {
      const { subject, html, text } = renderEmail(spec, {
        firstName: firstName(row.full_name),
        links: resolveLinks(settings, row.session_date),
      });

      const providerId = await sendThroughResend({ to: row.email, subject, html, text });
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
  }

  return { claimed: due.length, sent, failed };
}

export async function runDispatch(limit = 25, password?: string | undefined) {
  const db = createPublicServerClient();
  const queued = await scheduleSequence(db, password);
  const result = await sendDueEmails(db, limit, password);
  return { queued, ...result };
}

export function istLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}
