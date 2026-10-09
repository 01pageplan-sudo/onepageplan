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
  oppref?: string | undefined;
};

function safeRequestIP(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const registerAttendee = createServerFn({ method: "POST" })
  .inputValidator((data: RegisterPayload) => data)
  .handler(async ({ data }) => {
    try {
      const helpers = await import("./registration.server");

      // Honeypot: pretend everything worked, write nothing.
      if (data.company && data.company.trim() !== "") {
        return { ok: true as const, registrationId: null };
      }

      const invalid = helpers.validate(data);
      if (invalid) return { ok: false as const, error: invalid };

      if (helpers.isRateLimited(safeRequestIP())) {
        return {
          ok: false as const,
          error: "Too many attempts. Please try again in a few minutes.",
        };
      }

      const { createPublicServerClient } = await import("./supabase-public.server");
      const db = createPublicServerClient();
      const row = helpers.buildRow(data);

      // Check if prospect is already registered by email or phone
      const existing = await helpers.findExistingRegistration(db, row.email, row.session_date, row.phone_e164);
      if (existing) {
        // Update contact preferences silently without re-sending duplicate confirmation emails/WhatsApps
        const saved = await helpers.upsertRegistration(db, row);
        return {
          ok: true as const,
          registrationId: saved?.id ?? (existing as any).id ?? null,
          alreadyRegistered: true as const,
        };
      }

      const saved = await helpers.upsertRegistration(db, row);
      if (!saved) return { ok: false as const, error: "Could not save your seat." };

      // Delivery must never fail or delay the registration.
      const siteUrl = (process.env["VITE_SITE_URL"] || "https://onepageplan.in").replace(/\/+$/, "");
      const sourceUrl = `${siteUrl}${row.landing_path && row.landing_path.startsWith("/") ? row.landing_path : "/confirmed"}`;
      const { sendChatGPTRegistrationEvent } = await import("./chatgpt-conversion.server");

      const delivery = Promise.allSettled([
        helpers.sendConfirmationEmail(db, {
          id: saved.id,
          email: row.email,
          full_name: row.full_name,
        }),
        helpers.sendWhatsApp(db, {
          id: saved.id,
          phone_e164: row.phone_e164,
          full_name: row.full_name,
          whatsapp_consent: row.whatsapp_consent && row.phone_e164 !== "",
        }),
        sendChatGPTRegistrationEvent({
          id: saved.id,
          source_url: sourceUrl,
          oppref: data.oppref,
        }),
      ]);
      await Promise.race([delivery, new Promise((resolve) => setTimeout(resolve, 3000))]);

      return { ok: true as const, registrationId: saved.id, alreadyRegistered: false as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("registerAttendee failed:", message);
      return {
        ok: false as const,
        error: "We could not save your seat just now. Please try once more.",
      };
    }
  });

export const submitPreworkQuestion = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      question: string;
      registration_id?: string | null | undefined;
      email?: string | null | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const question = (data.question ?? "").trim();
      if (question.length === 0) {
        return { ok: false as const, error: "Please type your question first." };
      }

      const helpers = await import("./registration.server");
      if (helpers.isQuestionRateLimited(safeRequestIP())) {
        return { ok: false as const, error: "You have already sent a question. Thank you." };
      }

      const email = (data.email ?? "").trim().toLowerCase();
      const registrationId =
        typeof data.registration_id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          data.registration_id,
        )
          ? data.registration_id
          : null;

      const { createPublicServerClient } = await import("./supabase-public.server");
      const { error } = await createPublicServerClient().rpc("submit_prework_question", {
        p_question: question.slice(0, 500),
        ...(registrationId ? { p_registration_id: registrationId } : {}),
        ...(email === "" ? {} : { p_email: email }),
      });
      if (error) throw error;

      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("submitPreworkQuestion failed:", message);
      return { ok: false as const, error: "That did not send. Please try once more." };
    }
  });


export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      email: string;
      full_name?: string | undefined;
      name?: string | undefined;
      source?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const fullName = (data.full_name ?? data.name ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      return { ok: false as const, error: "Please enter a valid email address." };
    }
    const { createPublicServerClient } = await import("./supabase-public.server");
    const db = createPublicServerClient();

    // 1) RPC call to subscribe_newsletter
    try {
      await db.rpc("subscribe_newsletter", {
        p_email: email,
        p_source: data.source ?? "declined_modal",
        p_full_name: fullName,
      } as never);
    } catch {
      try {
        await db.rpc("subscribe_newsletter", {
          p_email: email,
          p_source: data.source ?? "declined_modal",
        } as never);
      } catch {
        /* proceed to direct table operations below */
      }
    }

    // Direct table upsert into newsletter_subscribers with full_name
    try {
      await db.from("newsletter_subscribers").upsert(
        {
          email,
          source: data.source ?? "declined_modal",
          full_name: fullName,
        } as never,
        { onConflict: "email" },
      );
    } catch {
      /* ignore if column not present yet */
    }

    // 2) Also save into registrations table so it is instantly fetched by admin_leads & visible in Admin UI
    try {
      const { sessionDateISO } = await import("./session");
      const sessionDate = sessionDateISO();

      const { data: existing } = await db
        .from("registrations")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!existing) {
        await db.from("registrations").insert({
          full_name: fullName || "Subscriber",
          email: email,
          phone_e164: "",
          whatsapp_consent: false,
          voice_consent: false,
          profile_type: "Newsletter (Declined Modal)",
          pain_point: "I want someone to tell me which stock or fund to buy",
          status: "subscribed",
          session_date: sessionDate,
          utm_source: data.source ?? "declined_modal",
        } as never);
      } else if (fullName) {
        await db
          .from("registrations")
          .update({ full_name: fullName } as never)
          .eq("id", existing.id);
      }

      // Send S2-01 email ("I said no. Here is what I am saying instead.")
      const helpers = await import("./registration.server");
      void helpers.sendOption2WelcomeEmail(db, {
        id: existing?.id,
        email,
        full_name: fullName,
      });
    } catch (err) {
      console.error("Failed to insert newsletter subscriber into registrations:", err);
    }

    return { ok: true as const };
  });

export const fetchAdminRegistrations = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { sessionDateISO } = await import("./session");
    const { createPublicServerClient } = await import("./supabase-public.server");
    const sessionDate = sessionDateISO();

    try {
      const { data: rows, error } = await createPublicServerClient().rpc("admin_registrations", {
        p_password: data.password,
        p_session_date: sessionDate,
      });

      if (error) {
        if ((error.message ?? "").includes("unauthorized")) {
          return { ok: false as const, error: "Wrong password." };
        }
        console.error("fetchAdminRegistrations failed:", error.message);
        return { ok: false as const, error: "Could not load registrations." };
      }

      return { ok: true as const, sessionDate, rows: rows ?? [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("fetchAdminRegistrations failed:", message);
      return { ok: false as const, error: "Could not load registrations." };
    }
  });
