import { createFileRoute } from "@tanstack/react-router";

/**
 * Join token for the webinar player.
 * Alias of /api/webinar-token, kept because external docs and the Vercel
 * setup notes reference this path. The API key never leaves the server.
 */
export const Route = createFileRoute("/api/get-webinar-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          process.env["WEBINAR_GG_API_KEY"] || process.env["WEBINAR_GG_API_TOKEN"] || "";
        let webinarId =
          (process.env["WEBINAR_GG_WEBINAR_ID"] || "").trim() || "cmthk6y4001kos60ybxfkbc67";

        try {
          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const client = createPublicServerClient();
          const { data: wRow } = await client
            .from("app_config" as never)
            .select("value")
            .eq("key" as never, "webinar_id" as never)
            .maybeSingle();
          if ((wRow as any)?.value && typeof (wRow as any).value === "string" && (wRow as any).value.trim()) {
            webinarId = (wRow as any).value.trim();
          } else {
            // Check email_settings joining_link
            const { data: eRow } = await client
              .from("email_settings" as never)
              .select("joining_link")
              .eq("id" as never, 1 as never)
              .maybeSingle();
            if ((eRow as any)?.joining_link) {
              const link = String((eRow as any).joining_link).trim();
              const match = link.match(/(?:room|embed)\/([a-zA-Z0-9]+)/i);
              if (match && match[1]) {
                webinarId = match[1];
              } else if (/^[a-zA-Z0-9]{15,40}$/.test(link)) {
                webinarId = link;
              }
            }
          }
        } catch {
          /* fallback to env */
        }

        if (!apiKey) {
          console.error("get-webinar-token: WEBINAR_GG_API_KEY is not set");
          return Response.json({ error: "not_configured" }, { status: 500 });
        }

        let name = "";
        let email = "";
        let phone = "";
        try {
          const body = (await request.json()) as {
            name?: unknown;
            email?: unknown;
            phone?: unknown;
          };
          name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
          email =
            typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
          phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : "";
        } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
          return Response.json({ error: "invalid_email" }, { status: 400 });
        }

        const testMode =
          (process.env["VITE_ROOM_TEST_MODE"] ?? process.env["ROOM_TEST_MODE"] ?? "false").trim() ===
          "true";

        if (!testMode) {
          const { sessionDateISO } = await import("@/lib/session");
          const { createPublicServerClient } = await import("@/lib/supabase-public.server");
          const { data: details, error: lookupError } = await createPublicServerClient().rpc(
            "lookup_registration_details_for_room" as never,
            { p_email: email, p_session_date: sessionDateISO() } as never,
          );
          if (lookupError) {
            console.error("get-webinar-token lookup error:", lookupError.message);
            return Response.json({ error: "lookup_failed" }, { status: 500 });
          }
          const record = (details ?? null) as { full_name?: string; phone_e164?: string } | null;
          if (!record?.full_name) {
            return Response.json({ error: "not_registered" }, { status: 403 });
          }
          if (!name && record.full_name) name = record.full_name;
          if (!phone && record.phone_e164) phone = record.phone_e164;
        }

        const full = name || "Guest Attendee";
        const parts = full.trim().split(/\s+/);
        const upstream = await fetch("https://webinar-api.webinar.gg/api/v1/webinar/join-token", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            webinarId,
            firstName: parts[0] || "Guest",
            lastName: parts.length > 1 ? parts.slice(1).join(" ") : "Attendee",
            name: full,
            email,
            phone: phone || "+910000000000",
            passcode: (process.env["WEBINAR_GG_PASSCODE"] || "").trim(),
          }),
        });

        const raw = await upstream.text();
        if (!upstream.ok) {
          console.error("webinar.gg join-token failed", upstream.status, raw);
          return Response.json({ error: "token_failed", detail: raw.slice(0, 500) }, { status: 502 });
        }

        let token = "";
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const nested = (parsed["data"] ?? {}) as Record<string, unknown>;
          const candidate =
            parsed["token"] ?? parsed["joinToken"] ?? nested["token"] ?? nested["joinToken"];
          if (typeof candidate === "string") token = candidate;
        } catch {
          token = raw.trim();
        }

        if (!token) {
          console.error("webinar.gg join-token: no token in response", raw);
          return Response.json({ error: "token_failed" }, { status: 502 });
        }

        return Response.json({ token, webinarId }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
