import { createFileRoute } from "@tanstack/react-router";

export type WebinarMetrics = {
  totalUsers: number | null;
  peakUsers: number | null;
  durationMinutes: number | null;
  raw: unknown;
};

/**
 * Read-only analytics for the masterclass webinar.
 * GET /api/get-webinar-metrics?id=<webinarId>  (id is optional, defaults to env)
 */
export const Route = createFileRoute("/api/get-webinar-metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey =
          process.env["WEBINAR_GG_API_KEY"] || process.env["WEBINAR_GG_API_TOKEN"] || "";
        const url = new URL(request.url);
        const id =
          (url.searchParams.get("id") || "").trim() ||
          (process.env["WEBINAR_GG_WEBINAR_ID"] || "").trim() ||
          "cmthk6y4001kos60ybxfkbc67";

        if (!apiKey) {
          return Response.json({ error: "not_configured" }, { status: 500 });
        }
        if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }

        let upstream: Response;
        try {
          upstream = await fetch(
            `https://webinar-api.webinar.gg/api/v1/webinar/${id}/metrics`,
            { headers: { authorization: `Bearer ${apiKey}` } },
          );
        } catch (error) {
          console.error("get-webinar-metrics fetch failed:", error);
          return Response.json({ error: "upstream_unreachable" }, { status: 502 });
        }

        const raw = await upstream.text();
        if (!upstream.ok) {
          console.error("get-webinar-metrics failed", upstream.status, raw);
          return Response.json(
            { error: "metrics_failed", status: upstream.status, detail: raw.slice(0, 500) },
            { status: 502 },
          );
        }

        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "bad_upstream_payload" }, { status: 502 });
        }

        const data = ((parsed["data"] ?? parsed) ?? {}) as Record<string, unknown>;
        const num = (...keys: string[]): number | null => {
          for (const key of keys) {
            const value = data[key];
            if (typeof value === "number" && Number.isFinite(value)) return value;
            if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
              return Number(value);
            }
          }
          return null;
        };

        const payload: WebinarMetrics = {
          totalUsers: num("totalUsers", "totalAttendees", "attendees", "registrations"),
          peakUsers: num("peakUsers", "peakLiveUsers", "maxConcurrentUsers", "peakConcurrent"),
          durationMinutes: num("durationMinutes", "duration", "lengthMinutes"),
          raw: parsed,
        };

        return Response.json(payload, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
