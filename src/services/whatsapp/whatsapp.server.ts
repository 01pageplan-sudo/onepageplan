/**
 * Direct Meta WhatsApp Cloud API (Graph API v21.0)
 * Replicates the production-proven implementation from HealthyHabitsReset.
 * No intermediary BSP (AiSensy / Twilio). Connects directly to Meta.
 */

import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_API_VERSION = "v21.0";

export interface WhatsAppTemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  [key: string]: unknown;
}

export interface SendWhatsAppTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  buttonUrlParam?: string;
  headerImageUrl?: string;
}

export interface WhatsAppSendResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normalises phone number for Meta WhatsApp Cloud API.
 * Formats to standard international digits without '+' or spaces, e.g. "919876543210".
 */
export function normaliseWhatsAppPhone(phone: string, defaultCountryCode = "91"): string | null {
  if (!phone) return null;
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  const code = defaultCountryCode.replace(/[^\d]/g, "");
  if (cleaned.length === 10) {
    cleaned = `${code}${cleaned}`;
  }

  if (cleaned.length < 8 || cleaned.length > 16) {
    return null;
  }

  return cleaned;
}

/**
 * Sends a pre-approved template message via Meta WhatsApp Cloud API.
 */
export async function sendWhatsAppTemplate(
  options: SendWhatsAppTemplateOptions,
): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const accessToken = process.env["WHATSAPP_ACCESS_TOKEN"];

  if (!phoneNumberId || !accessToken) {
    console.warn(
      "[WhatsApp Meta] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured.",
    );
    return {
      sent: false,
      error: "WhatsApp credentials (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) are not configured.",
    };
  }

  const normalizedTo = normaliseWhatsAppPhone(options.to);
  if (!normalizedTo) {
    return {
      sent: false,
      error: `Invalid destination phone number: "${options.to}"`,
    };
  }

  const sanitizedTemplate = options.templateName.trim().toLowerCase();
  const requestedLang = (
    options.languageCode ||
    process.env["WHATSAPP_TEMPLATE_LANG"] ||
    "en"
  ).trim();

  const components: Array<Record<string, unknown>> = [];

  if (options.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: options.headerImageUrl },
        },
      ],
    });
  }

  if (options.bodyParameters && options.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: options.bodyParameters.map((text) => ({
        type: "text",
        text: String(text ?? ""),
      })),
    });
  }

  if (options.buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: options.buttonUrlParam,
        },
      ],
    });
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "template",
    template: {
      name: sanitizedTemplate,
      language: { code: requestedLang },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const errObj = data["error"] as Record<string, unknown> | undefined;
      const errorMsg =
        (errObj?.["message"] as string) ||
        (errObj?.["error_user_msg"] as string) ||
        `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}`;

      console.error("[WhatsApp Meta] Send error:", {
        to: normalizedTo,
        template: sanitizedTemplate,
        error: errorMsg,
      });

      return { sent: false, error: errorMsg };
    }

    const messages = data["messages"] as Array<Record<string, unknown>> | undefined;
    const messageId = (messages?.[0]?.["id"] as string) || undefined;

    return messageId ? { sent: true, messageId } : { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp Meta] Network error:", message);
    return { sent: false, error: message };
  }
}

/**
 * Validates Meta Webhook SHA-256 HMAC signature (x-hub-signature-256).
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret?: string | undefined,
): boolean {
  const secret = (appSecret || process.env["WHATSAPP_APP_SECRET"] || "").trim();
  if (!secret) return true; // If secret is not set, allow webhook
  if (!signatureHeader) return false;

  const parts = signatureHeader.split("=");
  const sig = parts.length === 2 ? parts[1] : parts[0];
  if (!sig) return false;

  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(rawBody, "utf8");
    const expected = hmac.digest("hex");

    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
