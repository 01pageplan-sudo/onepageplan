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
        const webinarId =
          (process.env["WEBINAR_GG_WEBINAR_ID"] || "").trim() || "cmthk6y4001kos60ybxfkbc67";

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
