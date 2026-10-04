import { createFileRoute } from "@tanstack/react-router";

function pick(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

function flatten(input: unknown, depth = 0): Record<string, unknown> {
  if (depth > 3 || input == null || typeof input !== "object") return {};
  let out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value != null && typeof value === "object") {
      out = { ...out, ...flatten(value, depth + 1) };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function handleWebinarWebhookRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const secret = (process.env["WEBHOOK_SHARED_SECRET"] || "").trim();
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-shared-secret") ??
    url.searchParams.get("secret") ??
    "";
  if (secret && provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }

        try {
          const flat = flatten(body);
          const email = pick(flat, ["email", "Email", "attendee_email", "user_email", "emailAddress"]);
          const rawEvent =
            pick(flat, ["event", "status", "type", "action", "attendee_status", "event_type"]) ?? "";
          const event = rawEvent.toLowerCase();
          const webinarId =
            pick(flat, ["webinar_id", "webinarId", "session_id", "sessionId"]) ||
            process.env["WEBINAR_GG_WEBINAR_ID"] ||
            "cmthk6y4001kos60ybxfkbc67";

          let status: string | null = null;
          let eventType = "activity";
          if (/join|attend|present|live/.test(event)) {
            status = "attended";
            eventType = "join";
          } else if (/drop|left|early|exit/.test(event)) {
            status = "dropped_off";
            eventType = "leave";
          } else if (/chat|message/.test(event)) {
            eventType = "chat";
          } else if (/poll/.test(event)) {
            eventType = "poll";
          }

          const rawDuration = flat["duration"] ?? flat["duration_seconds"] ?? flat["time_spent"];
          const durationSeconds = typeof rawDuration === "number" ? rawDuration : 0;

          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const { sessionDateISO } = await import("@/lib/session");
          const db = createPublicServerClient();
          const sessionDate = sessionDateISO();

          // 1. Permanently archive event to webinar_event_logs for historical analysis
          try {
            await db.from("webinar_event_logs" as never).insert({
              webinar_id: webinarId,
              session_date: sessionDate,
              email: email ? email.toLowerCase() : null,
              event_type: eventType,
              event_data: body,
              duration_seconds: durationSeconds,
            } as never);
          } catch (logErr) {
            console.warn("Could not insert into webinar_event_logs:", logErr);
          }

          if (!email) {
            console.log("webinar-webhook: no email in payload", JSON.stringify(body)?.slice(0, 500));
            return new Response("ok");
          }

          // 2. Update current attendee status in registrations
          const { data: matched, error } = await db.rpc("record_webinar_event", {
            p_email: email.toLowerCase(),
            p_session_date: sessionDate,
            p_status: status ?? "",
            p_payload: body as never,
          });

          if (error) throw error;
          if (!matched) {
            console.log("webinar-webhook: no matching registration for", email);
          }

          // Prompt 4: Record attendee in attendance_records and schedule 11:00 AM IST follow-up if attended
          if (status === "attended") {
            try {
              // Ensure deduplication: check if person ever attended or ever received follow-up
              const { data: existingAtt } = await db
                .from("attendance_records" as never)
                .select("id, followup_sent")
                .eq("email" as never, email.toLowerCase())
                .maybeSingle();

              if (!existingAtt) {
                await db.from("attendance_records" as never).insert({
                  email: email.toLowerCase(),
                  session_date: sessionDate,
                } as never);

                // Schedule follow-up at 11:00 AM IST tomorrow
                const tomorrow11Am = new Date();
                tomorrow11Am.setDate(tomorrow11Am.getDate() + 1);
                tomorrow11Am.setUTCHours(5, 30, 0, 0); // 11:00 AM IST

                // Check if user already owns Silver or MRC before scheduling
                const { hasActiveAccess } = await import("@/lib/commerce/pricing.server");
                const hasSilver = await hasActiveAccess(email.toLowerCase(), "silver");
                const hasMrc = await hasActiveAccess(email.toLowerCase(), "money_reality_check");

                if (!hasSilver && !hasMrc) {
                  // Schedule Email follow-up
                  await db.from("scheduled_messages" as never).insert({
                    recipient_email: email.toLowerCase(),
                    template_key: "mrm_reality_check_followup_email",
                    channel: "email",
                    category: "marketing",
                    scheduled_for: tomorrow11Am.toISOString(),
                    status: "pending",
                    context_payload: {
                      first_name: email.split("@")[0],
                      checkout_mrc_url: `https://onepageplan.in/checkout/money-reality-check?email=${encodeURIComponent(email.toLowerCase())}`,
                    },
                  } as never);
                }
              }
            } catch (attErr) {
              console.warn("[Webinar Webhook] Error recording attendance record:", attErr);
            }
          }
        } catch (error) {
          console.error("webinar-webhook error", error);
        }

        return new Response("ok");
}

export const Route = createFileRoute("/api/public/webinar-webhook")({
  server: {
    handlers: {
      GET: async () => new Response("Webinar webhook endpoint active", { status: 200 }),
      POST: async ({ request }) => handleWebinarWebhookRequest(request),
    },
  },
});
