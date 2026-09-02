import { useState } from "react";
import { Mail, MessageSquare, CheckCheck, Eye, MousePointerClick, XCircle, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types for Email View
export type EmailLogStatus = "sent" | "opened" | "clicked" | "failed";

export type EmailLog = {
  id: string;
  recipient: string;
  subject: string;
  status: EmailLogStatus;
  timestamp: string;
};

// Types for WhatsApp View
export type WhatsAppLogStatus = "delivered" | "read" | "failed";

export type WhatsAppLog = {
  id: string;
  recipientNumber: string;
  templateName: string;
  status: WhatsAppLogStatus;
  timestamp: string;
};

// Mock data for Email View
const MOCK_EMAIL_LOGS: EmailLog[] = [
  {
    id: "email_1",
    recipient: "arav.sharma@gmail.com",
    subject: "Your seat is saved for this Saturday",
    status: "opened",
    timestamp: "2026-09-01T18:30:00+05:30",
  },
  {
    id: "email_2",
    recipient: "priya.mehta@yahoo.com",
    subject: "Tomorrow, 7:00 PM: bring a pen",
    status: "clicked",
    timestamp: "2026-09-01T17:15:00+05:30",
  },
  {
    id: "email_3",
    recipient: "rohit.verma@outlook.com",
    subject: "We are live now — The Money Reality Masterclass",
    status: "sent",
    timestamp: "2026-09-01T16:00:00+05:30",
  },
  {
    id: "email_4",
    recipient: "neha.gupta@hotmail.com",
    subject: "Your real monthly number",
    status: "opened",
    timestamp: "2026-09-01T14:45:00+05:30",
  },
  {
    id: "email_5",
    recipient: "vikram.singh@gmail.com",
    subject: "Insurance is not an investment",
    status: "failed",
    timestamp: "2026-09-01T11:20:00+05:30",
  },
];

// Mock data for WhatsApp View (AiSensy integration shape)
const MOCK_WHATSAPP_LOGS: WhatsAppLog[] = [
  {
    id: "wa_1",
    recipientNumber: "+91 98204 11223",
    templateName: "masterclass_confirmation",
    status: "read",
    timestamp: "2026-09-01T18:32:00+05:30",
  },
  {
    id: "wa_2",
    recipientNumber: "+91 99873 55014",
    templateName: "masterclass_confirmation",
    status: "delivered",
    timestamp: "2026-09-01T17:18:00+05:30",
  },
  {
    id: "wa_3",
    recipientNumber: "+91 90045 77812",
    templateName: "reminder_24h",
    status: "read",
    timestamp: "2026-09-01T16:05:00+05:30",
  },
  {
    id: "wa_4",
    recipientNumber: "+91 88796 21340",
    templateName: "reminder_1h",
    status: "delivered",
    timestamp: "2026-09-01T14:50:00+05:30",
  },
  {
    id: "wa_5",
    recipientNumber: "+91 70213 98455",
    templateName: "live_now",
    status: "failed",
    timestamp: "2026-09-01T11:25:00+05:30",
  },
];

function formatTimestamp(value: string) {
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

function EmailStatusBadge({ status }: { status: EmailLogStatus }) {
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
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-500 border border-rose-500/20">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
  }
}

function WhatsAppStatusBadge({ status }: { status: WhatsAppLogStatus }) {
  switch (status) {
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
          <CheckCheck className="h-3 w-3" /> Delivered
        </span>
      );
    case "read":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-400 border border-sky-500/20">
          <Eye className="h-3 w-3" /> Read
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-500 border border-rose-500/20">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
  }
}

export function CommunicationsPanel() {
  const [subTab, setSubTab] = useState<"email" | "whatsapp">("email");

  // Email metrics
  const totalEmails = MOCK_EMAIL_LOGS.length;
  const openedEmails = MOCK_EMAIL_LOGS.filter((e) => e.status === "opened" || e.status === "clicked").length;
  const clickedEmails = MOCK_EMAIL_LOGS.filter((e) => e.status === "clicked").length;
  const emailOpenRate = totalEmails > 0 ? `${Math.round((openedEmails / totalEmails) * 100)}%` : "0%";
  const emailClickRate = totalEmails > 0 ? `${Math.round((clickedEmails / totalEmails) * 100)}%` : "0%";

  // WhatsApp metrics
  const totalWa = MOCK_WHATSAPP_LOGS.length;
  const deliveredWa = MOCK_WHATSAPP_LOGS.filter((w) => w.status === "delivered" || w.status === "read").length;
  const readWa = MOCK_WHATSAPP_LOGS.filter((w) => w.status === "read").length;
  const waDeliveredRate = totalWa > 0 ? `${Math.round((deliveredWa / totalWa) * 100)}%` : "0%";
  const waReadRate = totalWa > 0 ? `${Math.round((readWa / totalWa) * 100)}%` : "0%";

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
            Communications overview & delivery tracking
          </span>
        </div>

        {/* EMAIL TAB CONTENT */}
        <TabsContent value="email" className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Sent" value={String(totalEmails)} hint="Resend provider active" />
            <StatCard label="Open Rate" value={emailOpenRate} hint={`${openedEmails} opens recorded`} />
            <StatCard label="Click Rate" value={emailClickRate} hint={`${clickedEmails} link clicks`} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-muted-foreground font-medium">
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_EMAIL_LOGS.map((log) => (
                  <tr key={log.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">{log.recipient}</td>
                    <td className="p-3 text-muted-foreground">{log.subject}</td>
                    <td className="p-3">
                      <EmailStatusBadge status={log.status} />
                    </td>
                    <td className="p-3 text-muted-foreground tabular-nums">{formatTimestamp(log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* WHATSAPP TAB CONTENT */}
        <TabsContent value="whatsapp" className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Messages" value={String(totalWa)} hint="AiSensy integration ready" />
            <StatCard label="Delivered Rate" value={waDeliveredRate} hint={`${deliveredWa} delivered`} />
            <StatCard label="Read Rate" value={waReadRate} hint={`${readWa} read by recipients`} />
          </div>

          <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md border border-border">
            Note: WhatsApp dispatch is wired for AiSensy. Live status webhooks will update this report automatically upon production key activation.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-muted-foreground font-medium">
                  <th className="p-3">Recipient Number</th>
                  <th className="p-3">Template Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_WHATSAPP_LOGS.map((log) => (
                  <tr key={log.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">{log.recipientNumber}</td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">{log.templateName}</td>
                    <td className="p-3">
                      <WhatsAppStatusBadge status={log.status} />
                    </td>
                    <td className="p-3 text-muted-foreground tabular-nums">{formatTimestamp(log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
