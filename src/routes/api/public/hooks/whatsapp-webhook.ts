import { createFileRoute } from "@tanstack/react-router";
import {
  handleWhatsAppWebhookGet,
  handleWhatsAppWebhookPost,
} from "../whatsapp-webhook";

/**
 * Meta WhatsApp Cloud API Webhook Alias (HealthyHabitsReset style)
 * 
 * Public URL: https://www.onepageplan.in/api/public/hooks/whatsapp-webhook
 */
export const Route = createFileRoute("/api/public/hooks/whatsapp-webhook")({
  server: {
    handlers: {
      GET: ({ request }) => handleWhatsAppWebhookGet(request),
      POST: ({ request }) => handleWhatsAppWebhookPost(request),
    },
  },
});
