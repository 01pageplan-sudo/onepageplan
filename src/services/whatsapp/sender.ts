/**
 * WhatsApp Message Sender Service (Direct Meta Cloud API v19.0)
 * 
 * Sends messages directly to Meta's WhatsApp Graph API endpoint:
 * POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
 * 
 * Does NOT depend on any intermediary (e.g., AiSensy, Twilio).
 */

import { getWhatsAppConfig } from "./config.js";
import type {
  WhatsAppOutgoingMessage,
  WhatsAppSendResponse,
  WhatsAppApiErrorResponse,
  WhatsAppTemplateComponent,
  WhatsAppReadReceiptPayload,
} from "./types.js";

/**
 * Custom error class capturing Meta Graph API error details.
 */
export class WhatsAppApiError extends Error {
  public readonly code: number;
  public readonly errorSubcode?: number | undefined;
  public readonly fbtraceId?: string | undefined;
  public readonly rawError: unknown;

  constructor(
    message: string,
    code: number,
    errorSubcode?: number | undefined,
    fbtraceId?: string | undefined,
    rawError?: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
    this.code = code;
    this.errorSubcode = errorSubcode;
    this.fbtraceId = fbtraceId;
    this.rawError = rawError;
  }
}

/**
 * Normalizes a phone number for the WhatsApp Cloud API.
 * Meta expects numbers in international format digits-only without a leading '+'.
 * Examples:
 *   "+91 98765 43210" -> "919876543210"
 *   "91-9876543210"   -> "919876543210"
 *   "9876543210" (10-digit Indian number) -> "919876543210" (if defaultCountryCode provided)
 */
export function normalizeWhatsAppPhoneNumber(phone: string, defaultCountryCode = "91"): string {
  // Strip all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If user provided a 10-digit number (common in India), prepend the country code
  if (cleaned.length === 10 && defaultCountryCode) {
    cleaned = `${defaultCountryCode}${cleaned}`;
  }

  return cleaned;
}

export type SendWhatsAppMessageParams = {
  /**
   * Recipient phone number in E.164 format (with or without '+', e.g. "+919876543210" or "919876543210")
   */
  to: string;

  /**
   * Outgoing payload specification (excluding 'messaging_product' and 'to', which are injected automatically)
   */
  message:
    | {
        type: "text";
        text: { body: string; preview_url?: boolean };
      }
    | {
        type: "template";
        template: {
          name: string;
          language: { code: string };
          components?: WhatsAppTemplateComponent[];
        };
      }
    | {
        type: "interactive";
        interactive: WhatsAppOutgoingMessage["interactive"];
      }
    | {
        type: "image" | "document" | "audio" | "video";
        [key: string]: unknown;
      };
};

/**
 * Core reusable function to send an outgoing WhatsApp message via Meta Cloud API.
 * 
 * Endpoint: POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
 * 
 * @example
 * ```ts
 * const res = await sendWhatsAppMessage({
 *   to: "+919876543210",
 *   message: {
 *     type: "text",
 *     text: { body: "Hello from direct Meta WhatsApp Cloud API!" }
 *   }
 * });
 * console.log("Sent wamid:", res.messages[0]?.id);
 * ```
 */
export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams,
): Promise<WhatsAppSendResponse> {
  const config = getWhatsAppConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error(
      "WhatsApp Cloud API credentials not configured. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your environment.",
    );
  }

  const normalizedTo = normalizeWhatsAppPhoneNumber(params.to);
  if (!normalizedTo) {
    throw new Error(`Invalid recipient phone number provided: "${params.to}"`);
  }

  const endpoint = `${config.graphBaseUrl}/${config.phoneNumberId}/messages`;

  const payload: WhatsAppOutgoingMessage = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    ...params.message,
  } as WhatsAppOutgoingMessage;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(`Network failure calling Meta WhatsApp Cloud API at ${endpoint}: ${message}`);
  }

  const rawText = await response.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Meta WhatsApp API returned invalid JSON (HTTP ${response.status}): ${rawText.slice(0, 300)}`,
    );
  }

  if (!response.ok) {
    const errorPayload = parsed as WhatsAppApiErrorResponse;
    const err = errorPayload?.error;
    const errMsg = err?.message || `Meta WhatsApp API returned HTTP ${response.status}`;
    const errCode = err?.code || response.status;
    const errSubcode = err?.error_subcode;
    const fbtraceId = err?.fbtrace_id;
    const details = err?.error_data?.details;

    const fullMessage = details
      ? `${errMsg} (Code: ${errCode}${errSubcode ? `, Subcode: ${errSubcode}` : ""}, Details: ${details}) [Trace: ${fbtraceId ?? "N/A"}]`
      : `${errMsg} (Code: ${errCode}${errSubcode ? `, Subcode: ${errSubcode}` : ""}) [Trace: ${fbtraceId ?? "N/A"}]`;

    console.error("[WhatsApp Cloud API Error]", fullMessage, { endpoint, to: normalizedTo });
    throw new WhatsAppApiError(fullMessage, errCode, errSubcode, fbtraceId, parsed);
  }

  return parsed as WhatsAppSendResponse;
}

/**
 * Convenience helper: Send a standard 1-on-1 text message.
 * Note: Free-form text messages can only be sent within an open 24-hour customer service
 * window (i.e. after the user has messaged your business number). For business-initiated
 * messages outside this window, use `sendTemplateMessage`.
 */
export async function sendTextMessage(
  to: string,
  body: string,
  previewUrl = false,
): Promise<WhatsAppSendResponse> {
  return sendWhatsAppMessage({
    to,
    message: {
      type: "text",
      text: {
        body,
        preview_url: previewUrl,
      },
    },
  });
}

/**
 * Convenience helper: Send a pre-approved WhatsApp Template message.
 * Mandatory for business-initiated conversations (e.g. registration confirmations, webinars).
 * 
 * @example
 * ```ts
 * await sendTemplateMessage("+919876543210", {
 *   name: "masterclass_confirmation",
 *   languageCode: "en",
 *   components: [
 *     {
 *       type: "body",
 *       parameters: [
 *         { type: "text", text: "Milan" },
 *         { type: "text", text: "https://onepageplan.in/room" },
 *       ]
 *     }
 *   ]
 * });
 * ```
 */
export async function sendTemplateMessage(
  to: string,
  template: {
    name: string;
    languageCode?: string;
    components?: WhatsAppTemplateComponent[];
  },
): Promise<WhatsAppSendResponse> {
  return sendWhatsAppMessage({
    to,
    message: {
      type: "template",
      template: {
        name: template.name,
        language: {
          code: template.languageCode ?? "en",
        },
        ...(template.components ? { components: template.components } : {}),
      },
    },
  });
}

export type ApprovedSessionTemplateName =
  | "mrm_reg_confirmed"
  | "mrm_reminder_friday"
  | "mrm_reminder_1hr"
  | "mrm_live_now";

/**
 * Convenience helper: Send one of the approved Masterclass WhatsApp templates
 * with {{1}} parameter filled with the recipient's first name.
 */
export async function sendSessionWhatsAppTemplate(
  to: string,
  templateName: ApprovedSessionTemplateName,
  firstName: string,
): Promise<WhatsAppSendResponse> {
  return sendTemplateMessage(to, {
    name: templateName,
    languageCode: "en",
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: firstName }],
      },
    ],
  });
}

/**
 * Marks an inbound message as read.
 * This changes the checkmarks to double blue on the user's phone, signalling
 * that the business has seen and acknowledged the message.
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  const config = getWhatsAppConfig();
  if (!config.accessToken || !config.phoneNumberId) return false;

  const endpoint = `${config.graphBaseUrl}/${config.phoneNumberId}/messages`;
  const payload: WhatsAppReadReceiptPayload = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.warn("[WhatsApp markMessageAsRead failed]", error);
    return false;
  }
}
