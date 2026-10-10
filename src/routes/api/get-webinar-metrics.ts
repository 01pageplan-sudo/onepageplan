import { createFileRoute } from "@tanstack/react-router";

export type WebinarMetrics = {
  totalUsers: number | null;
  peakUsers: number | null;
  durationMinutes: number | null;
  droppedOffUsers?: number | null;
  avgWatchMinutes?: number | null;
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
        let id = (url.searchParams.get("id") || "").trim();

        const { createPublicServerClient } = await import("@/lib/supabase-public.server");
        const db = createPublicServerClient();

        if (!id) {
          try {
            const { data: wRow } = await db
              .from("app_config" as never)
              .select("value")
              .eq("key" as never, "webinar_id" as never)
              .maybeSingle();
            if ((wRow as any)?.value && typeof (wRow as any).value === "string") {
              const val = (wRow as any).value.trim();
              if (val) id = val;
            }
          } catch {
            /* fallback */
          }
        }

        if (!id) {
          id = (process.env["WEBINAR_GG_WEBINAR_ID"] || "").trim() || "cmthk6y4001kos60ybxfkbc67";
        }

        if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }

        let parsed: Record<string, unknown> = {};
        if (apiKey) {
          try {
            // Try /metrics first; if 404 (webinar.gg API v1 exposes /webinar/:id), fallback to /webinar/:id
            let upstream = await fetch(
              `https://webinar-api.webinar.gg/api/v1/webinar/${id}/metrics`,
              { headers: { authorization: `Bearer ${apiKey}` } },
            );
            if (!upstream.ok) {
              upstream = await fetch(
                `https://webinar-api.webinar.gg/api/v1/webinar/${id}`,
                { headers: { authorization: `Bearer ${apiKey}` } },
              );
            }
            if (upstream.ok) {
              const raw = await upstream.text();
              parsed = JSON.parse(raw) as Record<string, unknown>;
            }
          } catch (error) {
            console.warn("get-webinar-metrics upstream fetch warning:", error);
          }
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

        // Also aggregate real-time session metrics from webinar_event_logs
        let dbTotalUsers: number | null = null;
        let dbPeakUsers: number | null = null;
        let dbDurationMinutes: number | null = null;
        let dbDroppedOffUsers: number | null = null;
        let dbAvgWatchMinutes: number | null = null;

        try {
          const { sessionDateISO } = await import("@/lib/session");
          const sessionDate = sessionDateISO();
          const { data: evRows } = await db
            .from("webinar_event_logs" as never)
            .select("email, event_type, duration_seconds, created_at")
            .or(`webinar_id.eq.${id},session_date.eq.${sessionDate}` as never)
            .order("created_at" as never, { ascending: true });

          const events = (evRows ?? []) as Array<{
            email: string | null;
            event_type: string;
            duration_seconds: number | null;
            created_at: string;
          }>;

          const uniqueAttendees = new Set<string>();
          let currentConcurrent = 0;
          let maxConcurrent = 0;
          let leaveCount = 0;
          let totalWatchSeconds = 0;
          let watchSamples = 0;
          let firstEventMs: number | null = null;
          let lastEventMs: number | null = null;

          for (const ev of events) {
            const t = new Date(ev.created_at).getTime();
            if (!Number.isNaN(t)) {
              if (firstEventMs === null || t < firstEventMs) firstEventMs = t;
              if (lastEventMs === null || t > lastEventMs) lastEventMs = t;
            }
            if (ev.email) {
              uniqueAttendees.add(ev.email.trim().toLowerCase());
            }
            if (ev.event_type === "join") {
              currentConcurrent += 1;
              if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent;
            } else if (ev.event_type === "leave") {
              leaveCount += 1;
              currentConcurrent = Math.max(0, currentConcurrent - 1);
              if (ev.duration_seconds && ev.duration_seconds > 0) {
                totalWatchSeconds += ev.duration_seconds;
                watchSamples += 1;
              }
            }
          }

          dbTotalUsers = uniqueAttendees.size;
          dbPeakUsers = Math.max(maxConcurrent, uniqueAttendees.size);
          dbDroppedOffUsers = leaveCount;
          if (watchSamples > 0) {
            dbAvgWatchMinutes = Math.max(1, Math.round(totalWatchSeconds / watchSamples / 60));
          }
          if (firstEventMs !== null) {
            const endRef =
              data["status"] === "ongoing"
                ? Date.now()
                : (lastEventMs ?? Date.now());
            dbDurationMinutes = Math.max(1, Math.round((endRef - firstEventMs) / 60000));
          }
        } catch {
          /* ignore db fallback error */
        }

        const payload: WebinarMetrics = {
          totalUsers: num("totalUsers", "totalAttendees", "attendees", "registrations") ?? dbTotalUsers ?? 0,
          peakUsers: num("peakUsers", "peakLiveUsers", "maxConcurrentUsers", "peakConcurrent") ?? dbPeakUsers ?? 0,
          durationMinutes: num("durationMinutes", "duration", "lengthMinutes") ?? dbDurationMinutes ?? 0,
          droppedOffUsers: dbDroppedOffUsers ?? 0,
          avgWatchMinutes: dbAvgWatchMinutes,
          raw: parsed,
        };

        return Response.json(payload, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
