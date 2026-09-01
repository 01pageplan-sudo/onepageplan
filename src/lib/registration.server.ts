import { getNextSessionIST, sessionDateISO, formatSessionDayMonth } from "./session";
import { DISCLAIMER_TEXT, buildConfirmationEmail } from "./email-template.server";
import { getSessionCalendar, ROOM_URL } from "./calendar";

export type RegistrationInput = {
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

const rateBuckets = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return hits.length > 5;
}

const questionBuckets = new Map<string, number[]>();

/** Allow a handful of questions per IP per hour, so shared networks still work. */
export function isQuestionRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (questionBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  questionBuckets.set(ip, hits);
  if (questionBuckets.size > 5000) questionBuckets.clear();
  return hits.length > 5;
}

export function validate(input: RegistrationInput): string | null {
  if (!input.full_name || input.full_name.trim().length < 2) return "Please enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(input.email.trim())) return "Please enter a valid email.";
  if (input.whatsapp_consent && !/^\d{10}$/.test(input.phone10))
    return "Enter exactly 10 digits so I can send the link on WhatsApp.";
  if (!input.profile_type) return "Please tell us what describes you.";
  if (!input.pain_point) return "Please tell us your situation.";
  return null;
}

export function buildRow(input: RegistrationInput) {
  const now = new Date().toISOString();
  const target = getNextSessionIST();
  const hasPhone = /^\d{10}$/.test(input.phone10);
  return {
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone_e164: hasPhone ? `+91${input.phone10}` : "",
    whatsapp_consent: input.whatsapp_consent === true,
    consent_at: input.whatsapp_consent === true ? now : null,
    voice_consent: input.voice_consent === true,
    voice_consent_at: input.voice_consent === true ? now : null,
    profile_type: input.profile_type,
    pain_point: input.pain_point,
    session_date: sessionDateISO(target),
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    utm_content: input.utm_content ?? null,
    utm_term: input.utm_term ?? null,
    referrer: input.referrer ?? null,
    landing_path: input.landing_path ?? null,
  };
}

type Db = import("./supabase-public.server").PublicServerClient;

/** Records whether the email / WhatsApp went out, tolerating any failure. */
async function markDelivery(
  db: Db,
  id: string,
  channel: "email" | "whatsapp",
  sent: boolean,
  error?: string,
) {
  try {
    await db.rpc("mark_registration_delivery", {
      p_id: id,
      p_channel: channel,
      p_sent: sent,
      ...(error ? { p_error: error.slice(0, 500) } : {}),
    });
  } catch (markError) {
    console.error("could not record delivery state:", markError);
  }
}

/** Upsert on (email, session_date) through a database function. */
export async function upsertRegistration(
  db: Db,
  row: ReturnType<typeof buildRow>,
): Promise<{ id: string } | null> {
  const { data, error } = await db.rpc("register_attendee", {
    p: JSON.parse(JSON.stringify(row)) as never,
  });
  if (error) throw error;
  if (!data) return null;
  return { id: data as unknown as string };
}

export async function sendConfirmationEmail(
  db: Db,
  args: { id: string; email: string; full_name: string; session_date?: string | undefined },
) {
  // Preferred path: queue it so the admin dashboard records exactly what went
  // out and can resend it later. Falls back to a direct send if the queue is
  // not usable on this host.
  try {
    const automation = await import("./email-automation.server");
    const sessionDate = args.session_date ?? sessionDateISO(getNextSessionIST());
    const { error } = await db.rpc("queue_emails", {
      p_password: automation.adminPassword(),
      p_rows: JSON.parse(
        JSON.stringify([
          {
            registration_id: args.id,
            email: args.email,
            template: "confirmation",
            session_date: sessionDate,
            scheduled_at: new Date().toISOString(),
            idempotency_key: `${args.id}:confirmation:${sessionDate}`,
          },
        ]),
      ) as never,
    });
    if (error) throw error;
    const result = await automation.sendDueEmails(db, 5);
    if (result.sent > 0) {
      await markDelivery(db, args.id, "email", true);
      return;
    }
    if (result.claimed > 0) throw new Error("queued send did not go out");
  } catch (queueError) {
    console.error(
      "queued confirmation unavailable, sending directly:",
      queueError instanceof Error ? queueError.message : queueError,
    );
  }

  try {
    // Always our own room, never the webinar platform's registration page.
    const webinarUrl = ROOM_URL;

    const firstName = args.full_name.trim().split(/\s+/)[0] ?? "there";
    // Built from the server side session date that was written to the database,
    // never from a value passed in by the browser.
    const calendar = getSessionCalendar(webinarUrl, getNextSessionIST());
    const { html, text } = buildConfirmationEmail(firstName, webinarUrl, calendar.googleUrl);
    const fromEmail = process.env["FROM_EMAIL"] || "connect@onepageplan.in";
    const fromName = process.env["FROM_NAME"] || "Milan Dodhia";
    const from = `${fromName} <${fromEmail}>`;
    const subject = "Your seat is saved for this Saturday";

    const resendKey = process.env["RESEND_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];

    if (resendKey) {
      // Works on any host, including Vercel.
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from, to: [args.email], subject, html, text }),
      });
      if (!response.ok) {
        throw new Error(`Resend responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
    } else if (lovableKey) {
      const { sendLovableEmail } = await import("@lovable.dev/email-js");
      const result = await sendLovableEmail(
        { to: args.email, from, subject, html, text },
        { apiKey: lovableKey },
      );
      if (result && result.success === false) {
        throw new Error(String(result.status ?? "not sent"));
      }
    } else {
      throw new Error("No email provider configured (set RESEND_API_KEY).");
    }

    await markDelivery(db, args.id, "email", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("confirmation email failed:", message);
    await markDelivery(db, args.id, "email", false, message);
  }
}

export async function sendWhatsApp(
  db: Db,
  args: { id: string; phone_e164: string; full_name: string; whatsapp_consent: boolean },
) {
  try {
    if (!args.whatsapp_consent) return;

    const enabled = process.env["WHATSAPP_ENABLED"] === "true";
    const webinarUrl = process.env["VITE_WEBINAR_URL"] || process.env["WEBINAR_URL"] || "";
    const firstName = args.full_name.trim().split(/\s+/)[0] ?? "there";

    if (!enabled) {
      console.log("whatsapp disabled, would have sent:", {
        destination: args.phone_e164,
        userName: args.full_name,
        templateParams: [firstName, webinarUrl],
      });
      return;
    }

    const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: process.env["AISENSY_API_KEY"],
        campaignName: process.env["AISENSY_CAMPAIGN_NAME"],
        destination: args.phone_e164,
        userName: args.full_name,
        templateParams: [firstName, webinarUrl],
      }),
    });

    if (!response.ok) {
      throw new Error(`AiSensy responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    await markDelivery(db, args.id, "whatsapp", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("whatsapp send failed:", message);
    await markDelivery(db, args.id, "whatsapp", false, message);
  }
}


export function sessionChipDate() {
  return formatSessionDayMonth();
}

export { DISCLAIMER_TEXT };
