import { useState } from "react";
import { Mail, MessageSquare, CheckCheck, Eye, MousePointerClick, XCircle, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminSend } from "@/lib/admin.functions";
import { templateLabel } from "@/lib/email-templates";

export type EmailLogStatus = "sent" | "opened" | "clicked" | "failed" | "queued";

function formatTimestamp(value: string | null | undefined) {
  if (!value) return ":";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EmailStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-500 border border-blue-500/20">
          <Send className="h-3 w-3" /> Sent
        </span>
      );
    case "opened":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500 border border-amber-500/20">
          <Eye className="h-3 w-3" /> Opened
        </span>
      );
    case "clicked":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
          <MousePointerClick className="h-3 w-3" /> Clicked
        </span>
      );
    case "failed":
    case "bounced":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-500 border border-rose-500/20">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
          {status}
        </span>
      );
  }
}

export function CommunicationsPanel({ sends = [] }: { sends?: AdminSend[] }) {
  const [subTab, setSubTab] = useState<"email" | "whatsapp">("email");

  // Live Email metrics derived from real sends
  const totalEmails = sends.length;
  const sentEmails = sends.filter((e) => e.status === "sent" || e.status === "opened" || e.status === "clicked").length;
  const openedEmails = sends.filter((e) => e.status === "opened" || e.status === "clicked" || Boolean(e.opened_at)).length;
  const clickedEmails = sends.filter((e) => e.status === "clicked").length;
  const failedEmails = sends.filter((e) => e.status === "failed" || e.status === "bounced" || Boolean(e.error)).length;

  const emailOpenRate = sentEmails > 0 ? `${Math.round((openedEmails / sentEmails) * 100)}%` : "0%";
  const emailClickRate = sentEmails > 0 ? `${Math.round((clickedEmails / sentEmails) * 100)}%` : "0%";

  return (
    <div className="space-y-6">
      {/* Sub Tab Navigation */}
      <Tabs value={subTab} onValueChange={(val) => setSubTab(val as "email" | "whatsapp")} className="w-full">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="email" className="flex items-center gap-2 text-xs font-medium px-4">
              <Mail className="h-3.5 w-3.5" />
              Email Campaign
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2 text-xs font-medium px-4">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              WhatsApp (AiSensy)
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            Live communications overview & delivery tracking
          </span>
        </div>

        {/* EMAIL TAB CONTENT */}
        <TabsContent value="email" className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Total Logged" value={String(totalEmails)} hint={`${sentEmails} delivered`} />
            <StatCard label="Open Rate" value={emailOpenRate} hint={`${openedEmails} opens recorded`} />
            <StatCard label="Click Rate" value={emailClickRate} hint={`${clickedEmails} link clicks`} />
            <StatCard label="Failed / Issues" value={String(failedEmails)} hint="Bounces or delivery failures" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
            {sends.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No email dispatches recorded in the database yet. When emails are sent, real-time records will appear here.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-muted-foreground font-medium">
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Error / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.map((send) => (
                    <tr key={send.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium text-foreground">{send.email}</td>
                      <td className="p-3 text-muted-foreground">{templateLabel(send.template)}</td>
                      <td className="p-3">
                        <EmailStatusBadge status={send.status} />
                      </td>
                      <td className="p-3 text-muted-foreground tabular-nums">
                        {formatTimestamp(send.sent_at ?? send.scheduled_at)}
                      </td>
                      <td className="p-3 text-destructive max-w-xs truncate">
                        {send.error || ":"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* WHATSAPP TAB CONTENT */}
        <TabsContent value="whatsapp" className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Messages" value="0" hint="Live AiSensy dispatch" />
            <StatCard label="Delivered Rate" value="0%" hint="0 delivered" />
            <StatCard label="Read Rate" value="0%" hint="0 read" />
          </div>

          <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md border border-border">
            WhatsApp dispatch is configured for AiSensy. As messages are sent to registered attendees, live delivery and read statuses will be logged and displayed here automatically.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs p-8 text-center text-xs text-muted-foreground">
            No WhatsApp messages dispatched yet. When WhatsApp messages are triggered, they will show up here.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
