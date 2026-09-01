import { createFileRoute } from "@tanstack/react-router";

/**
 * Live event catcher for webinar.gg (user.joined, user.left, and so on).
 * Public on purpose: the provider calls it. It only logs, never writes, so
 * there is nothing to abuse here yet. Set WEBHOOK_SHARED_SECRET to require
 * the x-webhook-secret header once the provider supports sending it.
 */
export const Route = createFileRoute("/api/public/oppwebinar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = (process.env["WEBHOOK_SHARED_SECRET"] || "").trim();
        if (expected) {
          const given = request.headers.get("x-webhook-secret") ?? "";
          if (given !== expected) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          payload = await request.text().catch(() => null);
        }

        // Visible in the server function logs. TODO: insert into a
        // webinar_events table once the event shapes are confirmed.
        console.log("[oppwebinar] event received:", JSON.stringify(payload));

        return new Response("ok", { status: 200 });
      },
    },
  },
});
