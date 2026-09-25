import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Zoho ZeptoMail Webhook Endpoint
 * Ingests live email delivery, open, click, and bounce events.
 * Endpoint: /api/public/zeptomail-webhook
 */
export const Route = createFileRoute("/api/public/zeptomail-webhook")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "active",
            endpoint: "/api/public/zeptomail-webhook",
            service: "Zoho ZeptoMail Webhook Listener",
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
      POST: async ({ request }) => {
        const rawSecret = process.env["ZEPTOMAIL_WEBHOOK_SECRET"] || process.env["WEBHOOK_SHARED_SECRET"];
        const secret = rawSecret?.trim().replace(/^["']|["']$/g, "");
        const rawBody = await request.text();

        // If secret is set, verify signature
        const signatureHeader =
          request.headers.get("split-signature") ||
          request.headers.get("x-zeptomail-signature") ||
          request.headers.get("x-signature");

        if (secret && signatureHeader) {
          if (!verifyZeptoSignature(rawBody, signatureHeader, secret)) {
            console.warn("[ZeptoMail Webhook] Invalid signature rejected");
            return new Response("Invalid signature", { status: 401 });
          }
        }

        try {
          const payload = JSON.parse(rawBody) as Record<string, unknown>;
          // ZeptoMail sends either direct event or an array of events
          const events = Array.isArray(payload["events"])
            ? (payload["events"] as Record<string, unknown>[])
            : [payload];

          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const { adminPassword } = await import("@/lib/email-automation.server");
          const db = createPublicServerClient();
          const pwd = adminPassword();

          for (const ev of events) {
            const rawEvent = (ev["event_type"] || ev["type"] || ev["event"] || "") as string;
            const event = rawEvent.toLowerCase();
            const email = (
              (ev["email_address"] as string) ||
              (ev["recipient"] as string) ||
              (ev["to"] as string) ||
              ""
            ).toLowerCase();
            const providerId = (ev["message_id"] || ev["request_id"] || ev["id"] || "") as string;
            const clickUrl = (ev["url"] || ev["clicked_url"] || null) as string | null;
            const bounceReason = (ev["reason"] || ev["description"] || null) as string | null;

            console.log(`[ZeptoMail Webhook] Event "${event}" for ${email} (Msg: ${providerId})`);

            // 1. Call standard record_email_provider_event
            await db.rpc("record_email_provider_event", {
              p_password: pwd,
              p_event: event,
              p_provider_id: providerId,
              p_email: email,
            });

            // 2. If click event, also record click details
            if (event.includes("click") && (email || providerId)) {
              await (db.from("email_sends" as never) as any)
                .update({
                  clicked_at: new Date().toISOString(),
                  status: "clicked",
                  clicked_url: clickUrl,
                })
                .match(providerId ? { provider_id: providerId } : { email });
            }

            // 3. If bounce event, record bounced_at
            if (event.includes("bounce") && (email || providerId)) {
              await (db.from("email_sends" as never) as any)
                .update({
                  bounced_at: new Date().toISOString(),
                  status: "bounced",
                  error: bounceReason,
                })
                .match(providerId ? { provider_id: providerId } : { email });
            }
          }
        } catch (err) {
          console.error("[ZeptoMail Webhook] Error processing event:", err);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

function verifyZeptoSignature(body: string, header: string, secret: string): boolean {
  try {
    // ZeptoMail Split-Signature header format: t=<timestamp>,v1=<signature> or <timestamp>.<signature>
    let timestamp = "";
    let signature = "";

    if (header.includes(".")) {
      const parts = header.split(".");
      timestamp = parts[0] ?? "";
      signature = parts[1] ?? "";
    } else if (header.includes("t=") && header.includes("v1=")) {
      const parts = header.split(",");
      for (const p of parts) {
        if (p.startsWith("t=")) timestamp = p.slice(2);
        if (p.startsWith("v1=")) signature = p.slice(3);
      }
    } else {
      signature = header;
    }

    const payloadToSign = timestamp ? `${timestamp}.${body}` : body;
    const computed = createHmac("sha256", secret).update(payloadToSign).digest("hex");

    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
