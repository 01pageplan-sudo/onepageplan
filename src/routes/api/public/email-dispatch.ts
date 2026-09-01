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
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("x-webhook-secret") ??
    url.searchParams.get("secret") ??
    "";

  if (provided === "") return new Response("Unauthorized", { status: 401 });

  const envSecret = process.env["WEBHOOK_SHARED_SECRET"] ?? process.env["LOVABLE_CRON_SECRET"];
  let allowed = Boolean(envSecret) && provided === envSecret;

  if (!allowed) {
    // The scheduler inside the database uses its own key.
    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const { data, error } = await createPublicServerClient().rpc("verify_cron_secret", {
      p_secret: provided,
    });
    if (error) console.error("email-dispatch secret check failed", error.message);
    allowed = data === true;
  }

  if (!allowed) return new Response("Unauthorized", { status: 401 });

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
