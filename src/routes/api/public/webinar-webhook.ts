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

export const Route = createFileRoute("/api/public/webinar-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = (process.env["WEBHOOK_SHARED_SECRET"] || "").trim();
        const provided =
          request.headers.get("x-webhook-secret") ??
          request.headers.get("x-shared-secret") ??
          url.searchParams.get("secret") ??
          "";
        if (!secret || provided !== secret) {
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
        } catch (error) {
          console.error("webinar-webhook error", error);
        }

        return new Response("ok");
      },
    },
  },
});
