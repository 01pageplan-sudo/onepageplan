import { useEffect, useState } from "react";
import {
  Mail,
  MessageSquare,
  Check,
  CheckCheck,
  Eye,
  MousePointerClick,
  XCircle,
  Send,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  adminWhatsAppDashboard,
  type AdminSend,
  type AdminWhatsAppStats,
} from "@/lib/admin.functions";
import { templateLabel } from "@/lib/email-templates";
import { WhatsAppInboxPanel } from "./WhatsAppInboxPanel";

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
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
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
          <CheckCheck className="h-3 w-3" /> Delivered
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
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-500 border border-purple-500/20">
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

function WhatsAppStatusBadge({ status }: { status: string }) {
  switch (status.toLowerCase()) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-500 border border-blue-500/20">
          <Check className="h-3 w-3" /> Sent
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-medium text-teal-600 border border-teal-500/20">
          <CheckCheck className="h-3 w-3" /> Delivered
        </span>
      );
    case "read":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 border border-emerald-500/30">
          <Eye className="h-3 w-3" /> Read
        </span>
      );
    case "clicked":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-600 border border-purple-500/20">
          <MousePointerClick className="h-3 w-3" /> Clicked CTA
        </span>
      );
    case "failed":
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

export function CommunicationsPanel({
  sends = [],
  password = "",
}: {
  sends?: AdminSend[];
  password?: string;
}) {
  const [subTab, setSubTab] = useState<"email" | "whatsapp" | "inbox">("email");
  const [waData, setWaData] = useState<AdminWhatsAppStats | null>(null);
  const [waLoading, setWaLoading] = useState(false);

  // Live Email metrics derived from real sends
  const totalEmails = sends.length;
  const sentEmails = sends.filter(
    (e) => e.status === "sent" || e.status === "delivered" || e.status === "opened" || e.status === "clicked",
  ).length;
  const deliveredEmails = sends.filter(
    (e) => e.status === "delivered" || e.status === "opened" || e.status === "clicked" || (e as unknown as { delivered_at?: string }).delivered_at,
  ).length;
  const openedEmails = sends.filter(
    (e) => e.status === "opened" || e.status === "clicked" || Boolean(e.opened_at),
  ).length;
  const clickedEmails = sends.filter(
    (e) => e.status === "clicked" || Boolean((e as unknown as { clicked_at?: string }).clicked_at),
  ).length;
  const failedEmails = sends.filter(
    (e) => e.status === "failed" || e.status === "bounced" || Boolean(e.error),
  ).length;

  const emailDeliveryRate = sentEmails > 0 ? `${Math.round((deliveredEmails / sentEmails) * 100)}%` : "100%";
  const emailOpenRate = sentEmails > 0 ? `${Math.round((openedEmails / sentEmails) * 100)}%` : "0%";
  const emailClickRate = sentEmails > 0 ? `${Math.round((clickedEmails / sentEmails) * 100)}%` : "0%";

  const loadWhatsAppStats = async () => {
    if (!password) return;
    setWaLoading(true);
    try {
      const res = await adminWhatsAppDashboard({ data: { password } });
      if (res.ok) {
        setWaData(res.data);
      }
    } catch (err) {
      console.error("Could not load WhatsApp dashboard:", err);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    if (password && subTab === "whatsapp" && !waData) {
      void loadWhatsAppStats();
    }
  }, [password, subTab]);

  return (
    <div className="space-y-6">
      {/* Sub Tab Navigation */}
      <Tabs
        value={subTab}
        onValueChange={(val) => setSubTab(val as "email" | "whatsapp" | "inbox")}
        className="w-full"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger
              value="email"
              className="flex items-center gap-2 text-xs font-medium px-4"
            >
              <Mail className="h-3.5 w-3.5" />
              Email (Zoho ZeptoMail)
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp"
              className="flex items-center gap-2 text-xs font-medium px-4"
            >
              <Send className="h-3.5 w-3.5 text-blue-500" />
              WhatsApp Broadcasts
            </TabsTrigger>
            <TabsTrigger
              value="inbox"
              className="flex items-center gap-2 text-xs font-medium px-4"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              WhatsApp Replies & Inbox
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            Real-time lifecycle tracking: Send, Delivered, Open, Read & Click
          </span>
        </div>

        {/* EMAIL TAB CONTENT */}
        <TabsContent value="email" className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-5">
            <StatCard label="Total Sent" value={String(totalEmails)} hint={`${sentEmails} dispatched`} />
            <StatCard label="Delivery Rate" value={emailDeliveryRate} hint="Zoho ZeptoMail inbox" />
            <StatCard label="Open Rate" value={emailOpenRate} hint={`${openedEmails} opens tracked`} />
            <StatCard label="Click Rate" value={emailClickRate} hint={`${clickedEmails} link clicks`} />
            <StatCard label="Bounced / Failed" value={String(failedEmails)} hint="Delivery failures" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
            {sends.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No email dispatches recorded in the database yet. When emails are sent via Zoho ZeptoMail, real-time records will appear here.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-muted-foreground font-medium">
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Dispatched</th>
                    <th className="p-3">Opened</th>
                    <th className="p-3">Error / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.map((send) => (
                    <tr
                      key={send.id}
                      className="border-b border-border/60 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3 font-medium text-foreground">{send.email}</td>
                      <td className="p-3 text-muted-foreground">{templateLabel(send.template)}</td>
                      <td className="p-3">
                        <EmailStatusBadge status={send.status} />
                      </td>
                      <td className="p-3 text-muted-foreground tabular-nums">
                        {formatTimestamp(send.sent_at ?? send.scheduled_at)}
                      </td>
                      <td className="p-3 text-muted-foreground tabular-nums">
                        {formatTimestamp(send.opened_at)}
                      </td>
                      <td className="p-3 text-destructive max-w-xs truncate">
                        {send.error || "-"}
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Connected to <strong>Meta WhatsApp Cloud API v21.0</strong>. Direct handset delivery and read receipts.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadWhatsAppStats}
              disabled={waLoading}
              className="text-xs h-7 gap-1.5"
            >
              {waLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh WhatsApp Stats
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-5">
            <StatCard
              label="Dispatched"
              value={String(waData?.sent ?? 0)}
              hint="Meta Graph API sends"
            />
            <StatCard
              label="Delivered Rate"
              value={`${waData?.delivered_rate ?? 0}%`}
              hint={`${waData?.delivered ?? 0} handsets reached`}
            />
            <StatCard
              label="Read Rate"
              value={`${waData?.read_rate ?? 0}%`}
              hint={`${waData?.read ?? 0} messages read`}
            />
            <StatCard
              label="Click / CTA Rate"
              value={`${waData?.clicked_rate ?? 0}%`}
              hint={`${waData?.clicked ?? 0} button clicks`}
            />
            <StatCard
              label="Failed Dispatches"
              value={String(waData?.failed ?? 0)}
              hint="Undelivered / invalid numbers"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
            {!waData?.recent_sends || waData.recent_sends.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No WhatsApp messages dispatched yet. When templates are triggered via Meta Cloud API, live delivery and read receipts will appear here.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-muted-foreground font-medium">
                    <th className="p-3">Phone & Attendee</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Sent At</th>
                    <th className="p-3">Delivered / Read</th>
                    <th className="p-3">Meta WAMID / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {waData.recent_sends.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3">
                        <span className="font-medium text-foreground block">{row.phone}</span>
                        {row.attendee_name ? (
                          <span className="text-[10px] text-muted-foreground">
                            {row.attendee_name}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <span className="font-mono text-[11px] block text-foreground">
                          {row.template_name || row.message_key}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.message_key}
                        </span>
                      </td>
                      <td className="p-3">
                        <WhatsAppStatusBadge status={row.status} />
                      </td>
                      <td className="p-3 text-muted-foreground tabular-nums">
                        {formatTimestamp(row.sent_at ?? row.created_at)}
                      </td>
                      <td className="p-3 text-muted-foreground tabular-nums">
                        {row.read_at ? (
                          <span className="text-emerald-600 font-medium">
                            Read: {formatTimestamp(row.read_at)}
                          </span>
                        ) : row.delivered_at ? (
                          <span>Delivered: {formatTimestamp(row.delivered_at)}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate font-mono text-[10px]">
                        {row.error ? (
                          <span className="text-destructive font-sans">{row.error}</span>
                        ) : (
                          row.provider_message_id || "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* WHATSAPP REPLIES & INBOX TAB */}
        <TabsContent value="inbox" className="space-y-5 pt-4">
          <WhatsAppInboxPanel password={password} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
