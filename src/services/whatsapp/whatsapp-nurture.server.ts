import { sendWhatsAppTemplate, normaliseWhatsAppPhone } from "./whatsapp.server";
import { ROOM_URL } from "@/lib/calendar";

export const WHATSAPP_TEMPLATES: Record<string, string> = {
  confirmation: process.env["WHATSAPP_TEMPLATE_CONFIRMATION"] || "webinar_confirmation",
  "reminder-2h": process.env["WHATSAPP_TEMPLATE_REMINDER_2H"] || "webinar_reminder_2h",
  "reminder-15m": process.env["WHATSAPP_TEMPLATE_REMINDER_15M"] || "webinar_reminder_15m",
  live: process.env["WHATSAPP_TEMPLATE_LIVE"] || "webinar_live_now",
  followup: process.env["WHATSAPP_TEMPLATE_FOLLOWUP"] || "webinar_missed",
  "no-show": process.env["WHATSAPP_TEMPLATE_NO_SHOW"] || "webinar_missed",
  purchase: process.env["WHATSAPP_TEMPLATE_PURCHASE"] || "course_purchase_confirmat",
};

export type WhatsAppLead = {
  id: string;
  phone_e164: string;
  full_name: string;
  status?: string;
  whatsapp_consent?: boolean;
};

/**
 * Sends a WhatsApp automated message to a lead and logs the result to whatsapp_sends table.
 * Deduplicates automatically via unique constraint on (registration_id, message_key, occurrence).
 */
export async function sendWhatsAppAutomation(
  db: import("@/lib/supabase-public.server").PublicServerClient,
  lead: WhatsAppLead,
  messageKey: string,
  occurrence = "once",
  customRoomUrl?: string,
): Promise<"sent" | "skipped" | "failed"> {
  if (lead.whatsapp_consent === false || !lead.phone_e164) {
    return "skipped";
  }

  // Skip sales messages if lead has already purchased
  if (lead.status === "purchased" && messageKey !== "purchase") {
    return "skipped";
  }

  const templateName = WHATSAPP_TEMPLATES[messageKey] || messageKey;
  const normalizedPhone = normaliseWhatsAppPhone(lead.phone_e164);
  if (!normalizedPhone) return "skipped";

  const firstName = lead.full_name.trim().split(/\s+/)[0] || "there";
  const webinarUrl = customRoomUrl || ROOM_URL;

  // Insert initial record into whatsapp_sends
  const { data: inserted, error: insertError } = await db
    .from("whatsapp_sends" as never)
    .insert({
      registration_id: lead.id,
      message_key: messageKey,
      occurrence,
      phone: normalizedPhone,
      template_name: templateName,
      status: "sending",
    } as never)
    .select("id")
    .maybeSingle();

  // If already sent or duplicate, skip
  if (insertError && (insertError.code === "23505" || insertError.message?.includes("duplicate"))) {
    return "skipped";
  }

  const recordId = (inserted as { id?: string } | null)?.id;

  // Dispatch through Meta Cloud API
  // Primary attempt: single parameter {{1}} for firstName (CTA button handles room access)
  let result = await sendWhatsAppTemplate({
    to: normalizedPhone,
    templateName,
    bodyParameters: [firstName],
  });

  // Fallback: if Meta reports parameter count mismatch (e.g. if template expects 2 params or 0 params)
  if (!result.sent && result.error && /parameter|mismatch|count|132000/i.test(result.error)) {
    console.log(`[WhatsApp Nurture] Retrying template ${templateName} with 2 parameters (firstName, webinarUrl)...`);
    const retryResult = await sendWhatsAppTemplate({
      to: normalizedPhone,
      templateName,
      bodyParameters: [firstName, webinarUrl],
      buttonUrlParam: webinarUrl.replace("https://onepageplan.in", ""),
    });
    if (retryResult.sent) {
      result = retryResult;
    } else if (retryResult.error && /parameter|mismatch|count|132000/i.test(retryResult.error)) {
      console.log(`[WhatsApp Nurture] Retrying template ${templateName} with 0 parameters (static template)...`);
      const retryStatic = await sendWhatsAppTemplate({
        to: normalizedPhone,
        templateName,
        bodyParameters: [],
      });
      if (retryStatic.sent) {
        result = retryStatic;
      }
    }
  }

  const now = new Date().toISOString();

  if (result.sent) {
    if (recordId) {
      await db
        .from("whatsapp_sends" as never)
        .update({
          status: "sent",
          sent_at: now,
          provider_message_id: result.messageId ?? null,
          error: null,
          updated_at: now,
        } as never)
        .eq("id", recordId);
    }
    return "sent";
  } else {
    if (recordId) {
      await db
        .from("whatsapp_sends" as never)
        .update({
          status: "failed",
          error: result.error ?? "Failed to send via Meta Cloud API",
          updated_at: now,
        } as never)
        .eq("id", recordId);
    }
    return "failed";
  }
}
