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

export const adminDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string } & Range) => data)
  .handler(async ({ data }) => {
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

      const mergedLeads = [...leadsList, ...extraNewsletterLeads].sort(
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

