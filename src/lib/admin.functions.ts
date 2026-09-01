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
      p_from: data.from ?? null,
      p_to: data.to ?? null,
    };

    try {
      const [leads, settings, stats, sends] = await Promise.all([
        db.rpc("admin_leads", { p_password: data.password, ...range }),
        db.rpc("admin_get_email_settings", { p_password: data.password }),
        db.rpc("admin_email_stats", { p_password: data.password, ...range }),
        db.rpc("admin_email_sends", { p_password: data.password, ...range, p_limit: 400 }),
      ]);

      const failure = [leads, settings, stats, sends].find((result) => result.error);
      if (failure?.error) {
        if (unauthorized(failure.error.message)) {
          return { ok: false as const, error: "Wrong password." };
        }
        console.error("adminDashboard failed:", failure.error.message);
        return { ok: false as const, error: "Could not load the dashboard." };
      }

      return {
        ok: true as const,
        leads: (leads.data ?? []) as unknown as AdminLead[],
        settings: (settings.data ?? {}) as unknown as AdminSettings,
        stats: (stats.data ?? {}) as unknown as Record<string, number | Record<string, number>>,
        sends: (sends.data ?? []) as unknown as AdminSend[],
      };
    } catch (error) {
      console.error("adminDashboard failed:", error);
      return { ok: false as const, error: "Could not load the dashboard." };
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
      const result = await sendDueEmails(db, Math.min(100, Math.max(1, rows.length)));
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
      const queued = await automation.scheduleSequence(db);
      const result = await automation.sendDueEmails(db, 50);
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
