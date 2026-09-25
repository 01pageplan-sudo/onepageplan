import { createFileRoute } from "@tanstack/react-router";
import { verifyMetaSignature } from "@/services/whatsapp/whatsapp.server";

/**
 * Meta WhatsApp Cloud API Webhook Endpoint
 * 
 * Public URL: https://onepageplan.in/api/public/whatsapp-webhook
 * 
 * Handles:
 * - GET: Meta verification handshake (hub.mode, hub.verify_token, hub.challenge)
 * - POST: Live delivery status updates (sent, delivered, read, failed) & CTA/button clicks
 */
export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const verifyToken = (
          process.env["WHATSAPP_VERIFY_TOKEN"] ||
          process.env["WEBHOOK_SHARED_SECRET"] ||
          "onepageplan_whatsapp_verify"
        ).trim();

        if (mode === "subscribe" && token === verifyToken) {
          console.log("[WhatsApp Webhook] Handshake verified successfully.");
          return new Response(challenge ?? "", { status: 200 });
        }

        console.warn("[WhatsApp Webhook] Verification token mismatch:", {
          received: token,
          expected: verifyToken,
        });
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");

        if (!verifyMetaSignature(rawBody, signature)) {
          console.warn("[WhatsApp Webhook] Rejected request with invalid HMAC signature");
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const body = JSON.parse(rawBody) as Record<string, unknown>;
          const entries = (body["entry"] as Array<Record<string, unknown>>) || [];

          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const db = createPublicServerClient();

          for (const entry of entries) {
            const changes = (entry["changes"] as Array<Record<string, unknown>>) || [];
            for (const change of changes) {
              const value = (change["value"] as Record<string, unknown>) || {};

              // 1. Process Status Updates (sent, delivered, read, failed)
              const statuses = (value["statuses"] as Array<Record<string, unknown>>) || [];
              for (const statusObj of statuses) {
                const wamid = (statusObj["id"] as string) || "";
                const status = ((statusObj["status"] as string) || "").toLowerCase();
                const timestampSec = Number(statusObj["timestamp"]) || Date.now() / 1000;
                const isoTimestamp = new Date(timestampSec * 1000).toISOString();
                const errors = statusObj["errors"] as Array<Record<string, unknown>> | undefined;
                const errorDetail = errors?.[0]
                  ? `${errors[0]["title"] || ""}: ${errors[0]["message"] || ""}`
                  : null;

                console.log(`[WhatsApp Status] WAMID: ${wamid} -> ${status}`);

                if (wamid) {
                  await (db.rpc as any)("record_whatsapp_event", {
                    p_wamid: wamid,
                    p_status: status,
                    p_timestamp: isoTimestamp,
                    p_error: errorDetail,
                  });
                }
              }

              // 2. Process Inbound Messages & Button / CTA Clicks
              const messages = (value["messages"] as Array<Record<string, unknown>>) || [];
              for (const msg of messages) {
                const from = (msg["from"] as string) || "";
                const msgType = (msg["type"] as string) || "";
                const context = (msg["context"] as Record<string, unknown>) || {};
                const repliedWamid = (context["id"] as string) || "";

                console.log(`[WhatsApp Inbound] From ${from} (${msgType})`);

                // If user clicked a Quick Reply button or interactive list
                if (msgType === "button" || msgType === "interactive") {
                  if (repliedWamid) {
                    await (db.rpc as any)("record_whatsapp_event", {
                      p_wamid: repliedWamid,
                      p_status: "clicked",
                      p_timestamp: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("[WhatsApp Webhook] Processing error:", err);
        }

        // Meta expects a quick 200 OK
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
