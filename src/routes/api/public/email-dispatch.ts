import { createFileRoute } from "@tanstack/react-router";

/**
 * The one scheduled endpoint. A cron job calls it every ten minutes; it queues
 * any missing sequence rows and sends whatever is due.
 * Protected by the shared secret, never by route placement.
 */
export const Route = createFileRoute("/api/public/email-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env["WEBHOOK_SHARED_SECRET"] ?? process.env["LOVABLE_CRON_SECRET"];
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("x-webhook-secret") ??
    url.searchParams.get("secret") ??
    "";

  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { runDispatch } = await import("@/lib/email-automation.server");
    const result = await runDispatch(40);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("email-dispatch failed", message);
    return Response.json({ ok: false, error: message.slice(0, 300) }, { status: 500 });
  }
}
