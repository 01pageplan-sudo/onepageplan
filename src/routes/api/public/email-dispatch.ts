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
  const rawProvided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("x-webhook-secret") ??
    url.searchParams.get("secret") ??
    "";

  if (!rawProvided.trim()) return new Response("Unauthorized", { status: 401 });

  // Clean provided secret (support URL decoding if passed via query string)
  const cleanProvided = rawProvided.trim();
  let decodedProvided = cleanProvided;
  try {
    decodedProvided = decodeURIComponent(cleanProvided);
  } catch {
    /* ignore */
  }

  // Look for CRON_SECRET case-insensitively from environment
  const findEnvVar = (targetName: string): string | undefined => {
    const target = targetName.toLowerCase();
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toLowerCase() === target && value) return value.trim();
    }
    return undefined;
  };

  const envSecret =
    findEnvVar("CRON_SECRET") ??
    findEnvVar("WEBHOOK_SHARED_SECRET") ??
    findEnvVar("LOVABLE_CRON_SECRET");

  let allowed =
    Boolean(envSecret) &&
    (cleanProvided === envSecret || decodedProvided === envSecret);

  if (!allowed) {
    // 1. Check database app_config table
    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const db = createPublicServerClient();

    const { data: appConfigSecret } = await db
      .from("app_config" as never)
      .select("value")
      .eq("key" as never, "cron_secret")
      .maybeSingle();

    if (appConfigSecret && (appConfigSecret as any).value) {
      const val = String((appConfigSecret as any).value).trim();
      if (cleanProvided === val || decodedProvided === val) {
        allowed = true;
      }
    }

    if (!allowed) {
      const { data: dbCheck } = await db.rpc("verify_cron_secret", {
        p_secret: cleanProvided,
      });
      if (dbCheck === true) allowed = true;
    }

    // 2. Also check if stored in commerce_settings or app_config under other keys
    if (!allowed) {
      const { data: altConfig } = await db
        .from("app_config" as never)
        .select("value")
        .or(`key.eq.CRON_SECRET,key.eq.Cron_secret,key.eq.cron_secret` as never);
      if (altConfig && Array.isArray(altConfig)) {
        for (const item of altConfig) {
          const val = String((item as any).value || "").trim();
          if (val && (cleanProvided === val || decodedProvided === val)) {
            allowed = true;
            break;
          }
        }
      }
    }
  }

  if (!allowed) {
    console.warn("[email-dispatch] Unauthorized request attempt.");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    let legacyResult: unknown = null;
    try {
      const { runDispatch } = await import("@/lib/email-automation.server");
      legacyResult = await runDispatch(40);
    } catch (legacyErr) {
      const legacyMsg =
        legacyErr instanceof Error
          ? legacyErr.message
          : typeof legacyErr === "object"
          ? JSON.stringify(legacyErr)
          : String(legacyErr);
      console.warn("[email-dispatch] Legacy dispatch skipped:", legacyMsg);
      legacyResult = { skipped: true, reason: legacyMsg };
    }

    // Prompt 4: Process scheduled messages queue
    const { processPendingMessages } = await import("@/lib/messaging/scheduler.server");
    const messagingResult = await processPendingMessages(40);

    return Response.json({
      ok: true,
      legacy: legacyResult,
      messagingQueue: messagingResult,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);
    console.error("email-dispatch failed", message);
    return Response.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}
