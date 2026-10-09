import { createServerFn } from "@tanstack/react-start";

/**
 * Every admin dashboard call. The admin password travels with each request and
 * is re-checked inside the database on every single call.
 */

export type AdminLead = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone_e164: string;
  whatsapp_consent: boolean;
  voice_consent: boolean;
  profile_type: string | null;
  pain_point: string | null;
  question?: string | null;
  status: string;
  session_date: string | null;
  utm_source: string | null;
  landing_path: string | null;
  email_sent_at: string | null;
  tags: string[];
  tag_dates: Record<string, string>;
  emails_sent: number;
  emails_opened: number;
  emails_failed: number;
};

export type AdminSend = {
  id: string;
  registration_id: string | null;
  email: string;
  template: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  opened_at: string | null;
  error: string | null;
};

export type AdminSettings = {
  joining_link: string;
  calendar_link: string;
  registration_link: string;
  whatsapp_link: string;
  monthly_checkout_link: string;
  annual_checkout_link: string;
  nurture_enabled: boolean;
};

type Range = { from?: string | null | undefined; to?: string | null | undefined };

function unauthorized(message: string | undefined) {
  return (message ?? "").includes("unauthorized");
}

async function syncAdminPasswordIfMatched(enteredPassword: string) {
  const envPassword = process.env["ADMIN_PASSWORD"];
  if (envPassword && enteredPassword === envPassword) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("app_config")
        .upsert({ key: "admin_password", value: envPassword }, { onConflict: "key" });
    } catch (err) {
      console.warn("[Admin] Auto-sync admin password failed:", err);
    }
  }
}

export const adminDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string } & Range) => data)
  .handler(async ({ data }) => {
    await syncAdminPasswordIfMatched(data.password);
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();
    const range = {
      ...(data.from ? { p_from: data.from } : {}),
      ...(data.to ? { p_to: data.to } : {}),
    };

    try {
      const [leads, settings, stats, sends, templates] = await Promise.all([
        db.rpc("admin_leads", { p_password: data.password, ...range }),
        db.rpc("admin_get_email_settings", { p_password: data.password }),
        db.rpc("admin_email_stats", { p_password: data.password, ...range }),
        db.rpc("admin_email_sends", { p_password: data.password, ...range, p_limit: 400 }),
        db.rpc("admin_get_templates", { p_password: data.password }),
      ]);

      const failure = [leads, settings, stats, sends, templates].find((result) => result.error);
      if (failure?.error) {
        if (unauthorized(failure.error.message)) {
          return { ok: false as const, error: "Wrong password." };
        }
        console.error("adminDashboard failed:", failure.error.message);
        return { ok: false as const, error: "Could not load the dashboard." };
      }

      const leadsList = (leads.data ?? []) as unknown as AdminLead[];
      const existingEmails = new Set(leadsList.map((l) => (l.email ?? "").toLowerCase()));

      let extraNewsletterLeads: AdminLead[] = [];
      try {
        const { data: subscribers } = await db.from("newsletter_subscribers").select("*");
        if (subscribers && Array.isArray(subscribers)) {
          extraNewsletterLeads = subscribers
            .filter((sub: { email?: string }) => sub.email && !existingEmails.has(sub.email.toLowerCase()))
            .map((sub: { id: string; created_at: string; email: string; source?: string; full_name?: string; name?: string }) => ({
              id: sub.id,
              created_at: sub.created_at,
              full_name: sub.full_name || sub.name || "Subscriber",
              email: sub.email,
              phone_e164: "",
              whatsapp_consent: false,
              voice_consent: false,
              profile_type: "Newsletter (Declined Modal)",
              pain_point: "I want someone to tell me which stock or fund to buy",
              status: "subscribed",
              session_date: sub.created_at ? sub.created_at.slice(0, 10) : null,
              utm_source: sub.source || "declined_modal",
              landing_path: null,
              email_sent_at: null,
              tags: ["newsletter"],
              tag_dates: {},
              emails_sent: 0,
              emails_opened: 0,
              emails_failed: 0,
            }));
        }
      } catch {
        /* optional fallback */
      }

      let questionsMap = new Map<string, string>();
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const client = supabaseAdmin || db;
        const { data: qRows } = await client
          .from("prework_questions")
          .select("question, email, registration_id")
          .order("created_at", { ascending: false });
        if (qRows && Array.isArray(qRows)) {
          for (const q of qRows) {
            if (q.registration_id && !questionsMap.has(q.registration_id)) {
              questionsMap.set(q.registration_id, q.question);
            }
            if (q.email && !questionsMap.has(q.email.toLowerCase())) {
              questionsMap.set(q.email.toLowerCase(), q.question);
            }
          }
        }
      } catch {
        /* prework_questions query error ignored */
      }

      const mergedLeads = [...leadsList, ...extraNewsletterLeads]
        .map((lead) => ({
          ...lead,
          question:
            questionsMap.get(lead.id) ||
            (lead.email ? questionsMap.get(lead.email.toLowerCase()) : null) ||
            null,
        }))
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      return {
        ok: true as const,
        leads: mergedLeads,
        settings: (settings.data ?? {}) as unknown as AdminSettings,
        stats: (stats.data ?? {}) as unknown as Record<string, number | Record<string, number>>,
        sends: (sends.data ?? []) as unknown as AdminSend[],
        templates: (templates.data ?? {}) as unknown as Record<
          string,
          { subject?: string | null; heading?: string | null; body?: string | null }
        >,
      };
    } catch (error) {
      console.error("adminDashboard failed:", error);
      return { ok: false as const, error: "Could not load the dashboard." };
    }
  });

/** Saves edited copy for one email. Blank fields fall back to the default copy. */
export const adminSaveTemplate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      key: string;
      subject: string;
      heading: string;
      body: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { TEMPLATE_MAP } = await import("./email-templates");
    if (!TEMPLATE_MAP[data.key]) return { ok: false as const, error: "Unknown email." };
    const { error } = await createPublicServerClient().rpc("admin_save_template", {
      p_password: data.password,
      p_key: data.key,
      p_subject: data.subject,
      p_heading: data.heading,
      p_body: data.body,
    });
    if (error) {
      return {
        ok: false as const,
        error: unauthorized(error.message) ? "Wrong password." : "Could not save that email.",
      };
    }
    return { ok: true as const };
  });

/** Puts one email back to its original copy. */
export const adminResetTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; key: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error } = await createPublicServerClient().rpc("admin_reset_template", {
      p_password: data.password,
      p_key: data.key,
    });
    if (error) {
      return {
        ok: false as const,
        error: unauthorized(error.message) ? "Wrong password." : "Could not reset that email.",
      };
    }
    return { ok: true as const };
  });

/** Renders one email exactly as it will go out, for the preview pane. */
export const adminPreviewTemplate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      key: string;
      subject?: string | undefined;
      heading?: string | undefined;
      body?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { TEMPLATE_MAP, applyOverride, renderEmail } = await import("./email-templates");
    const automation = await import("./email-automation.server");

    const base = TEMPLATE_MAP[data.key];
    if (!base) return { ok: false as const, error: "Unknown email." };

    try {
      const db = createPublicServerClient();
      const settings = await automation.loadSettings(db, data.password);
      const spec = applyOverride(base, {
        subject: data.subject ?? null,
        heading: data.heading ?? null,
        body: data.body ?? null,
      });
      const { subject, html } = renderEmail(spec, {
        firstName: "Milan",
        links: automation.resolveLinks(settings, null),
      });
      return { ok: true as const, subject, html };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false as const,
        error: unauthorized(message) ? "Wrong password." : "Could not build the preview.",
      };
    }
  });


export const adminSetTag = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; registrationId: string; tag: string; add: boolean }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error } = await createPublicServerClient().rpc("admin_set_tag", {
      p_password: data.password,
      p_registration_id: data.registrationId,
      p_tag: data.tag,
      p_add: data.add,
    });
    if (error) {
      return {
        ok: false as const,
        error: unauthorized(error.message) ? "Wrong password." : "Could not save that tag.",
      };
    }
    return { ok: true as const };
  });

export const adminDeleteLead = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; registrationId: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error } = await createPublicServerClient().rpc("admin_delete_lead", {
      p_password: data.password,
      p_registration_id: data.registrationId,
    });
    if (error) {
      return {
        ok: false as const,
        error: unauthorized(error.message) ? "Wrong password." : "Could not delete that lead.",
      };
    }
    return { ok: true as const };
  });

export const adminUpdateLead = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      id: string;
      fullName: string;
      email: string;
      phone: string;
      status?: string;
      sessionDate?: string | null;
      whatsappConsent?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error: authError } = await createPublicServerClient().rpc("admin_get_email_settings", {
      p_password: data.password,
    });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const { isValidEmail, isValidIndianMobile, cleanIndianMobile } = await import("./validation");

    const cleanEmail = data.email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return { ok: false as const, error: "Please enter a valid, active email address." };
    }

    let finalPhoneE164 = "";
    if (data.phone && data.phone.trim() !== "") {
      const digits10 = cleanIndianMobile(data.phone);
      if (!isValidIndianMobile(digits10)) {
        return { ok: false as const, error: "Please enter a valid 10-digit Indian mobile number." };
      }
      finalPhoneE164 = `+91${digits10}`;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure email or phone is not already assigned to another contact
    let query = supabaseAdmin
      .from("registrations")
      .select("id, email, phone_e164")
      .neq("id", data.id);

    if (finalPhoneE164) {
      query = query.or(`email.eq.${cleanEmail},phone_e164.eq.${finalPhoneE164}`);
    } else {
      query = query.eq("email", cleanEmail);
    }

    const { data: duplicateLead } = await query.limit(1).maybeSingle();
    if (duplicateLead) {
      if (duplicateLead.email === cleanEmail) {
        return { ok: false as const, error: `Another contact already exists with email '${cleanEmail}'.` };
      }
      if (duplicateLead.phone_e164 === finalPhoneE164) {
        return { ok: false as const, error: `Another contact already exists with mobile '${finalPhoneE164}'.` };
      }
    }

    const updatePayload: Record<string, unknown> = {
      full_name: data.fullName.trim(),
      email: cleanEmail,
      phone_e164: finalPhoneE164,
    };
    if (typeof data.whatsappConsent === "boolean") {
      updatePayload["whatsapp_consent"] = data.whatsappConsent;
    }
    if (data.status) {
      updatePayload["status"] = data.status;
    }
    if (data.sessionDate !== undefined) {
      updatePayload["session_date"] = data.sessionDate;
    }

    const { error: updateError } = await supabaseAdmin
      .from("registrations")
      .update(updatePayload as never)
      .eq("id", data.id);

    if (updateError) {
      // Fallback: try updating newsletter_subscribers if registration not found
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ email: data.email.trim().toLowerCase() } as never)
        .eq("id", data.id);
    }

    return {
      ok: true as const,
      lead: {
        id: data.id,
        full_name: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        phone_e164: finalPhoneE164,
        status: data.status,
        session_date: data.sessionDate,
        whatsapp_consent: data.whatsappConsent,
      },
    };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; settings: Partial<AdminSettings> }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error } = await createPublicServerClient().rpc("admin_save_email_settings", {
      p_password: data.password,
      p: JSON.parse(JSON.stringify(data.settings)) as never,
    });
    if (error) {
      return {
        ok: false as const,
        error: unauthorized(error.message) ? "Wrong password." : "Could not save the settings.",
      };
    }
    return { ok: true as const };
  });

/** Queues one template for a list of people, then sends the queue straight away. */
export const adminSendEmails = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      template: string;
      leads: { id: string; email: string; session_date?: string | null | undefined }[];
      force?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { TEMPLATE_MAP } = await import("./email-templates");
    const { sendDueEmails } = await import("./email-automation.server");

    if (!TEMPLATE_MAP[data.template]) {
      return { ok: false as const, error: "Unknown email." };
    }
    if (data.leads.length === 0) return { ok: false as const, error: "Nobody selected." };

    const stamp = Date.now();
    const rows = data.leads.map((lead) => ({
      registration_id: lead.id,
      email: lead.email,
      template: data.template,
      session_date: lead.session_date ?? null,
      scheduled_at: new Date().toISOString(),
      idempotency_key: data.force
        ? `${lead.id}:${data.template}:manual:${stamp}`
        : `${lead.id}:${data.template}:${lead.session_date ?? "na"}`,
    }));

    try {
      const db = createPublicServerClient();
      const { data: queued, error } = await db.rpc("queue_emails", {
        p_password: data.password,
        p_rows: JSON.parse(JSON.stringify(rows)) as never,
      });
      if (error) {
        return {
          ok: false as const,
          error: unauthorized(error.message) ? "Wrong password." : "Could not queue those emails.",
        };
      }
      const result = await sendDueEmails(db, Math.min(100, Math.max(1, rows.length)), data.password);
      return { ok: true as const, queued: Number(queued ?? 0), ...result };
    } catch (error) {
      console.error("adminSendEmails failed:", error);
      return { ok: false as const, error: "Could not send those emails." };
    }
  });

/** Sends whatever is due right now, without waiting for the schedule. */
export const adminRunDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const automation = await import("./email-automation.server");
    try {
      const db = createPublicServerClient();
      const { error } = await db.rpc("admin_get_email_settings", { p_password: data.password });
      if (error) {
        return {
          ok: false as const,
          error: unauthorized(error.message) ? "Wrong password." : "Could not run the queue.",
        };
      }
      const queued = await automation.scheduleSequence(db, data.password);
      const result = await automation.sendDueEmails(db, 50, data.password);
      return { ok: true as const, queued, ...result };
    } catch (error) {
      console.error("adminRunDispatch failed:", error);
      return { ok: false as const, error: "Could not run the queue." };
    }
  });

type DnsAnswer = { data?: string };

async function dnsLookup(name: string, type: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as { Answer?: DnsAnswer[] };
    return (payload.Answer ?? [])
      .map((answer) => (answer.data ?? "").replace(/^"|"$/g, ""))
      .filter((value) => value !== "");
  } catch {
    return [];
  }
}

export const adminDeliverabilityCheck = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; domain?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { error } = await createPublicServerClient().rpc("admin_get_email_settings", {
      p_password: data.password,
    });
    if (error) {
      return {
        ok: false as const,
        error: unauthorized(error.message) ? "Wrong password." : "Could not run the check.",
      };
    }

    const domain = (data.domain || "onepageplan.in").trim().toLowerCase();
    const [txt, dmarc, dkim, mx] = await Promise.all([
      dnsLookup(domain, "TXT"),
      dnsLookup(`_dmarc.${domain}`, "TXT"),
      dnsLookup(`resend._domainkey.${domain}`, "TXT"),
      dnsLookup(domain, "MX"),
    ]);

    const spf = txt.find((record) => record.toLowerCase().startsWith("v=spf1")) ?? null;
    return {
      ok: true as const,
      domain,
      checks: [
        { name: "SPF", pass: Boolean(spf), value: spf ?? "No v=spf1 record found" },
        {
          name: "DKIM (Resend)",
          pass: dkim.length > 0,
          value: dkim[0] ? `${dkim[0].slice(0, 60)}…` : "No resend._domainkey record found",
        },
        {
          name: "DMARC",
          pass: dmarc.some((record) => record.toLowerCase().startsWith("v=dmarc1")),
          value: dmarc[0] ?? "No _dmarc record found",
        },
        { name: "MX", pass: mx.length > 0, value: mx.join(", ") || "No MX records found" },
      ],
    };
  });

export type AdminWebinarLog = {
  id: string;
  created_at: string;
  kind: string;
  email: string | null;
  full_name: string | null;
  webinar_id: string | null;
  request_url: string | null;
  request_body: Record<string, string> | null;
  response_status: number | null;
  response_body: string | null;
  outcome: string;
  error: string | null;
};

/** The raw webinar.gg request/response log, newest first. */
export const adminWebinarLogs = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { data: rows, error } = await createPublicServerClient().rpc("admin_webinar_logs", {
      p_password: data.password,
      p_limit: 100,
    });
    if (error) {
      if (unauthorized(error.message)) return { ok: false as const, error: "Wrong password." };
      console.error("adminWebinarLogs failed:", error.message);
      return { ok: false as const, error: "Could not load the webinar log." };
    }
    return { ok: true as const, logs: (rows ?? []) as unknown as AdminWebinarLog[] };
  });

export type AdminWhatsAppSend = {
  id: string;
  phone: string;
  template_name: string | null;
  message_key: string;
  status: string;
  provider_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  created_at: string;
  attendee_name?: string | null;
};

export type AdminWhatsAppStats = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  delivered_rate: number;
  read_rate: number;
  clicked_rate: number;
  recent_sends: AdminWhatsAppSend[];
};

export const adminWhatsAppDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { data: dashboard, error } = await createPublicServerClient().rpc(
      "admin_get_whatsapp_dashboard" as never,
      { p_password: data.password } as never,
    );
    if (error) {
      if (unauthorized(error.message)) return { ok: false as const, error: "Wrong password." };
      console.error("adminWhatsAppDashboard failed:", error.message);
      return { ok: false as const, error: "Could not load WhatsApp metrics." };
    }
    return { ok: true as const, data: (dashboard ?? {}) as unknown as AdminWhatsAppStats };
  });

export type AdminWebinarHistoricalEvent = {
  id: string;
  webinar_id: string;
  session_date: string;
  email: string | null;
  event_type: string;
  duration_seconds: number;
  created_at: string;
};

export type AdminWebinarHistoricalSession = {
  session_date: string;
  total_events: number;
  unique_attendees: number;
  joins: number;
  leaves: number;
};

export const adminHistoricalWebinarLogs = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; sessionDate?: string | null }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const { data: res, error } = await createPublicServerClient().rpc(
      "admin_get_historical_webinar_logs" as never,
      {
        p_password: data.password,
        ...(data.sessionDate ? { p_session_date: data.sessionDate } : {}),
      } as never,
    );
    if (error) {
      if (unauthorized(error.message)) {
        return {
          ok: false as const,
          error: "Wrong password.",
          sessions: [] as AdminWebinarHistoricalSession[],
          events: [] as AdminWebinarHistoricalEvent[],
        };
      }
      console.error("adminHistoricalWebinarLogs failed:", error.message);
      return {
        ok: false as const,
        error: "Could not load historical webinar logs.",
        sessions: [] as AdminWebinarHistoricalSession[],
        events: [] as AdminWebinarHistoricalEvent[],
      };
    }
    const parsed = (res ?? {}) as {
      sessions?: AdminWebinarHistoricalSession[];
      events?: Array<{
        id: string;
        webinar_id: string;
        session_date: string;
        email: string | null;
        event_type: string;
        duration_seconds: number;
        created_at: string;
      }>;
    };
    const cleanEvents: AdminWebinarHistoricalEvent[] = (parsed.events ?? []).map((e) => ({
      id: String(e.id),
      webinar_id: String(e.webinar_id),
      session_date: String(e.session_date),
      email: e.email ? String(e.email) : null,
      event_type: String(e.event_type),
      duration_seconds: Number(e.duration_seconds || 0),
      created_at: String(e.created_at),
    }));

    return {
      ok: true as const,
      error: null,
      sessions: parsed.sessions ?? [],
      events: cleanEvents,
    };
  });

export const adminRegisterWhatsAppNumber = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; pin: string; token?: string; phoneNumberId?: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();
    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const pin = data.pin?.trim();
    if (!pin || !/^\d{6}$/.test(pin)) {
      return { ok: false as const, error: "PIN must be exactly 6 numeric digits." };
    }

    const phoneNumberId = data.phoneNumberId?.trim() || process.env["WHATSAPP_PHONE_NUMBER_ID"] || "1234920483047663";
    const token = data.token?.trim() || process.env["WHATSAPP_ACCESS_TOKEN"];

    if (!token) {
      return { ok: false as const, error: "Meta Access Token is required." };
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: pin,
        }),
      });

      const json = (await res.json()) as { success?: boolean; error?: { message?: string; error_user_msg?: string } };
      if (!res.ok || !json.success) {
        return {
          ok: false as const,
          error: json.error?.message || json.error?.error_user_msg || JSON.stringify(json),
        };
      }

      return {
        ok: true as const,
        message: "Successfully registered phone number with Meta Cloud API! 2-step verification PIN is active.",
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        ok: false as const,
        error: errorMsg || "Network error registering phone number",
      };
    }
  });

export type WhatsAppInboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  createdAt: string;
  status?: string;
  senderName?: string;
  messageType?: string;
  repliedToMessageKey?: string | null;
};

export type WhatsAppConversationThread = {
  phone: string;
  contactName: string;
  email: string | null;
  registrationId: string | null;
  status: string;
  sessionDate: string | null;
  unreadCount: number;
  lastMessage: WhatsAppInboxMessage;
  lastInboundAt: string | null;
  isCareWindowActive: boolean;
  careWindowHoursLeft: number;
  messages: WhatsAppInboxMessage[];
};

export type WhatsAppInboxData = {
  threads: WhatsAppConversationThread[];
  summary: {
    totalInbound: number;
    totalContacts: number;
    totalUnread: number;
    activeCareWindows: number;
  };
};

export const adminGetWhatsAppInbox = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      // 1. Fetch inbound messages
      const { data: inboundRows } = await (db as any)
        .from("whatsapp_inbound_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1000);

      // 2. Fetch outbound sends
      const { data: outboundRows } = await (db as any)
        .from("whatsapp_sends")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1000);

      // 3. Fetch registrations to enrich contact info
      const { data: regRows } = await (db.from("registrations") as any)
        .select("id, full_name, email, phone_e164, status, session_date")
        .limit(2000);

      const regByPhone = new Map<string, any>();
      const regById = new Map<string, any>();
      for (const r of regRows || []) {
        regById.set(r.id, r);
        const clean = (r.phone_e164 || "").replace(/\D/g, "");
        if (clean) {
          regByPhone.set(clean, r);
          regByPhone.set(clean.slice(-10), r);
        }
      }

      // Group by phone number
      const threadMap = new Map<string, {
        phone: string;
        contactName: string;
        email: string | null;
        registrationId: string | null;
        status: string;
        sessionDate: string | null;
        unreadCount: number;
        lastInboundAt: string | null;
        messages: WhatsAppInboxMessage[];
      }>();

      const getOrCreateThread = (phoneRaw: string, initialName?: string | null, regId?: string | null) => {
        const clean = phoneRaw.replace(/\D/g, "");
        const key = clean.slice(-10) || clean;
        let thread = threadMap.get(key);
        if (!thread) {
          const reg = (regId ? regById.get(regId) : null) || regByPhone.get(key) || regByPhone.get(clean);
          thread = {
            phone: clean.startsWith("91") ? `+${clean}` : `+91${clean}`,
            contactName: initialName || reg?.full_name || `+${clean}`,
            email: reg?.email || null,
            registrationId: reg?.id || regId || null,
            status: reg?.status || "registered",
            sessionDate: reg?.session_date || null,
            unreadCount: 0,
            lastInboundAt: null,
            messages: [],
          };
          threadMap.set(key, thread);
        } else {
          if (initialName && (!thread.contactName || thread.contactName.startsWith("+"))) {
            thread.contactName = initialName;
          }
          if (regId && !thread.registrationId) {
            thread.registrationId = regId;
          }
        }
        return thread;
      };

      // Add outbound sends
      for (const out of outboundRows || []) {
        const phone = out.phone || "";
        if (!phone) continue;
        const thread = getOrCreateThread(phone, null, out.registration_id);
        thread.messages.push({
          id: out.id || String(Math.random()),
          direction: "outbound",
          body: out.template_name ? `[Template: ${out.template_name}]` : "[Outbound Message]",
          createdAt: out.created_at || new Date().toISOString(),
          status: out.status || "sent",
          repliedToMessageKey: out.template_name || null,
        });
      }

      // Add inbound messages
      for (const inb of inboundRows || []) {
        const phone = inb.phone || "";
        if (!phone) continue;
        const thread = getOrCreateThread(phone, inb.sender_name, inb.registration_id);
        if (!inb.is_read) {
          thread.unreadCount++;
        }
        thread.lastInboundAt = inb.created_at;
        thread.messages.push({
          id: inb.id || String(Math.random()),
          direction: "inbound",
          body: inb.message_body || "[Inbound Message]",
          createdAt: inb.created_at || new Date().toISOString(),
          senderName: inb.sender_name || thread.contactName,
          messageType: inb.message_type || "text",
          repliedToMessageKey: inb.replied_to_message_key || null,
        });
      }

      // Sort and assemble threads
      const now = Date.now();
      const threads: WhatsAppConversationThread[] = [];
      let totalInbound = 0;
      let totalUnread = 0;
      let activeCareWindows = 0;

      for (const t of threadMap.values()) {
        // Sort messages inside thread chronologically
        t.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const lastMsg = t.messages[t.messages.length - 1];
        if (!lastMsg) continue;

        let isCareWindowActive = false;
        let careWindowHoursLeft = 0;
        if (t.lastInboundAt) {
          totalInbound++;
          const inboundTime = new Date(t.lastInboundAt).getTime();
          const msPassed = now - inboundTime;
          const hoursLeft = Math.max(0, 24 - msPassed / (1000 * 60 * 60));
          if (hoursLeft > 0) {
            isCareWindowActive = true;
            careWindowHoursLeft = Math.round(hoursLeft * 10) / 10;
            activeCareWindows++;
          }
        }

        totalUnread += t.unreadCount;

        threads.push({
          phone: t.phone,
          contactName: t.contactName,
          email: t.email,
          registrationId: t.registrationId,
          status: t.status,
          sessionDate: t.sessionDate,
          unreadCount: t.unreadCount,
          lastMessage: lastMsg,
          lastInboundAt: t.lastInboundAt,
          isCareWindowActive,
          careWindowHoursLeft,
          messages: t.messages,
        });
      }

      // Sort threads: most recent message first
      threads.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

      return {
        ok: true as const,
        data: {
          threads,
          summary: {
            totalInbound,
            totalContacts: threads.length,
            totalUnread,
            activeCareWindows,
          },
        } as WhatsAppInboxData,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[adminGetWhatsAppInbox] error:", msg);
      return { ok: false as const, error: msg || "Failed to load WhatsApp inbox" };
    }
  });

export const adminMarkWhatsAppRead = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; phone: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const clean = data.phone.replace(/\D/g, "");
    const last10 = clean.slice(-10);

    try {
      await (db as any)
        .from("whatsapp_inbound_messages")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .or(`phone.eq.${clean},phone.ilike.%${last10}`);

      return { ok: true as const };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminSendWhatsAppDirectReply = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; phone: string; message: string; registrationId?: string | null }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const text = data.message?.trim();
    if (!text) {
      return { ok: false as const, error: "Message text cannot be empty." };
    }

    try {
      const { sendWhatsAppMessage } = await import("@/services/whatsapp/sender");
      const cleanPhone = data.phone.replace(/\D/g, "");

      const result = await sendWhatsAppMessage({
        to: cleanPhone,
        message: {
          type: "text",
          text: { body: text },
        },
      });

      const messageId = result.messages?.[0]?.id || null;

      // Log into whatsapp_sends table
      await (db as any).from("whatsapp_sends").insert({
        registration_id: data.registrationId || null,
        phone: cleanPhone,
        template_name: "direct_admin_reply",
        status: "sent",
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
      });

      return { ok: true as const, messageId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[adminSendWhatsAppDirectReply] error:", msg);
      return { ok: false as const, error: msg || "Failed to send direct WhatsApp message" };
    }
  });

// ==============================================================================
// COMMERCE ADMIN FUNCTIONS
// ==============================================================================

export type AdminCommerceOrder = {
  id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  product_id: string;
  pricing_rule_applied: string;
  base_price: number;
  credit_applied: number;
  discount_code_applied: string | null;
  discount_amount: number;
  referral_code_applied: string | null;
  amount_charged: number;
  currency: string;
  buyer_name: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  status: string;
  created_at: string;
  captured_at: string | null;
  refunded_at: string | null;
};

export type AdminManualGrant = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  product_id: string;
  reason_note: string;
  granted_by: string;
  created_at: string;
};

export type AdminDiscountCode = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  applies_to_products: string[];
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type AdminReferralPartner = {
  id: string;
  code: string;
  partner_name: string;
  partner_email: string;
  reward_type: string;
  reward_value: number;
  is_active: boolean;
  created_at: string;
};

export type AdminReferralConversion = {
  id: string;
  partner_id: string | null;
  order_id: string;
  referral_code: string;
  buyer_email: string;
  order_amount: number;
  reward_amount: number;
  status: string;
  created_at: string;
};

export type AdminReconciliationFlag = {
  id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  email: string | null;
  amount: number | null;
  issue_type: string;
  details: Record<string, unknown>;
  resolved: boolean;
  flagged_at: string;
};

export const adminGetCommerceDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const { getRazorpayMode } = await import("./commerce/razorpay.server");
    const { getSilverMilestonePricing } = await import("./commerce/pricing.server");

    // Safe query runner so non-existent tables don't throw an unhandled rejection
    const safeQuery = async <T>(promise: PromiseLike<{ data: T | null; error: any }>): Promise<{ data: T | null }> => {
      try {
        const res = await promise;
        return { data: res.data ?? null };
      } catch {
        return { data: null };
      }
    };

    try {
      const [
        settingsRes,
        cohortsRes,
        ordersRes,
        manualGrantsRes,
        reconciliationRes,
        discountsRes,
        partnersRes,
        conversionsRes,
        templatesRes,
        milestoneInfo,
      ] = await Promise.all([
        safeQuery(db.from("commerce_settings" as never).select("*").eq("id" as never, 1 as never).maybeSingle()),
        safeQuery(db.from("cohorts" as never).select("*").order("cohort_number" as never, { ascending: true } as never)),
        safeQuery(db.from("orders" as never).select("*").order("created_at" as never, { ascending: false } as never).limit(500)),
        safeQuery(db.from("manual_grants" as never).select("*").order("created_at" as never, { ascending: false } as never).limit(200)),
        safeQuery(db.from("reconciliation_flags" as never).select("*").order("flagged_at" as never, { ascending: false } as never)),
        safeQuery(db.from("discount_codes" as never).select("*").order("created_at" as never, { ascending: false } as never)),
        safeQuery(db.from("referral_partners" as never).select("*").order("created_at" as never, { ascending: false } as never)),
        safeQuery(db.from("referral_conversions" as never).select("*").order("created_at" as never, { ascending: false } as never).limit(200)),
        safeQuery(db.from("completion_page_templates" as never).select("*").order("slug" as never, { ascending: true } as never).order("version" as never, { ascending: false } as never)),
        getSilverMilestonePricing().catch(() => ({
          activeCount: 0,
          currentPrice: 6001,
          nextThreshold: 100,
          nextPrice: 7001,
        })),
      ]);

      const orders = (ordersRes.data ?? []) as unknown as AdminCommerceOrder[];

      // Calculate current Indian Financial Year total revenue (April 1 to now)
      const now = new Date();
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      const fyStartDate = new Date(fyStartYear, 3, 1, 0, 0, 0); // April 1 00:00:00

      const fyCapturedTotal = orders
        .filter((o) => o.status === "captured" && new Date(o.created_at) >= fyStartDate)
        .reduce((sum, o) => sum + (Number(o.amount_charged) || 0), 0);

      const allTimeTotal = orders
        .filter((o) => o.status === "captured")
        .reduce((sum, o) => sum + (Number(o.amount_charged) || 0), 0);

      const completionTemplates = (templatesRes.data ?? []) as unknown as AdminCompletionTemplate[];

      return {
        ok: true as const,
        data: {
          mode: getRazorpayMode(),
          settings: (settingsRes.data as any) || {},
          cohorts: (cohortsRes.data ?? []) as any[],
          orders,
          manualGrants: (manualGrantsRes.data ?? []) as unknown as AdminManualGrant[],
          reconciliationFlags: (reconciliationRes.data ?? []) as unknown as AdminReconciliationFlag[],
          discountCodes: (discountsRes.data ?? []) as unknown as AdminDiscountCode[],
          referralPartners: (partnersRes.data ?? []) as unknown as AdminReferralPartner[],
          referralConversions: (conversionsRes.data ?? []) as unknown as AdminReferralConversion[],
          completionTemplates,
          milestoneInfo,
          fyCapturedTotal,
          allTimeTotal,
          currentFy: `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[adminGetCommerceDashboard] error:", msg);
      return { ok: false as const, error: msg };
    }
  });

export const adminSaveCommerceSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; settings: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const payload = {
        ...data.settings,
        updated_at: new Date().toISOString(),
      };

      // If community_url changed from empty to non-empty, record community_set_at
      if (payload["community_url"] && typeof payload["community_url"] === "string" && payload["community_url"].trim() !== "") {
        payload["community_set_at"] = new Date().toISOString();
      }

      const { error } = await db
        .from("commerce_settings" as never)
        .update(payload as never)
        .eq("id" as never, 1 as never);

      if (error) {
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminProcessRefund = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; orderId: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const { data: order } = await db
        .from("orders" as never)
        .select("*")
        .eq("id" as never, data.orderId as never)
        .single();

      if (!order) {
        return { ok: false as const, error: "Order not found." };
      }

      const ord = order as any;
      if (!ord.razorpay_payment_id) {
        return { ok: false as const, error: "Order has no Razorpay payment ID on record." };
      }

      // 1. Initiate refund through Razorpay REST API
      const { initiateRazorpayRefund } = await import("./commerce/razorpay.server");
      const rzpRefund = await initiateRazorpayRefund(ord.razorpay_payment_id);

      if (!rzpRefund.ok) {
        return { ok: false as const, error: rzpRefund.error || "Razorpay refund initiation failed." };
      }

      // 2. Revoke entitlements in Supabase atomically
      const { data: revokeResult, error: revokeError } = await (db.rpc as any)(
        "revoke_entitlement_on_refund",
        {
          p_order_id: ord.id,
        },
      );

      if (revokeError) {
        return { ok: false as const, error: revokeError.message };
      }

      return { ok: true as const, refundId: rzpRefund.refundId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminCreateManualGrant = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      email: string;
      name?: string;
      phone?: string;
      productId: string;
      reasonNote: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    if (!data.reasonNote || !data.reasonNote.trim()) {
      return { ok: false as const, error: "Reason note is strictly required for manual grants." };
    }

    try {
      const { data: result, error } = await (db.rpc as any)("record_manual_grant", {
        p_email: data.email,
        p_name: data.name || "",
        p_phone: data.phone || "",
        p_product_id: data.productId,
        p_reason_note: data.reasonNote.trim(),
        p_admin: "admin",
      });

      if (error) {
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const, manualGrantId: result?.manual_grant_id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminRunReconciliation = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const { runCommerceReconciliation } = await import("./commerce/reconciliation.server");
    return await runCommerceReconciliation();
  });

export const adminBulkUploadMembers = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; users: Array<Record<string, unknown>> }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    if (!data.users || !Array.isArray(data.users) || data.users.length === 0) {
      return { ok: false as const, error: "No users provided for bulk upload." };
    }

    // Try RPC first
    try {
      const { data: result, error } = await (db.rpc as any)("bulk_upload_members", {
        p_users: data.users,
        p_admin: "admin",
      });

      if (!error && result && typeof result.imported_count === "number") {
        return { ok: true as const, importedCount: result.imported_count };
      }
    } catch {
      // Fallback to direct table insertion below
    }

    // Fallback: Direct table operations via supabaseAdmin
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Fetch active cohorts for linking
      const { data: allCohorts } = await supabaseAdmin
        .from("cohorts" as never)
        .select("id, cohort_number, start_date")
        .order("start_date" as never, { ascending: true });

      const defaultCohort = (allCohorts && Array.isArray(allCohorts))
        ? ((allCohorts as any[]).find((c) => new Date(c.start_date) > new Date()) || allCohorts[0])
        : null;

      let importedCount = 0;

      for (const item of data.users) {
        const email = String(item["email"] || "").trim().toLowerCase();
        if (!email || !email.includes("@")) continue;

        const name = String(item["name"] || "").trim();
        const phone = String(item["phone"] || "").trim();
        const rawTier = String(item["tier"] || "silver").trim().toLowerCase();
        const tier = (rawTier === "mrc" || rawTier === "money_reality_check")
          ? "money_reality_check"
          : (rawTier === "gold" ? "gold" : (rawTier === "diamond" ? "diamond" : "silver"));
        const notes = String(item["notes"] || "Bulk upload import").trim();
        const cohortNum = item["cohort_number"] ? Number(item["cohort_number"]) : null;

        let cohortId: string | null = null;
        if (cohortNum && allCohorts && Array.isArray(allCohorts)) {
          const match = (allCohorts as any[]).find((c) => c.cohort_number === cohortNum);
          if (match) cohortId = match.id;
        }
        if (!cohortId && defaultCohort && tier !== "money_reality_check") {
          cohortId = defaultCohort.id;
        }

        // 1. Insert manual grant
        const { data: grantRow, error: grantErr } = await supabaseAdmin
          .from("manual_grants" as never)
          .insert({
            email,
            name: name || null,
            phone: phone || null,
            product_id: tier,
            reason_note: notes,
            granted_by: "admin",
          } as never)
          .select("id")
          .single();

        const grantId = grantRow ? (grantRow as any).id : null;

        // 2. Insert member_access_grants
        await supabaseAdmin
          .from("member_access_grants" as never)
          .insert({
            email,
            access_tier: tier,
            source_type: "bulk_upload",
            manual_grant_id: grantId,
            status: "active",
            cohort_id: cohortId,
          } as never);

        // If Gold or Diamond, also grant subordinate tiers
        if (tier === "gold") {
          await supabaseAdmin
            .from("member_access_grants" as never)
            .insert({
              email,
              access_tier: "silver",
              source_type: "included_in_tier",
              parent_product: "gold",
              manual_grant_id: grantId,
              status: "active",
              cohort_id: cohortId,
            } as never);
        } else if (tier === "diamond") {
          await supabaseAdmin
            .from("member_access_grants" as never)
            .insert({
              email,
              access_tier: "gold",
              source_type: "included_in_tier",
              parent_product: "diamond",
              manual_grant_id: grantId,
              status: "active",
            } as never);
          await supabaseAdmin
            .from("member_access_grants" as never)
            .insert({
              email,
              access_tier: "silver",
              source_type: "included_in_tier",
              parent_product: "diamond",
              manual_grant_id: grantId,
              status: "active",
              cohort_id: cohortId,
            } as never);
        }

        // 3. Mark registrations status as purchased if lead exists
        await supabaseAdmin
          .from("registrations" as never)
          .update({ status: "purchased" } as never)
          .eq("email" as never, email);

        importedCount++;
      }

      return { ok: true as const, importedCount };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Error processing bulk upload." };
    }
  });

export const adminSaveDiscountCode = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      code: string;
      discountType: string;
      discountValue: number;
      appliesToProducts?: string[];
      maxUses?: number | null;
      expiresAt?: string | null;
      isActive: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const cleanCode = data.code.trim().toUpperCase();
      const { error } = await db.from("discount_codes" as never).upsert(
        {
          code: cleanCode,
          discount_type: data.discountType,
          discount_value: data.discountValue,
          applies_to_products: data.appliesToProducts || ["all"],
          max_uses: data.maxUses ?? null,
          expires_at: data.expiresAt ?? null,
          is_active: data.isActive,
        } as never,
        { onConflict: "code" } as never,
      );

      if (error) {
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminSaveReferralPartner = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      code: string;
      partnerName: string;
      partnerEmail: string;
      rewardType: string;
      rewardValue: number;
      isActive: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const cleanCode = data.code.trim().toLowerCase();
      const { error } = await db.from("referral_partners" as never).upsert(
        {
          code: cleanCode,
          partner_name: data.partnerName.trim(),
          partner_email: data.partnerEmail.trim().toLowerCase(),
          reward_type: data.rewardType,
          reward_value: data.rewardValue,
          is_active: data.isActive,
        } as never,
        { onConflict: "code" } as never,
      );

      if (error) {
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export interface AdminCompletionTemplate {
  id: string;
  slug: string;
  version: number;
  html_content: string;
  is_active: boolean;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
}

export const adminSaveCompletionTemplate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      slug: string;
      htmlContent: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const { data: res, error } = await (db.rpc as any)("save_completion_template", {
        p_slug: data.slug.trim(),
        p_html_content: data.htmlContent,
        p_uploaded_by: "admin",
        p_notes: data.notes || null,
      });

      if (error) {
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const, result: res };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminRollbackCompletionTemplate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      slug: string;
      targetVersion: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const { data: res, error } = await (db.rpc as any)("rollback_completion_template", {
        p_slug: data.slug.trim(),
        p_target_version: data.targetVersion,
      });

      if (error) {
        return { ok: false as const, error: error.message };
      }

      return { ok: true as const, result: res };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

// PROMPT 4: MESSAGING ADMIN FUNCTIONS
export const adminGetMessagingData = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const { getUnifiedTemplateRegistry } = await import("./messaging/meta-templates.server");
      const { seedMessageTemplates } = await import("./messaging/template-registry.server");
      try {
        await seedMessageTemplates();
      } catch {
        /* non-fatal */
      }

      const unifiedResult = await getUnifiedTemplateRegistry();

      // Read settings with fallback cascade
      let currentSettings: Record<string, unknown> = {};
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const client = supabaseAdmin || db;
        const sRes = await client
          .from("commerce_settings" as never)
          .select("messaging_test_mode, test_recipient_email, test_recipient_phone")
          .eq("id" as never, 1)
          .maybeSingle();
        if (sRes?.data) currentSettings = { ...(sRes.data as any) };
      } catch {
        /* fallback */
      }

      // Check app_config if test mode not resolved
      if (currentSettings.messaging_test_mode === undefined) {
        try {
          const { data: cfgRow } = await db
            .from("app_config" as never)
            .select("value")
            .eq("key" as never, "messaging_test_mode")
            .maybeSingle();
          if (cfgRow) {
            currentSettings.messaging_test_mode = (cfgRow as any).value === "true";
          }
        } catch {
          /* fallback */
        }
      }

      // Check server process env
      if (currentSettings.messaging_test_mode === undefined && process.env["OPP_MESSAGING_TEST_MODE"]) {
        currentSettings.messaging_test_mode = process.env["OPP_MESSAGING_TEST_MODE"] === "true";
      }

      const safeQuery = async <T>(promise: PromiseLike<{ data: T | null; error: any }>): Promise<{ data: T | null }> => {
        try {
          const res = await promise;
          return { data: res.data ?? null };
        } catch {
          return { data: null };
        }
      };

      const [scheduledRes, logsRes, suppressionsRes] = await Promise.all([
        safeQuery(
          db
            .from("scheduled_messages" as never)
            .select("*")
            .order("scheduled_for" as never, { ascending: false })
            .limit(200),
        ),
        safeQuery(
          db
            .from("message_send_logs" as never)
            .select("*")
            .order("created_at" as never, { ascending: false })
            .limit(200),
        ),
        safeQuery(
          db
            .from("communication_suppressions" as never)
            .select("*")
            .order("created_at" as never, { ascending: false })
            .limit(100),
        ),
      ]);

      return {
        ok: true as const,
        templates: unifiedResult.templates as any[],
        metaStatus: unifiedResult.metaStatus,
        scheduled: (scheduledRes.data ?? []) as any[],
        logs: (logsRes.data ?? []) as any[],
        suppressions: (suppressionsRes.data ?? []) as any[],
        settings: currentSettings,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminSyncMetaTemplates = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const { fetchMetaTemplates, getUnifiedTemplateRegistry } = await import("./messaging/meta-templates.server");
      const metaRes = await fetchMetaTemplates();
      const unified = await getUnifiedTemplateRegistry();

      return {
        ok: true as const,
        metaStatus: {
          live: metaRes.live,
          count: metaRes.count,
          wabaId: metaRes.wabaId,
          error: metaRes.error,
        },
        templates: unified.templates as any[],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminSyncResendDelivery = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    const resendKey = process.env["RESEND_API_KEY"];
    if (!resendKey) {
      return { ok: false as const, error: "RESEND_API_KEY not configured on server." };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const client = supabaseAdmin || db;

      let updatedCount = 0;

      // 1. Fetch recent emails list directly from Resend API
      try {
        const resendListRes = await fetch("https://api.resend.com/emails?limit=100", {
          headers: { Authorization: `Bearer ${resendKey}` },
        });

        if (resendListRes.ok) {
          const resendData = (await resendListRes.json()) as {
            data?: Array<{ id: string; to: string[] | string; created_at: string; subject?: string }>;
          };
          const resendEmails = resendData.data || [];

          for (const item of resendEmails) {
            const resendId = item.id;
            const recipient = Array.isArray(item.to) ? item.to[0]?.toLowerCase() : String(item.to || "").toLowerCase();
            if (!resendId || !recipient) continue;

            // Fetch detailed event status for this email from Resend
            try {
              const detailRes = await fetch(`https://api.resend.com/emails/${resendId}`, {
                headers: { Authorization: `Bearer ${resendKey}` },
              });
              if (!detailRes.ok) continue;
              const detail = (await detailRes.json()) as { last_event?: string; status?: string; created_at?: string };
              const lastEvent = (detail.last_event || detail.status || "").toLowerCase();

              // Match in email_sends table by provider_id OR by recipient email
              const { data: matchedRows } = await client
                .from("email_sends" as never)
                .select("id, status, opened_at, delivered_at, provider_id, sent_at")
                .or(`provider_id.eq.${resendId},email.ilike.${recipient}`)
                .order("sent_at" as never, { ascending: false })
                .limit(1);

              if (matchedRows && matchedRows.length > 0) {
                const target = matchedRows[0] as any;
                const updatePayload: Record<string, unknown> = {
                  provider_id: resendId,
                };

                if (lastEvent === "opened" || lastEvent === "clicked") {
                  updatePayload["status"] = "opened";
                  updatePayload["opened_at"] = target.opened_at || detail.created_at || new Date().toISOString();
                  updatePayload["delivered_at"] = target.delivered_at || target.sent_at || new Date().toISOString();
                } else if (lastEvent === "delivered") {
                  if (target.status === "sent" || target.status === "queued") {
                    updatePayload["status"] = "delivered";
                    updatePayload["delivered_at"] = target.delivered_at || detail.created_at || new Date().toISOString();
                  }
                } else if (lastEvent === "bounced") {
                  updatePayload["status"] = "bounced";
                }

                await client
                  .from("email_sends" as never)
                  .update(updatePayload as never)
                  .eq("id" as never, target.id);
                updatedCount++;
              }
            } catch {
              // Ignore single item error
            }
          }
        }
      } catch (e) {
        console.warn("[adminSyncResendDelivery] list fetch warning:", e);
      }

      // 2. Also check all DB sends that have a provider_id
      const { data: dbSends } = await client
        .from("email_sends" as never)
        .select("id, email, status, provider_id, sent_at, opened_at")
        .not("provider_id" as never, "is" as never, null as never)
        .order("sent_at" as never, { ascending: false })
        .limit(50);

      if (dbSends && Array.isArray(dbSends)) {
        for (const send of dbSends as any[]) {
          if (!send.provider_id) continue;
          try {
            const res = await fetch(`https://api.resend.com/emails/${send.provider_id}`, {
              headers: { Authorization: `Bearer ${resendKey}` },
            });
            if (res.ok) {
              const info = (await res.json()) as { last_event?: string; status?: string };
              const lastEvent = (info.last_event || info.status || "").toLowerCase();
              const updatePayload: Record<string, unknown> = {};

              if (lastEvent === "opened" || lastEvent === "clicked") {
                if (send.status !== "opened" || !send.opened_at) {
                  updatePayload["status"] = "opened";
                  updatePayload["opened_at"] = send.opened_at || new Date().toISOString();
                }
              } else if (lastEvent === "delivered") {
                if (send.status === "sent") {
                  updatePayload["status"] = "delivered";
                }
              } else if (lastEvent === "bounced") {
                updatePayload["status"] = "bounced";
              }

              if (Object.keys(updatePayload).length > 0) {
                await client
                  .from("email_sends" as never)
                  .update(updatePayload as never)
                  .eq("id" as never, send.id);
                updatedCount++;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      return { ok: true as const, updatedCount };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminSaveMessageTemplate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      key: string;
      subject?: string;
      body: string;
      isActive: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const { error } = await db
        .from("message_templates" as never)
        .update({
          subject: data.subject || null,
          body: data.body,
          is_active: data.isActive,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("key" as never, data.key);

      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminToggleMessagingSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      testMode: boolean;
      testEmail?: string;
      testPhone?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    // Always keep server memory / process state in sync
    process.env["OPP_MESSAGING_TEST_MODE"] = String(data.testMode);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const client = supabaseAdmin || db;

      // 1. Try upserting to commerce_settings
      try {
        await client
          .from("commerce_settings" as never)
          .upsert(
            {
              id: 1,
              messaging_test_mode: data.testMode,
              test_recipient_email: data.testEmail || "dodhia.milan@gmail.com",
              test_recipient_phone: data.testPhone || "+919820000000",
            } as never,
            { onConflict: "id" },
          );
      } catch {
        // continue
      }

      // 2. Also persist to app_config as reliable backup
      try {
        await client
          .from("app_config" as never)
          .upsert(
            { key: "messaging_test_mode", value: String(data.testMode) } as never,
            { onConflict: "key" },
          );
      } catch {
        // continue
      }

      if (data.testEmail) {
        try {
          await client
            .from("app_config" as never)
            .upsert(
              { key: "test_recipient_email", value: data.testEmail } as never,
              { onConflict: "key" },
            );
        } catch {
          // continue
        }
      }
      if (data.testPhone) {
        try {
          await client
            .from("app_config" as never)
            .upsert(
              { key: "test_recipient_phone", value: data.testPhone } as never,
              { onConflict: "key" },
            );
        } catch {
          // continue
        }
      }

      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminUploadAttendanceCsv = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      sessionDate: string;
      csvContent: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const lines = data.csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let matchedCount = 0;
      let unmatchedCount = 0;
      const parsedAttendees: Array<{ email: string; phone?: string; matched: boolean }> = [];

      for (const line of lines) {
        // Simple comma split
        const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        const email = parts[0]?.toLowerCase();
        const phone = parts[1] || "";

        if (email && email.includes("@")) {
          // Check match against registrations
          const { data: reg } = await db
            .from("registrations" as never)
            .select("id")
            .eq("email" as never, email)
            .maybeSingle();

          const isMatched = Boolean(reg);
          if (isMatched) matchedCount++;
          else unmatchedCount++;

          parsedAttendees.push({ email, phone, matched: isMatched });

          // Record attendance record
          await db.from("attendance_records" as never).upsert(
            {
              email,
              phone: phone || null,
              session_date: data.sessionDate,
            } as never,
            { onConflict: "email" } as never
          );
        }
      }

      return {
        ok: true as const,
        total: parsedAttendees.length,
        matchedCount,
        unmatchedCount,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

export const adminSendTestMessage = createServerFn({ method: "POST" })
  .validator((data: { password: string; templateKey: string; recipient: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    if (!data.recipient || !data.recipient.trim()) {
      return { ok: false as const, error: "Recipient address/phone cannot be empty." };
    }

    const { getUnifiedTemplateRegistry } = await import("./messaging/meta-templates.server");
    const { templates } = await getUnifiedTemplateRegistry();
    const template = templates.find((t) => t.key === data.templateKey);

    if (!template) {
      return { ok: false as const, error: `Template '${data.templateKey}' was not found in registry.` };
    }

    if (template.channel === "email") {
      const { sendEmailViaResend } = await import("./email-automation.server");
      const { renderMustacheWithConditionals } = await import("./messaging/template-registry.server");

      const sampleVariables: Record<string, string> = {
        first_name: "Milan",
        name: "Milan Dodhia",
        email: data.recipient.trim(),
        amount_paid: "₹6,001",
        cohort_name: "The Calm Money System (Cohort 1)",
        cohort_start_date: "15 Oct 2026",
        member_area_url: "https://onepageplan.in/course",
        invoice_url: "https://onepageplan.in",
        thursday_booking_url: "https://onepageplan.in",
        community_url: "https://onepageplan.in",
        upgrade_price: "₹18,000",
        upgrade_end_date: "31 Oct 2026",
        product_name: "The Calm Money System",
        checkout_mrc_url: "https://onepageplan.in",
        resume_checkout_url: "https://onepageplan.in",
        session_date: "Saturday, 7:00 PM IST",
        room_url: "https://onepageplan.in/room",
        magic_link: "https://onepageplan.in/room",
        unsubscribe_url: "https://onepageplan.in",
      };

      const renderedSubject = renderMustacheWithConditionals(template.subject || "The One Page Plan", sampleVariables);
      const renderedBody = renderMustacheWithConditionals(template.body, sampleVariables);

      const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2D2C28; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="white-space: pre-line;">${renderedBody}</div>
  <div style="margin-top: 32px; padding: 12px; background: #faf8f5; border: 1px dashed #d1c7b7; border-radius: 6px; font-size: 11px; color: #78716c;">
    <strong>[TEST DISPATCH]</strong> Sent from Template Registry console to ${data.recipient.trim()}
  </div>
</body>
</html>`;

      const res = await sendEmailViaResend({
        to: data.recipient.trim(),
        subject: `[TEST] ${renderedSubject}`,
        html: htmlBody,
      });

      if (!res.sent) {
        return { ok: false as const, error: res.error || "Failed to dispatch test email via Resend." };
      }

      return {
        ok: true as const,
        channel: "email" as const,
        messageId: res.id,
        recipient: data.recipient.trim(),
        info: `Test email sent to ${data.recipient.trim()} (Resend ID: ${res.id || "OK"})`,
      };
    }

    if (template.channel === "whatsapp") {
      const { sendWhatsAppTemplate, normaliseWhatsAppPhone } = await import("@/services/whatsapp/whatsapp.server");
      const normalized = normaliseWhatsAppPhone(data.recipient.trim());
      if (!normalized) {
        return {
          ok: false as const,
          error: `Invalid WhatsApp phone: '${data.recipient}'. Please include country code e.g. +919820000000.`,
        };
      }

      // Map parameters based on approved Meta templates
      let bodyParams: string[] = ["Milan"];
      if (template.key === "3p_direct_integration_test") {
        bodyParams = ["Milan"];
      } else if (
        template.key === "webinar_confirmation" ||
        template.key === "webinar_reminder_2h" ||
        template.key === "webinar_reminder_15m" ||
        template.key === "webinar_live_now"
      ) {
        bodyParams = ["Milan", "https://onepageplan.in/room"];
      } else if (template.key === "webinar_missed") {
        bodyParams = ["Milan", "https://onepageplan.in"];
      } else if (template.key === "course_purchase_confirmat") {
        bodyParams = ["Milan", "https://onepageplan.in/course", "https://onepageplan.in"];
      }

      const metaTemplateName = template.metaTemplateName || template.key;
      const lang = template.key === "3p_direct_integration_test" ? "en_US" : (template.metaLanguage || "en");

      const res = await sendWhatsAppTemplate({
        to: normalized,
        templateName: metaTemplateName,
        languageCode: lang,
        bodyParameters: bodyParams,
      });

      if (!res.sent) {
        return { ok: false as const, error: res.error || "Meta WhatsApp Cloud API failed to send test message." };
      }

      return {
        ok: true as const,
        channel: "whatsapp" as const,
        messageId: res.messageId,
        recipient: `+${normalized}`,
        info: `Test WhatsApp sent to +${normalized} (Meta ID: ${res.messageId || "OK"})`,
      };
    }

    return { ok: false as const, error: "Unsupported channel." };
  });

export const adminGetWebinarConfig = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      let activeWebinarId = (process.env["WEBINAR_GG_WEBINAR_ID"] || "").trim() || "cmthk6y4001kos60ybxfkbc67";
      const { data: row } = await db
        .from("app_config" as never)
        .select("value")
        .eq("key" as never, "webinar_id" as never)
        .maybeSingle();
      if ((row as any)?.value && typeof (row as any).value === "string") {
        const val = (row as any).value.trim();
        if (val) activeWebinarId = val;
      }
      return { ok: true as const, webinarId: activeWebinarId };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Failed to load webinar config." };
    }
  });

export const adminUpdateWebinarId = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; webinarId: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    const { error: authError } = await db.rpc("admin_get_email_settings", { p_password: data.password });
    if (authError && unauthorized(authError.message)) {
      return { ok: false as const, error: "Wrong password." };
    }

    try {
      const cleanId = (data.webinarId || "").trim();
      if (!cleanId) {
        return { ok: false as const, error: "Webinar ID cannot be blank." };
      }
      const { error } = await db.from("app_config" as never).upsert(
        { key: "webinar_id", value: cleanId } as never,
        { onConflict: "key" } as never,
      );
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, webinarId: cleanId };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || "Failed to update webinar ID." };
    }
  });
