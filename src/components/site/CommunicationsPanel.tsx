import { useEffect, useState, useMemo } from "react";
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
  Clock,
  ShieldAlert,
  FileText,
  Sliders,
  Users,
  Save,
  FileCheck,
  Download,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  adminWhatsAppDashboard,
  adminGetMessagingData,
  adminSaveMessageTemplate,
  adminToggleMessagingSettings,
  adminUploadAttendanceCsv,
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
  const [subTab, setSubTab] = useState<
    "registry" | "scheduled" | "attendance" | "settings" | "email" | "whatsapp" | "inbox"
  >("registry");

  // Messaging System Data State
  const [msgData, setMsgData] = useState<{
    templates: any[];
    scheduled: any[];
    logs: any[];
    suppressions: any[];
    settings: any;
  } | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [msgNotice, setMsgNotice] = useState("");

  // Template Editing State
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Settings State
  const [testMode, setTestMode] = useState(true);
  const [testEmail, setTestEmail] = useState("dodhia.milan@gmail.com");
  const [testPhone, setTestPhone] = useState("+919820000000");
  const [savingSettings, setSavingSettings] = useState(false);

  // CSV Attendance Uploader State
  const [csvDate, setCsvDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [csvContent, setCsvContent] = useState("");
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    total: number;
    matchedCount: number;
    unmatchedCount: number;
  } | null>(null);

  // WhatsApp Stats State
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

  const loadMessagingData = async () => {
    if (!password) return;
    setMsgLoading(true);
    setMsgError("");
    try {
      const res = await adminGetMessagingData({ data: { password } });
      if (res.ok) {
        setMsgData({
          templates: res.templates || [],
          scheduled: res.scheduled || [],
          logs: res.logs || [],
          suppressions: res.suppressions || [],
          settings: res.settings || {},
        });
        setTestMode(Boolean(res.settings?.messaging_test_mode ?? true));
        setTestEmail(res.settings?.test_recipient_email || "dodhia.milan@gmail.com");
        setTestPhone(res.settings?.test_recipient_phone || "+919820000000");

        if (res.templates && res.templates.length > 0 && !selectedTemplateKey) {
          const first = res.templates[0];
          setSelectedTemplateKey(first.key);
          setEditSubject(first.subject || "");
          setEditBody(first.body || "");
          setEditActive(first.is_active ?? true);
        }
      } else {
        setMsgError(res.error || "Could not load messaging data");
      }
    } catch (err) {
      setMsgError("Failed loading messaging system");
    } finally {
      setMsgLoading(false);
    }
  };

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
    if (password && !msgData) {
      void loadMessagingData();
    }
  }, [password]);

  useEffect(() => {
    if (password && subTab === "whatsapp" && !waData) {
      void loadWhatsAppStats();
    }
  }, [password, subTab]);

  const activeTemplate = useMemo(() => {
    if (!msgData?.templates) return null;
    return msgData.templates.find((t) => t.key === selectedTemplateKey) || null;
  }, [msgData, selectedTemplateKey]);

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = msgData?.templates?.find((t) => t.key === key);
    if (tmpl) {
      setEditSubject(tmpl.subject || "");
      setEditBody(tmpl.body || "");
      setEditActive(tmpl.is_active ?? true);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateKey || !password) return;
    setSavingTemplate(true);
    setMsgError("");
    setMsgNotice("");
    try {
      const res = await adminSaveMessageTemplate({
        data: {
          password,
          key: selectedTemplateKey,
          subject: editSubject,
          body: editBody,
          isActive: editActive,
        },
      });
      if (res.ok) {
        setMsgNotice(`Saved template '${selectedTemplateKey}' successfully.`);
        await loadMessagingData();
      } else {
        setMsgError(res.error || "Could not save template");
      }
    } catch {
      setMsgError("Error saving template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!password) return;
    setSavingSettings(true);
    setMsgError("");
    setMsgNotice("");
    try {
      const res = await adminToggleMessagingSettings({
        data: {
          password,
          testMode,
          testEmail,
          testPhone,
        },
      });
      if (res.ok) {
        setMsgNotice("Messaging test mode and recipient settings saved.");
      } else {
        setMsgError(res.error || "Could not update settings");
      }
    } catch {
      setMsgError("Error updating settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadAttendance = async () => {
    if (!password || !csvContent.trim()) return;
    setUploadingCsv(true);
    setMsgError("");
    setMsgNotice("");
    try {
      const res = await adminUploadAttendanceCsv({
        data: {
          password,
          sessionDate: csvDate,
          csvContent,
        },
      });
      if (res.ok) {
        setUploadResult({
          total: res.total,
          matchedCount: res.matchedCount,
          unmatchedCount: res.unmatchedCount,
        });
        setMsgNotice(
          `Imported ${res.total} attendees (${res.matchedCount} matched existing registrants, ${res.unmatchedCount} unmatched).`,
        );
      } else {
        setMsgError(res.error || "Failed importing CSV");
      }
    } catch {
      setMsgError("Error uploading attendance CSV");
    } finally {
      setUploadingCsv(false);
    }
  };

  const downloadLogsCsv = () => {
    if (!msgData?.logs || msgData.logs.length === 0) return;
    const headers = ["id", "channel", "recipient", "template_key", "status", "created_at", "error"];
    const rows = msgData.logs.map((log: any) => [
      log.id,
      log.channel,
      log.recipient,
      log.template_key,
      log.status,
      log.created_at,
      (log.error || "").replace(/"/g, '""'),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r: any[]) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `message_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Alerts */}
      {msgNotice ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 font-medium">
          <FileCheck className="h-4 w-4 shrink-0" />
          {msgNotice}
        </div>
      ) : null}
      {msgError ? (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-destructive font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {msgError}
        </div>
      ) : null}

      {/* Test Mode Banner */}
      {testMode ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span>
              <strong>TEST MODE ACTIVE:</strong> All outgoing emails & WhatsApps are rerouted to test recipients (
              <code>{testEmail}</code> / <code>{testPhone}</code>). Real buyers will NOT be contacted.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-500/40 bg-card"
            onClick={() => setSubTab("settings")}
          >
            Configure
          </Button>
        </div>
      ) : null}

      {/* Sub Tab Navigation */}
      <Tabs
        value={subTab}
        onValueChange={(val) =>
          setSubTab(
            val as "registry" | "scheduled" | "attendance" | "settings" | "email" | "whatsapp" | "inbox",
          )
        }
        className="w-full"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
          <TabsList className="bg-muted/60 p-1 flex-wrap h-auto">
            <TabsTrigger value="registry" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Template Registry
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Schedule & Logs ({msgData?.scheduled?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              Attendance Matcher
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <Sliders className="h-3.5 w-3.5 text-slate-500" />
              Test Mode & Settings
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <Mail className="h-3.5 w-3.5" />
              Resend Delivery
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <Send className="h-3.5 w-3.5 text-blue-500" />
              Meta WhatsApp
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex items-center gap-1.5 text-xs font-medium px-3">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              WhatsApp Inbox
            </TabsTrigger>
          </TabsList>

          <Button
            size="sm"
            variant="outline"
            onClick={loadMessagingData}
            disabled={msgLoading}
            className="text-xs h-7 gap-1.5"
          >
            {msgLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh Engine
          </Button>
        </div>

        {/* 1. TEMPLATE REGISTRY TAB */}
        <TabsContent value="registry" className="space-y-5 pt-4">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Template Selector Sidebar */}
            <div className="lg:col-span-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Templates ({msgData?.templates?.length ?? 0})
              </p>
              <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden max-h-[600px] overflow-y-auto">
                {!msgData?.templates || msgData.templates.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">Loading templates...</div>
                ) : (
                  msgData.templates.map((tmpl) => {
                    const isSelected = tmpl.key === selectedTemplateKey;
                    return (
                      <button
                        key={tmpl.key}
                        onClick={() => handleSelectTemplate(tmpl.key)}
                        className={`w-full text-left p-3 transition-colors ${
                          isSelected ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium text-foreground truncate">
                            {tmpl.key}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              tmpl.channel === "email"
                                ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            }`}
                          >
                            {tmpl.channel}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="capitalize">{tmpl.category}</span>
                          {tmpl.channel === "whatsapp" ? (
                            <span
                              className={`text-[10px] ${
                                tmpl.meta_approval_status === "APPROVED"
                                  ? "text-emerald-600 font-semibold"
                                  : "text-amber-600"
                              }`}
                            >
                              Meta: {tmpl.meta_approval_status || "PENDING"}
                            </span>
                          ) : (
                            <span>{tmpl.is_active ? "Active" : "Disabled"}</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Template Details & Editor */}
            <div className="lg:col-span-8">
              {activeTemplate ? (
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="font-mono text-sm font-bold text-foreground">
                        {activeTemplate.key}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Channel: <strong>{activeTemplate.channel.toUpperCase()}</strong> · Category:{" "}
                        <strong className="capitalize">{activeTemplate.category}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="tmpl-active" className="text-xs">
                          Active
                        </Label>
                        <Switch
                          id="tmpl-active"
                          checked={editActive}
                          onCheckedChange={setEditActive}
                          disabled={activeTemplate.channel === "whatsapp"}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate || activeTemplate.channel === "whatsapp"}
                        className="text-xs gap-1.5 h-8"
                      >
                        {savingTemplate ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>

                  {activeTemplate.channel === "whatsapp" ? (
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5" /> Meta WhatsApp Cloud API Template
                      </p>
                      <p>
                        Meta Template Name: <code>{activeTemplate.meta_template_name}</code> (
                        {activeTemplate.meta_language}) · Approval Status:{" "}
                        <span className="font-bold">{activeTemplate.meta_approval_status}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        WhatsApp template text is read-only here because changing it requires submitting a new
                        template in Meta WhatsApp Business Manager.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Email Subject Line</Label>
                      <Input
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="text-xs font-medium"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs flex items-center justify-between">
                      <span>Message Body</span>
                      <span className="text-[11px] text-muted-foreground">
                        Supports mustache tags like <code>{"{{first_name}}"}</code>,{" "}
                        <code>{"{{#if bonus}}"}</code>
                      </span>
                    </Label>
                    <Textarea
                      rows={12}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      readOnly={activeTemplate.channel === "whatsapp"}
                      className={`text-xs font-mono ${
                        activeTemplate.channel === "whatsapp" ? "bg-muted/50 cursor-not-allowed" : ""
                      }`}
                    />
                  </div>

                  {activeTemplate.variables && activeTemplate.variables.length > 0 ? (
                    <div className="pt-2 border-t border-border">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                        Available Variables:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeTemplate.variables.map((v: string) => (
                          <span
                            key={v}
                            className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-border"
                          >
                            {"{{"}
                            {v}
                            {"}}"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
                  Select a template to view or edit details.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 2. SCHEDULE & LOGS TAB */}
        <TabsContent value="scheduled" className="space-y-5 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Message Logs & Scheduled Queue</h3>
              <p className="text-xs text-muted-foreground">
                All pending reminders and executed email/WhatsApp dispatches with live delivery statuses.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadLogsCsv}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV Logs
            </Button>
          </div>

          {/* Pending Queue */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Pending & Scheduled Queue ({msgData?.scheduled?.length ?? 0})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
              {!msgData?.scheduled || msgData.scheduled.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No pending messages in queue.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/30">
                    <tr className="text-muted-foreground font-medium">
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Template Key</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Scheduled For (IST)</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msgData.scheduled.map((msg: any) => (
                      <tr key={msg.id} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="p-3 font-medium text-foreground font-mono">{msg.recipient}</td>
                        <td className="p-3 capitalize">{msg.channel}</td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {msg.template_key}
                        </td>
                        <td className="p-3 capitalize">{msg.category}</td>
                        <td className="p-3 tabular-nums text-foreground font-medium">
                          {formatTimestamp(msg.scheduled_for)}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 border border-amber-500/20">
                            {msg.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Execution History */}
          <div className="space-y-2 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
              Execution & Delivery History ({msgData?.logs?.length ?? 0})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
              {!msgData?.logs || msgData.logs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No dispatch logs recorded yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/30">
                    <tr className="text-muted-foreground font-medium">
                      <th className="p-3">Dispatched (IST)</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Template</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Details / Provider ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msgData.logs.map((log: any) => (
                      <tr key={log.id} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="p-3 capitalize">{log.channel}</td>
                        <td className="p-3 font-mono text-[11px] text-foreground">{log.recipient}</td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {log.template_key}
                        </td>
                        <td className="p-3">
                          {log.status === "sent" ? (
                            <span className="text-emerald-600 font-medium">Sent</span>
                          ) : log.status === "failed" ? (
                            <span className="text-rose-600 font-medium">Failed</span>
                          ) : log.status === "skipped" ? (
                            <span className="text-amber-600 font-medium">Skipped</span>
                          ) : (
                            <span>{log.status}</span>
                          )}
                        </td>
                        <td className="p-3 max-w-xs truncate text-[11px] font-mono text-muted-foreground">
                          {log.error ? (
                            <span className="text-destructive font-sans">{log.error}</span>
                          ) : (
                            log.provider_message_id || "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 3. ATTENDANCE MATCHER TAB */}
        <TabsContent value="attendance" className="space-y-5 pt-4">
          <div className="max-w-3xl space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Webinar Attendance Matcher & CSV Uploader
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload attendee emails from webinar.gg or export reports. This safely records attendance
                and queues the follow-up reminder at 11:00 AM IST the next day (only for non-buyers, capped
                at once per person).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Masterclass Session Date</Label>
                <Input
                  type="date"
                  value={csvDate}
                  onChange={(e) => setCsvDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Paste Attendees CSV (Format: <code>email, phone</code> or one email per line)
              </Label>
              <Textarea
                rows={8}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="rajesh@example.com, +919876543210&#10;anita@example.com&#10;vikram@gmail.com, +919988776655"
                className="text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                onClick={handleUploadAttendance}
                disabled={uploadingCsv || !csvContent.trim()}
                className="text-xs gap-1.5"
              >
                {uploadingCsv ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                Import & Match Attendees
              </Button>

              {uploadResult ? (
                <div className="text-xs text-muted-foreground">
                  Matched: <strong className="text-emerald-600">{uploadResult.matchedCount}</strong> ·
                  Unmatched: <strong className="text-amber-600">{uploadResult.unmatchedCount}</strong> ·
                  Total: <strong>{uploadResult.total}</strong>
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        {/* 4. SETTINGS & TEST MODE TAB */}
        <TabsContent value="settings" className="space-y-5 pt-4">
          <div className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Messaging Compliance & Environment Controls
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure safety rails, test mode rerouting, and quiet hours enforcement.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="toggle-test-mode" className="text-xs font-bold text-foreground">
                    Messaging Test Mode
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    When enabled, emails and WhatsApp messages are rerouted to test credentials instead of real buyers.
                  </p>
                </div>
                <Switch
                  id="toggle-test-mode"
                  checked={testMode}
                  onCheckedChange={setTestMode}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Test Recipient Email</Label>
                  <Input
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Test Recipient WhatsApp Phone</Label>
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground border-t border-border pt-4">
              <p className="font-semibold text-foreground">Operational Rails in Effect:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Quiet Hours Enforcement:</strong> Marketing messages are strictly restricted to 9:00 AM – 8:00 PM IST. Any triggered message outside these hours is safely rescheduled for 9:00 AM next morning.
                </li>
                <li>
                  <strong>Daily Marketing Cap:</strong> Max 1 marketing communication per recipient per day across all channels combined.
                </li>
                <li>
                  <strong>WhatsApp-to-Email Failover:</strong> If a WhatsApp message fails to reach the user handset or is rejected by Meta, the engine automatically falls back to sending the email equivalent.
                </li>
                <li>
                  <strong>Opt-out Handling:</strong> Replying "STOP" or "UNSUBSCRIBE" on WhatsApp immediately suppresses both WhatsApp broadcasts and promotional emails.
                </li>
              </ul>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="text-xs gap-1.5"
            >
              {savingSettings ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        {/* 5. EMAIL (RESEND) DELIVERY TAB */}
        <TabsContent value="email" className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-5">
            <StatCard label="Total Sent" value={String(totalEmails)} hint={`${sentEmails} dispatched`} />
            <StatCard label="Delivery Rate" value={emailDeliveryRate} hint="Resend inbox delivery" />
            <StatCard label="Open Rate" value={emailOpenRate} hint={`${openedEmails} opens tracked`} />
            <StatCard label="Click Rate" value={emailClickRate} hint={`${clickedEmails} link clicks`} />
            <StatCard label="Bounced / Failed" value={String(failedEmails)} hint="Delivery failures" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
            {sends.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No email dispatches recorded in the database yet. When emails are sent via Resend, real-time records will appear here.
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

        {/* 6. WHATSAPP TAB CONTENT */}
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

        {/* 7. WHATSAPP REPLIES & INBOX TAB */}
        <TabsContent value="inbox" className="space-y-5 pt-4">
          <WhatsAppInboxPanel password={password} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

