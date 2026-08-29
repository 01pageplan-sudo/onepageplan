import { getNextSessionIST, sessionDateISO, formatSessionDayMonth } from "./session";
import { DISCLAIMER_TEXT, buildConfirmationEmail } from "./email-template.server";

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

export function validate(input: RegistrationInput): string | null {
  if (!input.full_name || input.full_name.trim().length < 2) return "Please enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(input.email.trim())) return "Please enter a valid email.";
  if (!/^\d{10}$/.test(input.phone10)) return "Please enter a 10 digit WhatsApp number.";
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

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Upsert on (lower(email), session_date), never downgrading a true consent. */
export async function upsertRegistration(
  supabaseAdmin: Admin,
  row: ReturnType<typeof buildRow>,
): Promise<{ id: string } | null> {
  const { data: existing } = await supabaseAdmin
    .from("registrations")
    .select("id, voice_consent, voice_consent_at, consent_at")
    .eq("email", row.email)
    .eq("session_date", row.session_date)
    .maybeSingle();

  if (existing) {
    const voice = row.voice_consent || existing.voice_consent;
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .update({
        full_name: row.full_name,
        ...(row.phone_e164 ? { phone_e164: row.phone_e164 } : {}),
        whatsapp_consent: row.whatsapp_consent,
        consent_at: row.whatsapp_consent ? (existing.consent_at ?? row.consent_at) : existing.consent_at,
        voice_consent: voice,
        voice_consent_at: voice ? (existing.voice_consent_at ?? row.voice_consent_at) : null,
        profile_type: row.profile_type,
        pain_point: row.pain_point,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function sendConfirmationEmail(
  supabaseAdmin: Admin,
  args: { id: string; email: string; full_name: string },
) {
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Email sending is not configured yet.");

    const webinarUrl = process.env["VITE_WEBINAR_URL"] ?? "https://onepageplan.in/confirmed";
    const firstName = args.full_name.trim().split(/\s+/)[0] ?? "there";
    const { html, text } = buildConfirmationEmail(firstName, webinarUrl);
    const fromEmail = process.env["FROM_EMAIL"] ?? "connect@onepageplan.in";
    const fromName = process.env["FROM_NAME"] ?? "Milan Dodhia";

    const result = await sendLovableEmail(
      {
        to: args.email,
        from: `${fromName} <${fromEmail}>`,
        subject: "Your seat is saved for this Saturday",
        html,
        text,
      },
      { apiKey },
    );

    if (result && result.success === false) {
      throw new Error(String(result.status ?? "not sent"));
    }


    await supabaseAdmin
      .from("registrations")
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq("id", args.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("confirmation email failed:", message);
    await supabaseAdmin
      .from("registrations")
      .update({ email_error: message.slice(0, 500) })
      .eq("id", args.id);
  }
}

export async function sendWhatsApp(
  supabaseAdmin: Admin,
  args: { id: string; phone_e164: string; full_name: string; whatsapp_consent: boolean },
) {
  try {
    if (!args.whatsapp_consent) return;

    const enabled = process.env["WHATSAPP_ENABLED"] === "true";
    const webinarUrl = process.env["VITE_WEBINAR_URL"] ?? "";
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

    await supabaseAdmin
      .from("registrations")
      .update({ whatsapp_sent_at: new Date().toISOString(), whatsapp_error: null })
      .eq("id", args.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("whatsapp send failed:", message);
    await supabaseAdmin
      .from("registrations")
      .update({ whatsapp_error: message.slice(0, 500) })
      .eq("id", args.id);
  }
}

export function sessionChipDate() {
  return formatSessionDayMonth();
}

export { DISCLAIMER_TEXT };
