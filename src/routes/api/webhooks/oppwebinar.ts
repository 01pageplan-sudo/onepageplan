import { createFileRoute } from "@tanstack/react-router";
import { handleWebinarWebhookRequest } from "@/routes/api/public/webinar-webhook";

export const Route = createFileRoute("/api/webhooks/oppwebinar")({
  server: {
    handlers: {
      GET: async () => new Response("Webinar webhook endpoint active", { status: 200 }),
      POST: async ({ request }) => handleWebinarWebhookRequest(request),
    },
  },
});
