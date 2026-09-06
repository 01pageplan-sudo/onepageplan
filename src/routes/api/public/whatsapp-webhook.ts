import { createFileRoute } from "@tanstack/react-router";
import {
  handleWhatsAppGet,
  handleWhatsAppPost,
} from "@/services/whatsapp";

/**
 * Meta WhatsApp Cloud API Webhook Endpoint
 * 
 * Public URL: https://onepageplan.in/api/public/whatsapp-webhook
 * 
 * Handlers:
 * - GET: Meta verification handshake. Validates hub.mode and hub.verify_token
 *   against WHATSAPP_VERIFY_TOKEN and returns hub.challenge.
 * - POST: Inbound notifications from Meta. Immediately responds with 200 OK
 *   and processes incoming messages and delivery status events.
 */
export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: ({ request }) => handleWhatsAppGet(request),
      POST: ({ request }) =>
        handleWhatsAppPost(request, {
          onMessage: async (message, contact, metadata) => {
            console.log(
              `[WhatsApp Inbound] From ${message.from} (${contact?.profile?.name ?? "Unknown"}):`,
              message.text?.body ?? `[${message.type}]`,
            );
            // You can add database logging or automated replies here
          },
          onStatusUpdate: async (status, metadata) => {
            console.log(
              `[WhatsApp Status] Message ${status.id} -> ${status.status} (recipient: ${status.recipient_id})`,
            );
            if (status.status === "failed") {
              console.warn(`[WhatsApp Delivery Failure]`, status.errors);
            }
          },
        }),
    },
  },
});
