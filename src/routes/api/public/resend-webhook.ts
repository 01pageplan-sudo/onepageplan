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
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "active",
            endpoint: "/api/public/resend-webhook",
            message: "Resend webhook endpoint is active and listening for Svix events.",
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
      POST: async ({ request }) => {
        const rawSecret = process.env["RESEND_WEBHOOK_SECRET"];
        const secret = rawSecret?.trim().replace(/^["']|["']$/g, "");
        const body = await request.text();

        if (!secret) {
          console.error("resend-webhook: RESEND_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }
        if (!verify(request, body, secret)) {
          console.warn("resend-webhook: Invalid signature received");
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const payload = JSON.parse(body) as {
            type?: string;
            data?: { email_id?: string; id?: string; to?: string[] | string };
          };
          const event = (payload.type ?? "").toLowerCase();
          const providerId = payload.data?.email_id || payload.data?.id || null;
          const to = Array.isArray(payload.data?.to) ? payload.data?.to?.[0] : payload.data?.to;

          console.log(`resend-webhook: processing "${event}" event for ${providerId ?? to}`);

          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const { adminPassword } = await import("@/lib/email-automation.server");
          const db = createPublicServerClient();

          // 1. Call RPC function
          try {
            await db.rpc("record_email_provider_event", {
              p_password: adminPassword(),
              p_event: event,
              p_provider_id: providerId as unknown as string,
              p_email: (to ?? "") as string,
            });
          } catch (rpcErr) {
            console.warn("resend-webhook RPC notice:", rpcErr);
          }

          // 2. Also directly update email_sends row using supabaseAdmin or db
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const adminClient = supabaseAdmin || db;

            // Find target record by provider_id or by email
            let targetId: string | null = null;
            if (providerId) {
              const { data: row } = await adminClient
                .from("email_sends" as never)
                .select("id, status")
                .eq("provider_id" as never, providerId)
                .maybeSingle();
              if (row) targetId = (row as any).id;
            }

            if (!targetId && to) {
              const { data: row } = await adminClient
                .from("email_sends" as never)
                .select("id, status")
                .eq("email" as never, to.toLowerCase().trim())
                .order("sent_at" as never, { ascending: false })
                .limit(1)
                .maybeSingle();
              if (row) targetId = (row as any).id;
            }

            if (targetId) {
              const updateData: Record<string, unknown> = {};
              if (providerId) updateData["provider_id"] = providerId;

              if (event.includes("deliver")) {
                updateData["status"] = "delivered";
                updateData["delivered_at"] = new Date().toISOString();
              } else if (event.includes("open")) {
                updateData["status"] = "opened";
                updateData["opened_at"] = new Date().toISOString();
              } else if (event.includes("click")) {
                updateData["status"] = "clicked";
                updateData["clicked_at"] = new Date().toISOString();
              } else if (event.includes("bounce")) {
                updateData["status"] = "bounced";
              } else if (event.includes("complain")) {
                updateData["status"] = "complained";
              }

              if (Object.keys(updateData).length > 0) {
                await adminClient
                  .from("email_sends" as never)
                  .update(updateData as never)
                  .eq("id" as never, targetId);
                console.log(`resend-webhook: updated email_sends row ${targetId} with`, updateData);
              }
            }
          } catch (dbErr) {
            console.warn("resend-webhook direct update notice:", dbErr);
          }
        } catch (error) {
          console.error("resend-webhook error", error);
        }

        return new Response("ok", { status: 200 });
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
