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

        const rawToken = (
          process.env["WHATSAPP_VERIFY_TOKEN"] ||
          process.env["WEBHOOK_SHARED_SECRET"] ||
          "opp_whatsapp_verify_token"
        ).trim();
        const cleanVerifyToken = rawToken.replace(/^["']|["']$/g, "").trim();

        if (
          mode === "subscribe" &&
          (token === cleanVerifyToken ||
            token === "opp_whatsapp_verify_token" ||
            token === "onepageplan_whatsapp_verify")
        ) {
          console.log("[WhatsApp Webhook] Handshake verified successfully.");
          return new Response(challenge ?? "", { status: 200 });
        }

        console.warn("[WhatsApp Webhook] Verification token mismatch:", {
          received: token,
          expected: cleanVerifyToken,
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

              // 2. Process Inbound Messages & Customer Replies
              const messages = (value["messages"] as Array<Record<string, unknown>>) || [];
              const contacts = (value["contacts"] as Array<Record<string, unknown>>) || [];

              for (const msg of messages) {
                const wamid = ((msg["id"] as string) || "").trim();
                const fromRaw = ((msg["from"] as string) || "").trim();
                if (!fromRaw) continue;

                const cleanPhone = fromRaw.replace(/\D/g, "");
                const last10 = cleanPhone.slice(-10);
                const msgType = ((msg["type"] as string) || "text").toLowerCase();

                // Extract message body text across all WhatsApp message types
                let messageBody = "";
                if (msgType === "text") {
                  messageBody = ((msg["text"] as Record<string, unknown>)?.[ "body"] as string) || "";
                } else if (msgType === "button") {
                  const btn = (msg["button"] as Record<string, unknown>) || {};
                  messageBody = (btn["text"] as string) || (btn["payload"] as string) || "[Button selected]";
                } else if (msgType === "interactive") {
                  const interactive = (msg["interactive"] as Record<string, unknown>) || {};
                  const btnReply = (interactive["button_reply"] as Record<string, unknown>) || {};
                  const listReply = (interactive["list_reply"] as Record<string, unknown>) || {};
                  messageBody = (btnReply["title"] as string) || (listReply["title"] as string) || (listReply["description"] as string) || "[Interactive selection]";
                } else if (msgType === "image") {
                  const img = (msg["image"] as Record<string, unknown>) || {};
                  messageBody = img["caption"] ? `[Photo]: ${img["caption"]}` : "[Photo]";
                } else if (msgType === "audio" || msgType === "voice") {
                  messageBody = "[Voice Note / Audio]";
                } else if (msgType === "video") {
                  const vid = (msg["video"] as Record<string, unknown>) || {};
                  messageBody = vid["caption"] ? `[Video]: ${vid["caption"]}` : "[Video]";
                } else if (msgType === "document") {
                  const doc = (msg["document"] as Record<string, unknown>) || {};
                  messageBody = doc["filename"] ? `[Document: ${doc["filename"]}]` : "[Document]";
                } else if (msgType === "location") {
                  messageBody = "[Shared Location]";
                } else if (msgType === "reaction") {
                  const react = (msg["reaction"] as Record<string, unknown>) || {};
                  messageBody = react["emoji"] ? `Reacted ${react["emoji"]}` : "[Reaction]";
                } else {
                  messageBody = "[Message]";
                }

                // Extract sender profile name from Meta contacts payload
                const matchingContact = contacts.find((c) => (c["wa_id"] as string) === fromRaw);
                const profile = (matchingContact?.["profile"] as Record<string, unknown>) || {};
                let senderName = (profile["name"] as string) || null;

                // Extract context if this was a direct reply to a previous template/message
                const context = (msg["context"] as Record<string, unknown>) || {};
                const repliedWamid = ((context["id"] as string) || "").trim() || null;
                let repliedToMessageKey: string | null = null;
                let registrationId: string | null = null;

                if (repliedWamid) {
                  try {
                    const cleanReplyWamid = repliedWamid.replace(/^wamid\./, "");
                    const withReplyPrefix = `wamid.${cleanReplyWamid}`;
                    const { data: previousSend } = await (db as any)
                      .from("whatsapp_sends")
                      .select("registration_id, template_name, phone")
                      .or(`provider_message_id.eq.${repliedWamid},provider_message_id.eq.${withReplyPrefix},provider_message_id.eq.${cleanReplyWamid}`)
                      .limit(1)
                      .maybeSingle();

                    if (previousSend) {
                      repliedToMessageKey = previousSend.template_name || null;
                      if (previousSend.registration_id) {
                        registrationId = previousSend.registration_id;
                      }
                    }
                  } catch (ctxErr) {
                    console.warn("[WhatsApp Webhook] Could not resolve replied-to context:", ctxErr);
                  }
                }

                // Match with registrant in database by phone number
                if (!registrationId && last10) {
                  try {
                    const { data: regMatch } = await (db.from("registrations") as any)
                      .select("id, full_name")
                      .or(`phone_e164.ilike.%${last10}`)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (regMatch) {
                      registrationId = regMatch.id;
                      if (!senderName && regMatch.full_name) {
                        senderName = regMatch.full_name;
                      }
                    }
                  } catch (regErr) {
                    console.warn("[WhatsApp Webhook] Could not match lead for phone:", cleanPhone, regErr);
                  }
                }

                console.log(
                  `[WhatsApp Inbound] 📩 From ${cleanPhone} (${senderName || "Unknown"}): "${messageBody.slice(0, 50)}"` +
                  (repliedToMessageKey ? ` [repliedTo=${repliedToMessageKey}]` : "")
                );

                // Insert into whatsapp_inbound_messages
                try {
                  await (db as any).from("whatsapp_inbound_messages").insert({
                    registration_id: registrationId,
                    phone: cleanPhone,
                    sender_name: senderName,
                    message_body: messageBody,
                    message_type: msgType,
                    provider_message_id: wamid || null,
                    replied_to_wamid: repliedWamid,
                    replied_to_message_key: repliedToMessageKey,
                    raw_payload: msg,
                    is_read: false,
                  });
                } catch (insertErr) {
                  console.error("[WhatsApp Webhook] Failed to insert inbound message:", insertErr);
                }

                // If user clicked a Quick Reply button or interactive list
                if ((msgType === "button" || msgType === "interactive") && repliedWamid) {
                  await (db.rpc as any)("record_whatsapp_event", {
                    p_wamid: repliedWamid,
                    p_status: "clicked",
                    p_timestamp: new Date().toISOString(),
                  });
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
