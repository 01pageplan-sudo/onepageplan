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
        const secret = process.env["WEBHOOK_SHARED_SECRET"];
        const provided =
          request.headers.get("x-webhook-secret") ?? request.headers.get("x-shared-secret") ?? "";
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

          let status: string | null = null;
          if (/join|attend|present|live/.test(event)) status = "attended";
          if (/drop|left|early|exit/.test(event)) status = "dropped_off";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sessionDateISO } = await import("@/lib/session");

          if (!email) {
            console.log("webinar-webhook: no email in payload", JSON.stringify(body)?.slice(0, 500));
            return new Response("ok");
          }

          const { data: match } = await supabaseAdmin
            .from("registrations")
            .select("id")
            .eq("email", email.toLowerCase())
            .eq("session_date", sessionDateISO())
            .maybeSingle();

          if (!match) {
            console.log("webinar-webhook: no matching registration for", email);
            return new Response("ok");
          }

          await supabaseAdmin
            .from("registrations")
            .update({
              raw_webhook: body as never,
              ...(status ? { status } : {}),
            })
            .eq("id", match.id);
        } catch (error) {
          console.error("webinar-webhook error", error);
        }

        return new Response("ok");
      },
    },
  },
});
