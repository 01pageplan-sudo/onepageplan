import { useState, useMemo, useEffect } from "react";
import {
  MessageSquare,
  Send,
  CheckCheck,
  Check,
  Clock,
  User,
  Phone,
  Mail,
  RefreshCw,
  Search,
  AlertCircle,
  ShieldCheck,
  CornerDownRight,
  ArrowUpRight,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  adminGetWhatsAppInbox,
  adminMarkWhatsAppRead,
  adminSendWhatsAppDirectReply,
  type WhatsAppConversationThread,
  type WhatsAppInboxData,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface WhatsAppInboxPanelProps {
  password: string;
}

const QUICK_REPLIES = [
  "Hi! Thanks for reaching out. Yes, the masterclass is this Saturday at 7:00 PM IST.",
  "Here is your direct joining link: https://onepageplan.in/room",
  "To join our private WhatsApp group for live Q&A, click here: https://onepageplan.in",
  "Yes! A recording recap will be available after the live session.",
];

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
  const [replyStatus, setReplyStatus] = useState<string | null>(null);

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
    // Auto refresh every 20 seconds
    const interval = setInterval(() => {
      void loadInbox(true);
    }, 20000);
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
    setReplyStatus(null);

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
        setReplyStatus("Message dispatched!");
        setReplyText("");
        void loadInbox(true);
        setTimeout(() => setReplyStatus(null), 3000);
      } else {
        setReplyStatus(`Failed: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setReplyStatus(`Error: ${msg}`);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-border bg-card">
          <p className="text-xs font-medium text-muted-foreground">Inbound Replies</p>
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
          <p className="mt-1 text-[11px] text-muted-foreground">Requires attention</p>
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
          <p className="mt-1 text-[11px] text-muted-foreground">Phone numbers tracked</p>
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
                Conversations
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
                Replies ({threads.filter((t) => t.lastInboundAt !== null).length})
              </Button>
            </div>
          </div>

          {/* Contact Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[500px]">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading conversations...
                  </div>
                ) : (
                  "No conversation threads found."
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
                  <div className="flex items-center gap-2">
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
                        Window expired (templates only)
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
              </div>

              {/* Message History Timeline */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 min-h-[350px] max-h-[420px] bg-muted/5">
                {selectedThread.messages.map((m) => {
                  const isInbound = m.direction === "inbound";

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isInbound ? "items-start" : "items-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${
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
                          <div className={`p-1.5 mb-1.5 rounded text-[10px] border ${
                            isInbound
                              ? "bg-muted/50 border-border/80 text-muted-foreground"
                              : "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
                          }`}>
                            <p className="font-semibold flex items-center gap-1">
                              <CornerDownRight className="h-2.5 w-2.5" />
                              Replying to {m.repliedToMessageKey}
                            </p>
                          </div>
                        ) : null}

                        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>

                        <div
                          className={`flex items-center justify-end gap-1.5 mt-1.5 text-[9px] ${
                            isInbound ? "text-muted-foreground" : "text-primary-foreground/75"
                          }`}
                        >
                          <span>{formatTime(m.createdAt)}</span>
                          {!isInbound && m.status ? (
                            <span className="capitalize font-medium">({m.status})</span>
                          ) : null}
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

                {replyStatus ? (
                  <p className="text-[11px] text-muted-foreground font-medium">{replyStatus}</p>
                ) : null}
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
    </div>
  );
}
