import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Resend delivery events: opens, bounces, complaints, deliveries.
 * Verified with the Svix style signature Resend sends, using the signing
 * secret stored as RESEND_WEBHOOK_SECRET.
 */
export const Route = createFileRoute("/api/public/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        const body = await request.text();

        if (!secret) {
          console.error("resend-webhook: RESEND_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }
        if (!verify(request, body, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const payload = JSON.parse(body) as {
            type?: string;
            data?: { email_id?: string; to?: string[] | string };
          };
          const event = (payload.type ?? "").toLowerCase();
          const providerId = payload.data?.email_id ?? null;
          const to = Array.isArray(payload.data?.to) ? payload.data?.to?.[0] : payload.data?.to;

          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const { adminPassword } = await import("@/lib/email-automation.server");

          const { error } = await createPublicServerClient().rpc("record_email_provider_event", {
            p_password: adminPassword(),
            p_event: event,
            p_provider_id: providerId as unknown as string,
            p_email: (to ?? "") as string,
          });
          if (error) throw error;
        } catch (error) {
          console.error("resend-webhook error", error);
        }

        return new Response("ok");
      },
    },
  },
});

function verify(request: Request, body: string, secret: string): boolean {
  const id = request.headers.get("svix-id") ?? "";
  const timestamp = request.headers.get("svix-timestamp") ?? "";
  const signatureHeader = request.headers.get("svix-signature") ?? "";
  if (!id || !timestamp || !signatureHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .some((candidate) => {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
}
