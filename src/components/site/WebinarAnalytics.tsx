import { useCallback, useEffect, useState } from "react";
import { Activity, MessageSquare, UserMinus, UserPlus, Calendar, History, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  adminHistoricalWebinarLogs,
  type AdminWebinarHistoricalEvent,
  type AdminWebinarHistoricalSession,
} from "@/lib/admin.functions";

type Metrics = {
  totalUsers: number | null;
  peakUsers: number | null;
  durationMinutes: number | null;
};

type FeedKind = "join" | "leave" | "chat" | "activity";

const ICON: Record<FeedKind, typeof UserPlus> = {
  join: UserPlus,
  leave: UserMinus,
  chat: MessageSquare,
  activity: Activity,
};

const TONE: Record<FeedKind, string> = {
  join: "text-emerald-400",
  leave: "text-rose-400",
  chat: "text-sky-400",
  activity: "text-amber-400",
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="label-caps text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function formatTime(isoString: string) {
  try {
    const d = new Date(isoString);
    const shifted = new Date(d.getTime() + 5.5 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  } catch {
    return isoString;
  }
}

export function WebinarAnalytics({ password = "" }: { password?: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AdminWebinarHistoricalSession[]>([]);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("");
  const [events, setEvents] = useState<AdminWebinarHistoricalEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load live API metrics from webinar.gg
  const loadLiveMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/get-webinar-metrics", {
        headers: { accept: "application/json" },
      });
      const body = (await response.json()) as Partial<Metrics> & { error?: string };
      if (!response.ok) {
        setError(
          body.error === "not_configured"
            ? "The webinar API key is not set on this deployment yet."
            : "The provider did not return analytics for this webinar yet.",
        );
        setMetrics(null);
        return;
      }
      setMetrics({
        totalUsers: body.totalUsers ?? null,
        peakUsers: body.peakUsers ?? null,
        durationMinutes: body.durationMinutes ?? null,
      });
    } catch {
      setError("Could not reach the analytics endpoint.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load historical webinar logs from database
  const loadHistory = useCallback(
    async (sessionDate?: string) => {
      if (!password) return;
      setHistoryLoading(true);
      try {
        const res = (await adminHistoricalWebinarLogs({
          data: { password, sessionDate: sessionDate || null },
        })) as {
          ok: boolean;
          sessions: AdminWebinarHistoricalSession[];
          events: AdminWebinarHistoricalEvent[];
        };
        if (res.ok) {
          setSessions(res.sessions);
          setEvents(res.events);
          if (!selectedSessionDate && res.sessions.length > 0) {
            setSelectedSessionDate(res.sessions[0]?.session_date ?? "");
          }
        }
      } catch (err) {
        console.error("Could not load historical webinar logs:", err);
      } finally {
        setHistoryLoading(false);
      }
    },
    [password, selectedSessionDate],
  );

  useEffect(() => {
    void loadLiveMetrics();
    if (password) {
      void loadHistory();
    }
  }, [loadLiveMetrics, loadHistory, password]);

  const handleSelectSession = (date: string) => {
    setSelectedSessionDate(date);
    void loadHistory(date);
  };

  const show = (value: number | null | undefined, suffix = "") =>
    loading ? "…" : value === null || value === undefined ? "-" : `${value}${suffix}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-semibold">Webinar Session Analytics & Logs</h2>
          <p className="text-xs text-muted-foreground">
            Live attendance numbers and permanent historical logs across all masterclass dates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessions.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs bg-muted/60 px-3 py-1.5 rounded-md border border-border">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedSessionDate}
                onChange={(e) => handleSelectSession(e.target.value)}
                className="bg-transparent font-medium text-foreground focus:outline-hidden cursor-pointer"
              >
                <option value="">All Saved Sessions</option>
                {sessions.map((s) => (
                  <option key={s.session_date} value={s.session_date}>
                    {s.session_date} ({s.unique_attendees} attendees)
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            disabled={loading || historyLoading}
            onClick={() => {
              void loadLiveMetrics();
              void loadHistory(selectedSessionDate);
            }}
            className="text-xs h-8"
          >
            {loading || historyLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          label="Current Total Attendees"
          value={show(metrics?.totalUsers)}
          hint="From live webinar provider"
        />
        <Card
          label="Peak Live Users"
          value={show(metrics?.peakUsers)}
          hint="Maximum concurrent users"
        />
        <Card
          label="Session Duration"
          value={show(metrics?.durationMinutes, " min")}
          hint="Total room active time"
        />
      </div>

      {/* Historical Session Summary Strip if past sessions recorded */}
      {sessions.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Archived Webinar Sessions
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            {sessions.map((ses) => (
              <button
                key={ses.session_date}
                type="button"
                onClick={() => handleSelectSession(ses.session_date)}
                className={`p-3 rounded-md border text-left transition-colors ${
                  selectedSessionDate === ses.session_date
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <p className="font-bold">{ses.session_date}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {ses.unique_attendees} attendees · {ses.joins} joins
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Event Stream Terminal */}
      <div className="overflow-hidden rounded-lg border border-border bg-[#0b0f0d]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 text-emerald-400" />
            <p className="label-caps text-[10px] text-white/70">
              Webinar Event Stream {selectedSessionDate ? `(${selectedSessionDate})` : "(All Sessions)"}
            </p>
          </div>
          <span className="text-[10px] text-white/40 font-mono">
            {events.length} recorded events
          </span>
        </div>

        <ul className="max-h-80 space-y-1 overflow-y-auto p-4 font-mono text-xs">
          {events.length === 0 ? (
            <li className="text-white/40 italic">
              No webhook events recorded for this session yet. As attendees join and leave via Webinar.gg, real-time events will stream here.
            </li>
          ) : (
            events.map((ev) => {
              const kind: FeedKind =
                ev.event_type === "join"
                  ? "join"
                  : ev.event_type === "leave"
                    ? "leave"
                    : ev.event_type === "chat"
                      ? "chat"
                      : "activity";
              const Icon = ICON[kind];
              const timeLabel = formatTime(ev.created_at);

              return (
                <li key={ev.id} className="flex items-start gap-2 text-white/80">
                  <span className="text-white/40">[{timeLabel}]</span>
                  <Icon className={`mt-0.5 size-3.5 shrink-0 ${TONE[kind]}`} />
                  <span className="break-words">
                    <span className="font-semibold text-white/90">
                      {ev.email ? ev.email : "Unknown Attendee"}
                    </span>{" "}
                    {ev.event_type === "join"
                      ? "joined the room"
                      : ev.event_type === "leave"
                        ? `left the room${ev.duration_seconds ? ` after ${Math.round(ev.duration_seconds / 60)}m` : ""}`
                        : ev.event_type}
                    {ev.session_date ? (
                      <span className="text-white/30 text-[10px] ml-2">({ev.session_date})</span>
                    ) : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
