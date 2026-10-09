import { useState, useMemo, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Clock,
  Phone,
  Mail,
  RefreshCw,
  Search,
  AlertCircle,
  ShieldCheck,
  CornerDownRight,
  Loader2,
  Calendar,
  Sparkles,
  Trash2,
  Copy,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminGetWhatsAppInbox,
  adminMarkWhatsAppRead,
  adminSendWhatsAppDirectReply,
  adminSimulateInboundWhatsAppMessage,
  adminDeleteWhatsAppThread,
  adminDeleteWhatsAppMessage,
  type WhatsAppConversationThread,
  type WhatsAppInboxData,
  type WhatsAppInboxMessage,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WhatsAppInboxPanelProps {
  password: string;
}

const QUICK_REPLIES = [
  "Hi! Thanks for reaching out. Yes, the masterclass is this Saturday at 7:00 PM IST.",
  "Here is your direct joining link: https://onepageplan.in/room",
  "To join our private WhatsApp group for live Q&A, click here: https://onepageplan.in",
  "Yes! A recording recap will be available after the live session.",
];

const WEBHOOK_CALLBACK_URL = "https://www.onepageplan.in/api/public/whatsapp-webhook";
const WEBHOOK_VERIFY_TOKEN = "opp_whatsapp_verify_token";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())} IST`;
  } catch {
    return "";
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}`;
  } catch {
    return "";
  }
}

export function WhatsAppInboxPanel({ password }: WhatsAppInboxPanelProps) {
  const [data, setData] = useState<WhatsAppInboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "inbound">("all");
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Modals
  const [simulateModalOpen, setSimulateModalOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<WhatsAppConversationThread | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<WhatsAppInboxMessage | null>(null);

  // Simulation form
  const [simPhone, setSimPhone] = useState("+918169660060");
  const [simName, setSimName] = useState("Milan Dodhia");
  const [simBody, setSimBody] = useState("Hi Milan, will there be a replay of Saturday's live session?");
  const [simTrigger, setSimTrigger] = useState("webinar_confirmation");
  const [simulating, setSimulating] = useState(false);

  const loadInbox = async (silent = false) => {
    if (!password) return;
    if (!silent) setLoading(true);
    try {
      const res = await adminGetWhatsAppInbox({ data: { password } });
      if (res.ok) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp inbox:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadInbox();
    // Auto refresh every 15 seconds (matching HealthyHabitsReset)
    const interval = setInterval(() => {
      void loadInbox(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [password]);

  const threads = data?.threads ?? [];

  // Filter threads
  const filteredThreads = useMemo(() => {
    let list = threads;
    if (filterMode === "unread") {
      list = list.filter((t) => t.unreadCount > 0);
    } else if (filterMode === "inbound") {
      list = list.filter((t) => t.lastInboundAt !== null);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.contactName.toLowerCase().includes(q) ||
          t.phone.includes(q) ||
          (t.email && t.email.toLowerCase().includes(q)) ||
          t.messages.some((m) => m.body.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [threads, filterMode, search]);

  const selectedThread: WhatsAppConversationThread | undefined = useMemo(() => {
    if (!selectedPhone && filteredThreads.length > 0) {
      return filteredThreads[0];
    }
    return threads.find((t) => t.phone === selectedPhone) || filteredThreads[0];
  }, [threads, filteredThreads, selectedPhone]);

  // Sync selected phone state
  useEffect(() => {
    if (selectedThread && !selectedPhone) {
      setSelectedPhone(selectedThread.phone);
    }
  }, [selectedThread, selectedPhone]);

  // Mark read when selecting thread
  useEffect(() => {
    if (selectedThread && selectedThread.unreadCount > 0 && password) {
      void adminMarkWhatsAppRead({ data: { password, phone: selectedThread.phone } }).then(() => {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            summary: {
              ...prev.summary,
              totalUnread: Math.max(0, prev.summary.totalUnread - selectedThread.unreadCount),
            },
            threads: prev.threads.map((t) =>
              t.phone === selectedThread.phone ? { ...t, unreadCount: 0 } : t,
            ),
          };
        });
      });
    }
  }, [selectedThread?.phone]);

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim() || sendingReply) return;
    setSendingReply(true);

    try {
      const res = await adminSendWhatsAppDirectReply({
        data: {
          password,
          phone: selectedThread.phone,
          message: replyText.trim(),
          registrationId: selectedThread.registrationId,
        },
      });

      if (res.ok) {
        toast.success("WhatsApp reply dispatched!");
        setReplyText("");
        void loadInbox(true);
      } else {
        toast.error(`Send failed: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${msg}`);
    } finally {
      setSendingReply(false);
    }
  };

  const handleSimulate = async () => {
    if (!simBody.trim() || simulating) return;
    setSimulating(true);

    try {
      const res = await adminSimulateInboundWhatsAppMessage({
        data: {
          password,
          phone: simPhone,
          senderName: simName,
          messageBody: simBody.trim(),
          repliedToMessageKey: simTrigger || undefined,
        },
      });

      if (res.ok) {
        toast.success("Simulated WhatsApp reply injected successfully!");
        setSimulateModalOpen(false);
        void loadInbox(true);
        setSelectedPhone(simPhone.startsWith("+") ? simPhone : `+${simPhone}`);
      } else {
        toast.error(`Simulation failed: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Simulation error: ${msg}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!threadToDelete) return;
    try {
      const res = await adminDeleteWhatsAppThread({
        data: { password, phone: threadToDelete.phone },
      });
      if (res.ok) {
        toast.success("Chat thread deleted.");
        setThreadToDelete(null);
        setSelectedPhone(null);
        void loadInbox(true);
      } else {
        toast.error(`Delete failed: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error deleting thread: ${msg}`);
    }
  };

  const handleDeleteMessage = async (msg: WhatsAppInboxMessage) => {
    try {
      const res = await adminDeleteWhatsAppMessage({
        data: { password, id: msg.id, direction: msg.direction },
      });
      if (res.ok) {
        toast.success("Message deleted.");
        setMessageToDelete(null);
        void loadInbox(true);
      } else {
        toast.error(`Delete failed: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${msg}`);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_CALLBACK_URL);
    setCopiedUrl(true);
    toast.success("Webhook Callback URL copied to clipboard!");
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Meta Webhook Endpoint Status & Diagnostic Card */}
      <Card className="border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground">Meta Cloud API Webhook Endpoint</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  LIVE (200 OK)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Callback URL: <code className="font-mono text-foreground font-semibold bg-muted px-1 py-0.5 rounded">{WEBHOOK_CALLBACK_URL}</code>
                {" "}(Meta requires <code className="font-mono text-emerald-600 font-bold">www.</code> to avoid 308 redirects). Verify Token: <code className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">{WEBHOOK_VERIFY_TOKEN}</code>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={copyWebhookUrl}
            >
              {copiedUrl ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Callback URL
                </>
              )}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30"
              onClick={() => {
                if (selectedThread) {
                  setSimPhone(selectedThread.phone);
                  setSimName(selectedThread.contactName);
                }
                setSimulateModalOpen(true);
              }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
              Simulate Inbound Reply
            </Button>
          </div>
        </div>
      </Card>

      {/* Top summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-border bg-card">
          <p className="text-xs font-medium text-muted-foreground">Inbound Customer Replies</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {data?.summary.totalInbound ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">User-initiated messages</p>
        </Card>

        <Card className="p-4 border-border bg-card">
          <p className="text-xs font-medium text-muted-foreground">Unread Messages</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-500">
            {data?.summary.totalUnread ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Awaiting review</p>
        </Card>

        <Card className="p-4 border-border bg-card">
          <p className="text-xs font-medium text-muted-foreground">Active Care Windows</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">
            {data?.summary.activeCareWindows ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">24h Meta direct reply window</p>
        </Card>

        <Card className="p-4 border-border bg-card">
          <p className="text-xs font-medium text-muted-foreground">Total WhatsApp Contacts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {data?.summary.totalContacts ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Unique conversation threads</p>
        </Card>
      </div>

      {/* Main chat UI */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-xl border border-border bg-card overflow-hidden min-h-[580px]">
        {/* Left Column: Thread List */}
        <div className="md:col-span-4 border-r border-border flex flex-col bg-muted/20">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conversations ({threads.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void loadInbox()}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <Button
                variant={filterMode === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setFilterMode("all")}
              >
                All ({threads.length})
              </Button>
              <Button
                variant={filterMode === "unread" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setFilterMode("unread")}
              >
                Unread ({threads.filter((t) => t.unreadCount > 0).length})
              </Button>
              <Button
                variant={filterMode === "inbound" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setFilterMode("inbound")}
              >
                Customer Replies ({threads.filter((t) => t.lastInboundAt !== null).length})
              </Button>
            </div>
          </div>

          {/* Contact Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[500px]">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading conversations...
                  </div>
                ) : (
                  <>
                    <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40 mb-1" />
                    <p className="font-semibold text-foreground">No conversations yet</p>
                    <p className="text-[11px] leading-relaxed max-w-[200px] mx-auto text-muted-foreground">
                      Send a test template or click &quot;Simulate Inbound Reply&quot; above to test message flow.
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThread?.phone === thread.phone;
                const lastMsg = thread.lastMessage;
                const isInbound = lastMsg?.direction === "inbound";

                return (
                  <button
                    key={thread.phone}
                    type="button"
                    onClick={() => setSelectedPhone(thread.phone)}
                    className={`w-full text-left p-3 transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? "bg-accent border-l-2 border-l-primary"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {thread.contactName}
                        </span>
                        {thread.unreadCount > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            {thread.unreadCount}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {thread.phone}
                      </p>

                      <p className="text-xs text-muted-foreground truncate mt-1 line-clamp-1">
                        {isInbound ? (
                          <span className="text-emerald-500 font-medium">← </span>
                        ) : (
                          <span className="text-muted-foreground">→ </span>
                        )}
                        {lastMsg?.body || "No message content"}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        {thread.isCareWindowActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {thread.careWindowHoursLeft}h window
                          </span>
                        ) : null}
                        <span>{formatDate(lastMsg.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div className="md:col-span-8 flex flex-col h-full bg-background">
          {selectedThread ? (
            <>
              {/* Conversation Header */}
              <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">
                      {selectedThread.contactName}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedThread.status}
                    </Badge>
                    {selectedThread.isCareWindowActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <ShieldCheck className="h-3 w-3" />
                        24h Care Window Active ({selectedThread.careWindowHoursLeft}h remaining)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" />
                        Window closed (templates or replies re-open)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="h-3 w-3" />
                      {selectedThread.phone}
                    </span>
                    {selectedThread.email ? (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedThread.email}
                      </span>
                    ) : null}
                    {selectedThread.sessionDate ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Session: {selectedThread.sessionDate}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => setThreadToDelete(selectedThread)}
                    title="Delete entire chat thread"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete Thread
                  </Button>
                </div>
              </div>

              {/* Message History Timeline */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 min-h-[350px] max-h-[420px] bg-muted/5">
                {selectedThread.messages.map((m) => {
                  const isInbound = m.direction === "inbound";

                  return (
                    <div
                      key={m.id}
                      className={`group/msg flex flex-col ${isInbound ? "items-start" : "items-end"}`}
                    >
                      <div
                        className={`relative max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${
                          isInbound
                            ? "bg-card border border-border text-foreground rounded-tl-none"
                            : "bg-primary text-primary-foreground rounded-tr-none"
                        }`}
                      >
                        {isInbound && m.senderName ? (
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                            {m.senderName}
                          </p>
                        ) : null}

                        {m.repliedToMessageKey ? (
                          <div
                            className={`p-1.5 mb-1.5 rounded text-[10px] border ${
                              isInbound
                                ? "bg-muted/50 border-border/80 text-muted-foreground"
                                : "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
                            }`}
                          >
                            <p className="font-semibold flex items-center gap-1">
                              <CornerDownRight className="h-2.5 w-2.5" />
                              Replying to {m.repliedToMessageKey}
                            </p>
                          </div>
                        ) : null}

                        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>

                        <div
                          className={`flex items-center justify-between gap-2 mt-1.5 text-[9px] ${
                            isInbound ? "text-muted-foreground" : "text-primary-foreground/75"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteMessage(m);
                            }}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity hover:text-destructive"
                            title="Delete this message"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <span>{formatTime(m.createdAt)}</span>
                            {!isInbound && m.status ? (
                              <span className="capitalize font-medium">({m.status})</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input Bar */}
              <div className="p-3 border-t border-border bg-card space-y-2">
                {/* Quick replies */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider whitespace-nowrap">
                    Quick:
                  </span>
                  {QUICK_REPLIES.map((quick, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyText(quick)}
                      className="px-2.5 py-1 text-[11px] rounded-full bg-muted/60 hover:bg-muted text-foreground border border-border whitespace-nowrap transition-colors"
                    >
                      {quick.slice(0, 30)}...
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder={
                      selectedThread.isCareWindowActive
                        ? `Reply directly to ${selectedThread.contactName} on WhatsApp...`
                        : "24-hour service window closed. Freeform replies may fail; use approved templates."
                    }
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    className="text-xs resize-none bg-background flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendReply();
                      }
                    }}
                  />
                  <Button
                    onClick={() => void handleSendReply()}
                    disabled={!replyText.trim() || sendingReply}
                    className="h-auto py-2 px-3 text-xs"
                  >
                    {sendingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 stroke-1 mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                Choose a conversation thread on the left to read inbound replies and respond.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SIMULATE INBOUND MESSAGE MODAL (HEALTHYHABITSRESET STYLE) */}
      <Dialog open={simulateModalOpen} onOpenChange={setSimulateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Simulate Inbound WhatsApp Customer Reply
            </DialogTitle>
            <DialogDescription className="text-xs">
              Test how candidate replies and broadcast quotes appear in your inbox without needing an external handset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Sender Mobile Phone</label>
              <Input
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="+918169660060"
                className="text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Automatically links with matching registrations in the database.
              </p>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Sender Name</label>
              <Input
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="e.g. Milan Dodhia"
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Replying to which Broadcast / Template?
              </label>
              <select
                value={simTrigger}
                onChange={(e) => setSimTrigger(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-hidden"
              >
                <option value="webinar_confirmation">Seat Confirmation (webinar_confirmation)</option>
                <option value="webinar_reminder_2h">2-Hour Reminder (webinar_reminder_2h)</option>
                <option value="webinar_reminder_15m">15-Minute Reminder (webinar_reminder_15m)</option>
                <option value="webinar_live_now">Live Now Alert (webinar_live_now)</option>
                <option value="webinar_missed">Missed Webinar Follow-Up</option>
                <option value="course_purchase_confirmat">Course Purchase Confirmation</option>
                <option value="">Direct message (not replying to any broadcast)</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Message Body</label>
              <Textarea
                value={simBody}
                onChange={(e) => setSimBody(e.target.value)}
                placeholder="Candidate's reply text..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSimulateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => void handleSimulate()}
              disabled={simulating || !simBody.trim()}
            >
              {simulating ? "Injecting..." : "Inject Test Reply to Inbox"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE THREAD DIALOG */}
      <Dialog
        open={Boolean(threadToDelete)}
        onOpenChange={(open) => !open && setThreadToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Conversation Thread?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete all messages for{" "}
              <strong className="text-foreground">{threadToDelete?.contactName}</strong> ({threadToDelete?.phone})?
              This removes inbound and outbound records for this contact.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setThreadToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDeleteThread()}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
