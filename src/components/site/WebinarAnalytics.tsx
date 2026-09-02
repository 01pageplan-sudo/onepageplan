import { useCallback, useEffect, useState } from "react";
import { Activity, MessageSquare, UserMinus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

type Metrics = {
  totalUsers: number | null;
  peakUsers: number | null;
  durationMinutes: number | null;
};

type FeedKind = "join" | "leave" | "chat";

type FeedItem = { at: string; kind: FeedKind; text: string };

/** Placeholder feed, shaped like the provider's live event stream. */
const FEED: FeedItem[] = [
  { at: "10:00 AM", kind: "join", text: "Session opened. Host is live." },
  { at: "10:02 AM", kind: "join", text: "Attendee joined from Mumbai" },
  { at: "10:04 AM", kind: "join", text: "Attendee joined from Pune" },
  { at: "10:09 AM", kind: "chat", text: "Question: how do I track cash spends?" },
  { at: "10:16 AM", kind: "join", text: "Attendee joined from Bengaluru" },
  { at: "10:23 AM", kind: "leave", text: "Attendee dropped off after 21 minutes" },
  { at: "10:31 AM", kind: "chat", text: "Question: does this work on one income?" },
  { at: "10:40 AM", kind: "join", text: "Attendee re-joined from Ahmedabad" },
  { at: "10:49 AM", kind: "leave", text: "Attendee dropped off after 47 minutes" },
  { at: "10:58 AM", kind: "chat", text: "Question: can I share the one page with my spouse?" },
];

const ICON: Record<FeedKind, typeof UserPlus> = {
  join: UserPlus,
  leave: UserMinus,
  chat: MessageSquare,
};

const TONE: Record<FeedKind, string> = {
  join: "text-emerald-400",
  leave: "text-rose-400",
  chat: "text-sky-400",
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

export function WebinarAnalytics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/get-webinar-metrics", { headers: { accept: "application/json" } });
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

  useEffect(() => {
    void load();
  }, [load]);

  const show = (value: number | null | undefined, suffix = "") =>
    loading ? "…" : value === null || value === undefined ? "-" : `${value}${suffix}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Live numbers from the webinar provider. The activity feed below is sample data until the
          event webhook starts recording.
        </p>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? "Working" : "Refresh"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total attendees" value={show(metrics?.totalUsers)} />
        <Card label="Peak live users" value={show(metrics?.peakUsers)} />
        <Card
          label="Webinar duration"
          value={show(metrics?.durationMinutes, " min")}
          hint="As reported by the provider"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-[#0b0f0d]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <Activity className="size-3.5 text-emerald-400" />
          <p className="label-caps text-[10px] text-white/70">Live activity feed</p>
        </div>
        <ul className="max-h-80 space-y-1 overflow-y-auto p-4 font-mono text-xs">
          {FEED.map((item, index) => {
            const Icon = ICON[item.kind];
            return (
              <li key={`${item.at}-${index}`} className="flex items-start gap-2 text-white/80">
                <span className="text-white/40">[{item.at}]</span>
                <Icon className={`mt-0.5 size-3.5 shrink-0 ${TONE[item.kind]}`} />
                <span className="break-words">{item.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
