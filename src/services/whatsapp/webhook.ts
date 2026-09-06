/**
 * WhatsApp Webhook Processor (Direct Meta Cloud API)
 * 
 * Handles:
 * 1. Webhook Verification (GET): Meta sends hub.mode, hub.verify_token, and hub.challenge
 *    to verify server ownership.
 * 2. Webhook Event Ingestion (POST): Meta sends notifications for incoming messages and delivery statuses.
 * 3. Security (Optional): Verifies X-Hub-Signature-256 using HMAC SHA-256 and Meta App Secret.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { getWhatsAppConfig } from "./config.js";
import type {
  WebhookVerificationParams,
  WhatsAppWebhookPayload,
  WhatsAppWebhookHandlers,
  WhatsAppContact,
} from "./types.js";

export type VerificationResult =
  | { success: true; challenge: string; status: 200 }
  | { success: false; error: string; status: 400 | 403 };

/**
 * Handles Meta's GET verification handshake.
 * 
 * Meta issues a GET request with query params:
 *   - hub.mode="subscribe"
 *   - hub.verify_token="<your-configured-verify-token>"
 *   - hub.challenge="<random-challenge-string>"
 * 
 * If valid, your server MUST return the exact hub.challenge value as plain text (status 200).
 * 
 * @param params Query parameters extracted from the GET request URL.
 */
export function verifyWhatsAppWebhook(params: WebhookVerificationParams): VerificationResult {
  const config = getWhatsAppConfig();
  const mode = params["hub.mode"];
  const token = params["hub.verify_token"];
  const challenge = params["hub.challenge"];

  // 1. Ensure required query parameters exist
  if (!mode || !token) {
    return {
      success: false,
      error: "Missing hub.mode or hub.verify_token query parameter",
      status: 400,
    };
  }

  // 2. Check mode is subscribe and verify_token matches environment
  if (mode === "subscribe" && token === config.verifyToken) {
    console.log("[WhatsApp Webhook] Verification successful. Responding with challenge.");
    return {
      success: true,
      challenge: challenge ?? "",
      status: 200,
    };
  }

  console.warn(
    `[WhatsApp Webhook] Verification failed. Received token: "${token?.slice(0, 4)}...", expected: "${config.verifyToken?.slice(0, 4)}..."`,
  );
  return {
    success: false,
    error: "Verification token mismatch or invalid mode",
    status: 403,
  };
}

/**
 * Optional enterprise security: Validates the SHA-256 HMAC signature sent in the
 * 'X-Hub-Signature-256' header against WHATSAPP_APP_SECRET.
 * 
 * @param rawBody The unparsed raw UTF-8 string body of the incoming HTTP request.
 * @param signatureHeader The value of request.headers.get("x-hub-signature-256").
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  const config = getWhatsAppConfig();
  if (!config.appSecret) {
    // If no App Secret is configured, skip HMAC verification (permitted during initial setup)
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    console.warn("[WhatsApp Webhook] Missing or malformed X-Hub-Signature-256 header");
    return false;
  }

  try {
    const signature = signatureHeader.slice(7); // Remove "sha256=" prefix
    const expected = createHmac("sha256", config.appSecret).update(rawBody, "utf8").digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (error) {
    console.error("[WhatsApp Webhook] Error calculating signature HMAC", error);
    return false;
  }
}

/**
 * Safe processor for incoming POST webhook events.
 * 
 * Extracts inbound messages, status changes (delivered, read, failed), and triggers
 * the appropriate user-defined callbacks.
 * 
 * Catches ALL internal errors so that the webhook endpoint can return 200 OK
 * immediately to Meta, preventing retry spam and webhook disablement.
 * 
 * @param rawPayload The parsed JSON body of the webhook.
 * @param handlers Optional lifecycle callbacks for messages and status updates.
 */
export async function processWhatsAppWebhook(
  rawPayload: unknown,
  handlers?: WhatsAppWebhookHandlers,
): Promise<{ processed: boolean; messageCount: number; statusCount: number }> {
  let messageCount = 0;
  let statusCount = 0;

  try {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { processed: false, messageCount, statusCount };
    }

    const payload = rawPayload as WhatsAppWebhookPayload;

    // Meta sends `object: "whatsapp_business_account"`
    if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
      return { processed: false, messageCount, statusCount };
    }

    for (const entry of payload.entry) {
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== "messages" || !change.value) continue;

        const value = change.value;
        const metadata = value.metadata;
        const contactsMap = new Map<string, WhatsAppContact>();

        if (Array.isArray(value.contacts)) {
          for (const contact of value.contacts) {
            contactsMap.set(contact.wa_id, contact);
          }
        }

        // Process incoming messages from users
        if (Array.isArray(value.messages)) {
          for (const message of value.messages) {
            messageCount++;
            const contact = contactsMap.get(message.from);

            console.log(`[WhatsApp Webhook] Inbound message from ${message.from} (${message.type}):`, {
              id: message.id,
              text: message.text?.body,
              button: message.button?.text,
              interactive: message.interactive?.button_reply?.title,
            });

            if (handlers?.onMessage) {
              try {
                await handlers.onMessage(message, contact, metadata);
              } catch (handlerErr) {
                console.error("[WhatsApp Webhook] Handler onMessage threw error:", handlerErr);
              }
            }
          }
        }

        // Process message status updates (sent, delivered, read, failed)
        if (Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            statusCount++;
            console.log(`[WhatsApp Webhook] Status update for message ${status.id}: ${status.status} (recipient: ${status.recipient_id})`);

            if (status.status === "failed") {
              console.warn(`[WhatsApp Webhook] Message ${status.id} delivery failed:`, status.errors);
            }

            if (handlers?.onStatusUpdate) {
              try {
                await handlers.onStatusUpdate(status, metadata);
              } catch (handlerErr) {
                console.error("[WhatsApp Webhook] Handler onStatusUpdate threw error:", handlerErr);
              }
            }
          }
        }
      }
    }

    return { processed: true, messageCount, statusCount };
  } catch (error) {
    console.error("[WhatsApp Webhook] Fatal error in webhook processor:", error);
    if (handlers?.onError) {
      try {
        await handlers.onError(error);
      } catch {
        // Suppress secondary handler errors
      }
    }
    return { processed: false, messageCount, statusCount };
  }
}
