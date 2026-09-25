import { CheckCheck, Check, Eye, XCircle } from "lucide-react";

/**
 * WhatsApp delivery view. The numbers are placeholder data shaped exactly like
 * the AiSensy message report, so wiring the real API later is a drop-in swap.
 */

type WaStatus = "sent" | "delivered" | "read" | "failed";

type WaMessage = {
  id: string;
  number: string;
  template: string;
  snippet: string;
  status: WaStatus;
  at: string;
};

const MOCK: WaMessage[] = [
  {
    id: "wa_1",
    number: "+91 98204 11223",
    template: "masterclass_confirmation",
    snippet: "Your seat is saved for this Saturday, 7:00 PM IST.",
    status: "read",
    at: "2026-09-01T09:12:00+05:30",
  },
  {
    id: "wa_2",
    number: "+91 99873 55014",
    template: "masterclass_confirmation",
    snippet: "Your seat is saved for this Saturday, 7:00 PM IST.",
    status: "delivered",
    at: "2026-09-01T09:14:00+05:30",
  },
  {
    id: "wa_3",
    number: "+91 90045 77812",
    template: "reminder_24h",
    snippet: "Tomorrow at 7:00 PM. Bring a pen and last month's statement.",
    status: "read",
    at: "2026-08-31T19:02:00+05:30",
  },
  {
    id: "wa_4",
    number: "+91 88796 21340",
    template: "reminder_1h",
    snippet: "We start in one hour. Here is your joining link.",
    status: "sent",
    at: "2026-08-30T18:00:00+05:30",
  },
  {
    id: "wa_5",
    number: "+91 70213 98455",
    template: "live_now",
    snippet: "We are live. Come in and take a seat.",
    status: "failed",
    at: "2026-08-30T19:00:00+05:30",
  },
  {
    id: "wa_6",
    number: "+91 96500 12876",
    template: "post_session",
    snippet: "Thank you for being in the room. Your one page is next.",
    status: "delivered",
    at: "2026-08-31T09:30:00+05:30",
  },
];

const STATUS_ICON: Record<WaStatus, typeof Check> = {
  sent: Check,
  delivered: CheckCheck,
  read: Eye,
  failed: XCircle,
};

const STATUS_CLASS: Record<WaStatus, string> = {
  sent: "bg-muted text-muted-foreground",
  delivered: "bg-primary/10 text-primary",
  read: "bg-[var(--brass)]/15 text-[var(--brass)]",
  failed: "bg-destructive/10 text-destructive",
};

export function WaBadge({ status }: { status: WaStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_CLASS[status]}`}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ist(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const shifted = new Date(date.getTime() + 5.5 * 3600 * 1000);
  return `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

export function WhatsAppPanel() {
  const total = MOCK.length;
  const delivered = MOCK.filter((row) => row.status !== "sent" && row.status !== "failed").length;
  const read = MOCK.filter((row) => row.status === "read").length;
  const pct = (part: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "0%");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total messages" value={String(total)} />
        <Card label="Delivered rate" value={pct(delivered)} hint={`${delivered} delivered`} />
        <Card label="Read rate" value={pct(read)} hint={`${read} read`} />
      </div>

      <p className="text-xs text-muted-foreground">
        Sample data for now. Once the AiSensy account is connected this table fills with real
        message reports.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border">
            <tr className="text-muted-foreground">
              <th className="p-3">Number</th>
              <th className="p-3">Template</th>
              <th className="p-3">Message</th>
              <th className="p-3">Status</th>
              <th className="p-3">When</th>
            </tr>
          </thead>
          <tbody>
            {MOCK.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="p-3 font-medium">{row.number}</td>
                <td className="p-3">{row.template}</td>
                <td className="p-3 text-muted-foreground">{row.snippet}</td>
                <td className="p-3">
                  <WaBadge status={row.status} />
                </td>
                <td className="p-3">{ist(row.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
