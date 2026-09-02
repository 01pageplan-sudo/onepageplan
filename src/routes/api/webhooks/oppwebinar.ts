import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook Catcher for Webinar.gg live events (user.joined, user.left, etc.).
 * Endpoint: POST /api/webhooks/oppwebinar
 */
export const Route = createFileRoute("/api/webhooks/oppwebinar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          payload = await request.text().catch(() => null);
        }

        // Log the live webhook payload from Webinar.gg
        console.log("[oppwebinar webhook] Event received:", JSON.stringify(payload, null, 2));

        // TODO: Add database insert logic here when webinar_events table is configured.
        // Example: await db.from('webinar_events').insert({ payload, created_at: new Date() });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
