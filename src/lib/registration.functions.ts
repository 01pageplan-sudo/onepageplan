import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

export type RegisterPayload = {
  full_name: string;
  email: string;
  phone10: string;
  whatsapp_consent: boolean;
  voice_consent: boolean;
  profile_type: string;
  pain_point: string;
  company?: string | undefined;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_content?: string | undefined;
  utm_term?: string | undefined;
  referrer?: string | undefined;
  landing_path?: string | undefined;
};

export const registerAttendee = createServerFn({ method: "POST" })
  .inputValidator((data: RegisterPayload) => data)
  .handler(async ({ data }) => {
    const helpers = await import("./registration.server");

    // Honeypot: pretend everything worked, write nothing.
    if (data.company && data.company.trim() !== "") {
      return { ok: true as const };
    }

    const invalid = helpers.validate(data);
    if (invalid) return { ok: false as const, error: invalid };

    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (helpers.isRateLimited(ip)) {
      return { ok: false as const, error: "Too many attempts. Please try again in a few minutes." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = helpers.buildRow(data);
    const saved = await helpers.upsertRegistration(supabaseAdmin, row);
    if (!saved) return { ok: false as const, error: "Could not save your seat." };

    // Delivery must never fail or delay the registration.
    const delivery = Promise.allSettled([
      helpers.sendConfirmationEmail(supabaseAdmin, {
        id: saved.id,
        email: row.email,
        full_name: row.full_name,
      }),
      helpers.sendWhatsApp(supabaseAdmin, {
        id: saved.id,
        phone_e164: row.phone_e164,
        full_name: row.full_name,
        whatsapp_consent: row.whatsapp_consent && row.phone_e164 !== "",
      }),
    ]);
    await Promise.race([delivery, new Promise((resolve) => setTimeout(resolve, 3000))]);

    return { ok: true as const };
  });

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; source?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      return { ok: false as const, error: "Please enter a valid email address." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert(
        { email, source: data.source ?? "declined_modal" },
        { onConflict: "email" },
      );
    if (error) return { ok: false as const, error: "Could not save that. Please try once more." };
    return { ok: true as const };
  });

export const fetchAdminRegistrations = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected || data.password !== expected) {
      return { ok: false as const, error: "Wrong password." };
    }

    const { sessionDateISO } = await import("./session");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("registrations")
      .select(
        "created_at, full_name, email, phone_e164, whatsapp_consent, voice_consent, profile_type, pain_point, status, email_sent_at",
      )
      .eq("session_date", sessionDateISO())
      .order("created_at", { ascending: false });

    if (error) return { ok: false as const, error: "Could not load registrations." };

    return { ok: true as const, sessionDate: sessionDateISO(), rows: rows ?? [] };
  });
