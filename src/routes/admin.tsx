import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BackToHome, Wordmark } from "@/components/site/Header";
import { RefreshCw, Loader2, LogOut } from "lucide-react";
import {
  adminDashboard,
  adminDeleteLead,
  adminUpdateLead,
  adminDeliverabilityCheck,
  adminGetCommerceDashboard,
  adminRunDispatch,
  adminSaveSettings,
  adminSendEmails,
  adminSetTag,
  adminSyncResendDelivery,
  adminWebinarLogs,
  type AdminLead,
  type AdminSend,
  type AdminSettings,
  type AdminWebinarLog,
} from "@/lib/admin.functions";
import { TEMPLATES, templateLabel } from "@/lib/email-templates";
import { TemplateEditor } from "@/components/site/TemplateEditor";
import { WebinarAnalytics } from "@/components/site/WebinarAnalytics";
import { CommunicationsPanel } from "@/components/site/CommunicationsPanel";
import { CommercePanel } from "@/components/site/CommercePanel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Leads and email automation | The One Page Plan" },
      {
        name: "description",
        content: "Internal console for leads, tags and the masterclass email sequence.",
      },
      { property: "og:title", content: "Leads and email automation | The One Page Plan" },
      { property: "og:description", content: "Internal console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const PRESET_TAGS = ["purchased", "hot", "attended", "no-show", "refunded", "newsletter"];

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 3 months" },
  { key: "all", label: "All time" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function rangeBounds(key: RangeKey): { from?: string; to?: string } {
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 5.5 * 3600 * 1000,
  );
  const day = 24 * 3600 * 1000;
  if (key === "all") return {};
  if (key === "today") return { from: startOfToday.toISOString() };
  if (key === "yesterday")
    return {
      from: new Date(startOfToday.getTime() - day).toISOString(),
      to: startOfToday.toISOString(),
    };
  const days = Number(key);
  return { from: new Date(startOfToday.getTime() - (days - 1) * day).toISOString() };
}

function fmt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="label-caps text-[var(--brass)]">{label}</p>
      <p className="tabular mt-2 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function toCsv(rows: AdminLead[]) {
  const header = [
    "created_at",
    "full_name",
    "email",
    "phone_e164",
    "whatsapp_consent",
    "profile_type",
    "pain_point",
    "unanswered_question",
    "status",
    "tags",
    "emails_sent",
    "emails_opened",
    "emails_failed",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    [
      row.created_at,
      row.full_name,
      row.email,
      row.phone_e164,
      row.whatsapp_consent,
      row.profile_type,
      row.pain_point,
      row.question || "",
      row.status,
      (row.tags ?? []).join("|"),
      row.emails_sent,
      row.emails_opened,
      row.emails_failed,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function AdminPage() {
  const [password, setPassword] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("opp_admin_password") || "";
    }
    return "";
  });
  const [authed, setAuthed] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("opp_admin_password"));
    }
    return false;
  });
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [sends, setSends] = useState<AdminSend[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [stats, setStats] = useState<Record<string, number | Record<string, number>>>({});
  const [range, setRange] = useState<RangeKey>("30");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState<Record<string, string>>({});
  const [bulkTemplate, setBulkTemplate] = useState("reminder_24h");
  const [dns, setDns] = useState<{ name: string; pass: boolean; value: string }[] | null>(null);
  const [templates, setTemplates] = useState<
    Record<string, { subject?: string | null; heading?: string | null; body?: string | null }>
  >({});

  const [webinarLogs, setWebinarLogs] = useState<AdminWebinarLog[]>([]);
  const [commerceData, setCommerceData] = useState<any>(null);
  const [commerceLoading, setCommerceLoading] = useState(false);
  const [commerceError, setCommerceError] = useState("");
  const [adminTab, setAdminTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("opp_admin_tab");
      if (
        saved &&
        [
          "analytics",
          "commerce",
          "communications",
          "leads",
          "automation",
          "templates",
          "delivery",
          "webinar",
        ].includes(saved)
      ) {
        return saved;
      }
    }
    return "analytics";
  });
  const [syncingResend, setSyncingResend] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<"dispatched" | "all" | "queued" | "failed">("dispatched");

  const [editingLead, setEditingLead] = useState<AdminLead | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStatus, setEditStatus] = useState("registered");
  const [editSessionDate, setEditSessionDate] = useState("");
  const [editConsent, setEditConsent] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  function handleTabChange(val: string) {
    setAdminTab(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("opp_admin_tab", val);
    }
    if (val === "commerce" && !commerceData) {
      void loadCommerce();
    }
  }

  async function loadCommerce(customPwd?: string, silent = false) {
    const pwd = customPwd || password;
    if (!pwd) return;
    if (!silent) setCommerceLoading(true);
    setCommerceError("");
    try {
      const result = await adminGetCommerceDashboard({ data: { password: pwd } });
      if (result.ok) {
        setCommerceData(result.data);
      } else {
        setCommerceError(result.error ?? "Could not load commerce dashboard.");
      }
    } catch (err: any) {
      setCommerceError(err?.message ?? "Could not load commerce dashboard.");
    } finally {
      if (!silent) setCommerceLoading(false);
    }
  }

  async function handleSyncDelivery() {
    setSyncingResend(true);
    setNotice("");
    try {
      const res = await adminSyncResendDelivery({ data: { password } });
      if (res.ok) {
        setNotice(`Resend status synchronized: ${(res as any).updatedCount || 0} emails checked and updated.`);
        await load();
      } else {
        setError(res.error || "Failed syncing with Resend.");
      }
    } catch {
      setError("Error syncing delivery status from Resend.");
    } finally {
      setSyncingResend(false);
    }
  }

  async function loadWebinarLogs() {
    setLoading(true);
    try {
      const result = await adminWebinarLogs({ data: { password } });
      if (result.ok) setWebinarLogs(result.logs);
      else setNotice(result.error ?? "Could not load the webinar log.");
    } catch {
      setNotice("Could not load the webinar log.");
    } finally {
      setLoading(false);
    }
  }

  async function load(nextRange: RangeKey = range, customPassword?: string) {
    const pwd = customPassword ?? password;
    if (!pwd) return;
    setLoading(true);
    setError("");
    try {
      const bounds = rangeBounds(nextRange);
      const result = await adminDashboard({ data: { password: pwd, ...bounds } });
      if (!result.ok) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("opp_admin_password");
        }
        setError(result.error ?? "Could not load.");
        setAuthed(false);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("opp_admin_password", pwd);
      }
      setPassword(pwd);
      setAuthed(true);
      setLeads(result.leads);
      setSends(result.sends);
      setSettings(result.settings);
      setStats(result.stats);
      setTemplates(result.templates ?? {});
      void loadCommerce(pwd, Boolean(commerceData));
    } catch {
      setError("Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("opp_admin_password");
    }
    setPassword("");
    setAuthed(false);
    setLeads([]);
    setSends([]);
    setSettings(null);
    setNotice("Signed out of admin console.");
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPwd = localStorage.getItem("opp_admin_password");
      if (savedPwd) {
        setPassword(savedPwd);
        void (async () => {
          try {
            await load(range, savedPwd);
          } finally {
            setSessionChecking(false);
          }
        })();
      } else {
        setSessionChecking(false);
      }
    }
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (tagFilter && !(lead.tags ?? []).includes(tagFilter)) return false;
      if (!term) return true;
      return [lead.full_name, lead.email, lead.phone_e164]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [leads, search, tagFilter]);

  const sendsByLead = useMemo(() => {
    const map = new Map<string, AdminSend[]>();
    for (const send of sends) {
      if (!send.registration_id) continue;
      const list = map.get(send.registration_id) ?? [];
      list.push(send);
      map.set(send.registration_id, list);
    }
    return map;
  }, [sends]);

  const number = (key: string) => Number(stats[key] ?? 0);
  const sentSends = useMemo(
    () => sends.filter((s) => s.status === "sent" || s.status === "delivered" || s.status === "opened" || Boolean(s.sent_at)),
    [sends],
  );
  const openedSends = useMemo(
    () => sends.filter((s) => s.status === "opened" || Boolean(s.opened_at)),
    [sends],
  );
  const deliveredSends = useMemo(
    () => sends.filter((s) => s.status === "delivered" || s.status === "opened" || (s.status === "sent" && !s.error) || Boolean(s.opened_at)),
    [sends],
  );
  const queuedSends = useMemo(
    () => sends.filter((s) => s.status === "queued" && !s.sent_at),
    [sends],
  );
  const failedSends = useMemo(
    () => sends.filter((s) => s.status === "failed" || s.status === "bounced" || Boolean(s.error)),
    [sends],
  );
  const realOpenRate = sentSends.length > 0 ? Math.round((openedSends.length / sentSends.length) * 100) : 0;
  const openRate = realOpenRate;

  const filteredDeliverySends = useMemo(() => {
    return sends
      .filter((send) => {
        const isDispatched = send.status === "sent" || send.status === "delivered" || send.status === "opened" || Boolean(send.sent_at);
        if (deliveryFilter === "dispatched") return isDispatched;
        if (deliveryFilter === "queued") return send.status === "queued" && !send.sent_at;
        if (deliveryFilter === "failed") return send.status === "failed" || send.status === "bounced" || Boolean(send.error);
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.sent_at || a.scheduled_at || 0).getTime();
        const timeB = new Date(b.sent_at || b.scheduled_at || 0).getTime();
        return timeB - timeA;
      });
  }, [sends, deliveryFilter]);

  const buyers = leads.filter((lead) => (lead.tags ?? []).includes("purchased")).length;
  const optIn =
    leads.length > 0
      ? Math.round((leads.filter((lead) => lead.whatsapp_consent).length / leads.length) * 100)
      : 0;

  async function toggleTag(lead: AdminLead, tag: string, add: boolean) {
    setNotice("");
    const result = await adminSetTag({
      data: { password, registrationId: lead.id, tag, add },
    });
    if (!result.ok) {
      setError(result.error ?? "Could not save that tag.");
      return;
    }
    await load();
    setNotice(add ? `Tagged ${lead.email} as ${tag}.` : `Removed ${tag} from ${lead.email}.`);
  }

  async function removeLead(lead: AdminLead) {
    if (!window.confirm(`Delete ${lead.email}? This cannot be undone.`)) return;
    const result = await adminDeleteLead({ data: { password, registrationId: lead.id } });
    if (!result.ok) {
      setError(result.error ?? "Could not delete.");
      return;
    }
    await load();
    setNotice(`Deleted ${lead.email}.`);
  }

  function startEdit(lead: AdminLead) {
    setEditingLead(lead);
    setEditName(lead.full_name || "");
    setEditEmail(lead.email || "");
    let p = lead.phone_e164 || "";
    // If phone has accidental +910, auto-clean preview to +91
    if (p.startsWith("+910") && p.length > 5) {
      p = `+91${p.slice(4)}`;
    }
    setEditPhone(p);
    setEditStatus(lead.status || "registered");
    setEditSessionDate(lead.session_date || "");
    setEditConsent(lead.whatsapp_consent ?? false);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLead) return;
    setSavingEdit(true);
    setNotice("");
    setError("");
    try {
      const res = await adminUpdateLead({
        data: {
          password,
          id: editingLead.id,
          fullName: editName,
          email: editEmail,
          phone: editPhone,
          status: editStatus,
          sessionDate: editSessionDate || null,
          whatsappConsent: editConsent,
        },
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === editingLead.id
              ? {
                  ...l,
                  full_name: res.lead.full_name,
                  email: res.lead.email,
                  phone_e164: res.lead.phone_e164,
                  status: res.lead.status ?? l.status,
                  session_date: res.lead.session_date ?? l.session_date,
                  whatsapp_consent: res.lead.whatsapp_consent ?? l.whatsapp_consent,
                }
              : l,
          ),
        );
        setNotice(
          `Updated contact details for ${res.lead.email}. Phone formatted as ${res.lead.phone_e164 || "(none)"}.`,
        );
        setEditingLead(null);
      } else {
        setError(res.error || "Failed to update lead.");
      }
    } catch {
      setError("Failed to update lead.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function sendTo(template: string, targets: AdminLead[], force: boolean) {
    setNotice("");
    setError("");
    setLoading(true);
    try {
      const result = await adminSendEmails({
        data: {
          password,
          template,
          force,
          leads: targets.map((lead) => ({
            id: lead.id,
            email: lead.email,
            session_date: lead.session_date,
          })),
        },
      });
      if (!result.ok) {
        setError(result.error ?? "Could not send.");
        return;
      }
      setNotice(
        `${templateLabel(template)}: ${result.sent} sent, ${result.failed} failed, ${result.queued} newly queued.`,
      );
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function runQueue() {
    setLoading(true);
    setNotice("");
    try {
      const result = await adminRunDispatch({ data: { password } });
      if (!result.ok) {
        setError(result.error ?? "Could not run the queue.");
        return;
      }
      setNotice(`Queue run: ${result.sent} sent, ${result.failed} failed, ${result.queued} scheduled.`);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(next: AdminSettings) {
    setSettings(next);
    const result = await adminSaveSettings({ data: { password, settings: next } });
    setNotice(result.ok ? "Settings saved." : "");
    if (!result.ok) setError(result.error ?? "Could not save.");
  }

  async function checkDns() {
    setLoading(true);
    try {
      const result = await adminDeliverabilityCheck({ data: { password } });
      if (!result.ok) {
        setError(result.error ?? "Could not run the check.");
        return;
      }
      setDns(result.checks);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    if (sessionChecking) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Restoring admin session...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Wordmark />
            <BackToHome />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">
          <form
            className="max-w-sm space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void load(range, password);
            }}
          >
            <h1 className="text-2xl font-bold">Admin</h1>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 bg-card"
                autoFocus
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Checking..." : "Open"}
            </Button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Wordmark />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
            <BackToHome />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                setRange(option.key);
                void load(option.key);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                range === option.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Working" : "Refresh"}
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="text-sm text-[var(--brass)]">{notice}</p> : null}

        <Tabs
          value={adminTab}
          onValueChange={handleTabChange}
        >
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics">Webinar analytics</TabsTrigger>
            <TabsTrigger value="commerce">Commerce</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="automation">Email automation</TabsTrigger>
            <TabsTrigger value="templates">Email copy</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="webinar">Webinar log</TabsTrigger>
          </TabsList>

          {/* ------------------------------- LEADS ------------------------------- */}
          <TabsContent value="leads" className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Leads in range" value={filtered.length} />
              <Stat label="Buyers" value={buyers} hint="Tagged purchased" />
              <Stat label="WhatsApp opt-in" value={`${optIn}%`} />
              <Stat label="Emails sent" value={number("sent")} hint={`${openRate}% opened`} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search name, email or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 max-w-xs bg-card"
              />
              <button
                onClick={() => setTagFilter(null)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  tagFilter === null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                All tags
              </button>
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    tagFilter === tag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {tag}
                </button>
              ))}
              <Button variant="outline" size="sm" onClick={download}>
                Download CSV
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
              <div>
                <Label className="text-xs">Send to everyone shown ({filtered.length})</Label>
                <select
                  value={bulkTemplate}
                  onChange={(event) => setBulkTemplate(event.target.value)}
                  className="mt-1.5 h-9 w-72 rounded-md border border-border bg-background px-2 text-sm"
                >
                  {TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground"
                disabled={loading || filtered.length === 0}
                onClick={() => void sendTo(bulkTemplate, filtered, true)}
              >
                Send now
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Registered</th>
                    <th className="p-3">Session</th>
                    <th className="p-3">Emails</th>
                    <th className="p-3">Tags</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => {
                    const timeline = sendsByLead.get(lead.id) ?? [];
                    const isOpen = expanded === lead.id;
                    return (
                      <Fragment key={lead.id}>
                        <tr key={lead.id} className="border-b border-border/60 align-top">
                          <td className="p-3 font-medium">
                            <div>{lead.full_name}</div>
                            {lead.profile_type ? (
                              <div
                                className="mt-1 text-[11px] text-muted-foreground truncate max-w-[200px]"
                                title={lead.profile_type}
                              >
                                👤 {lead.profile_type}
                              </div>
                            ) : null}
                            {lead.question ? (
                              <div
                                className="mt-1 inline-flex items-center gap-1 rounded bg-[var(--brass)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brass)]"
                                title={lead.question}
                              >
                                ❓ Question asked
                              </div>
                            ) : null}
                          </td>
                          <td className="p-3">{lead.email}</td>
                          <td className="p-3">{lead.phone_e164 || "-"}</td>
                          <td className="p-3">{lead.utm_source || "direct"}</td>
                          <td className="p-3">{fmt(lead.created_at)}</td>
                          <td className="p-3">
                            {lead.session_date ?? "-"}
                            <br />
                            <span className="text-muted-foreground">{lead.status}</span>
                          </td>
                          <td className="p-3">
                            {lead.emails_sent} sent
                            <br />
                            <span className="text-muted-foreground">
                              {lead.emails_opened} opened · {lead.emails_failed} failed
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(lead.tags ?? []).map((tag) => (
                                <button
                                  key={tag}
                                  title="Remove tag"
                                  onClick={() => void toggleTag(lead, tag, false)}
                                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                                >
                                  {tag} ×
                                </button>
                              ))}
                            </div>
                            <div className="mt-1 flex gap-1">
                              <select
                                value={newTag[lead.id] ?? ""}
                                onChange={(event) => {
                                  const tag = event.target.value;
                                  setNewTag((prev) => ({ ...prev, [lead.id]: "" }));
                                  if (tag) void toggleTag(lead, tag, true);
                                }}
                                className="h-7 rounded border border-border bg-background text-[11px]"
                              >
                                <option value="">+ tag</option>
                                {PRESET_TAGS.filter((tag) => !(lead.tags ?? []).includes(tag)).map(
                                  (tag) => (
                                    <option key={tag} value={tag}>
                                      {tag}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] font-medium text-primary hover:bg-primary/10"
                                onClick={() => startEdit(lead)}
                              >
                                Edit contact
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => setExpanded(isOpen ? null : lead.id)}
                              >
                                {isOpen ? "Hide emails" : `Emails (${timeline.length})`}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={loading}
                                onClick={() => void sendTo("confirmation", [lead], true)}
                              >
                                Resend confirmation
                              </Button>
                              <button
                                onClick={() => void removeLead(lead)}
                                className="text-[11px] text-destructive underline"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr key={`${lead.id}-detail`} className="border-b border-border/60 bg-background/60">
                            <td colSpan={9} className="p-3">
                              <div className="space-y-3">
                                {/* Customer Insights: Answers & Questions */}
                                <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="label-caps text-[var(--brass)] font-semibold">
                                      Customer Insights & Answers
                                    </p>
                                    {lead.utm_source ? (
                                      <span className="text-[10px] text-muted-foreground">
                                        Source: {lead.utm_source}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                                    <div className="rounded border border-border/40 bg-muted/30 p-2.5">
                                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-1">
                                        Who they are (Profile)
                                      </span>
                                      <span className="font-medium text-foreground leading-snug">
                                        {lead.profile_type || "Not specified"}
                                      </span>
                                    </div>
                                    <div className="rounded border border-border/40 bg-muted/30 p-2.5">
                                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-1">
                                        Stated Situation / Challenge
                                      </span>
                                      <span className="font-medium text-foreground leading-snug">
                                        {lead.pain_point || "Not specified"}
                                      </span>
                                    </div>
                                    <div className="rounded border border-[var(--brass)]/30 bg-[var(--brass)]/10 p-2.5 sm:col-span-2 lg:col-span-1">
                                      <span className="font-semibold text-[var(--brass)] block text-[10px] uppercase tracking-wider mb-1">
                                        Biggest Money Question (to answer live)
                                      </span>
                                      <span className="font-medium text-foreground leading-snug">
                                        {lead.question ? `"${lead.question}"` : "None submitted yet"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <p className="label-caps text-[var(--brass)]">
                                    Exactly what {lead.email} received
                                  </p>
                                  {timeline.length === 0 ? (
                                    <p className="mt-1 text-muted-foreground">
                                      Nothing recorded in this date range.
                                    </p>
                                  ) : (
                                    <table className="mt-2 w-full text-[11px]">
                                      <tbody>
                                        {timeline.map((send) => (
                                          <tr key={send.id} className="border-b border-border/40">
                                            <td className="py-1 pr-3">{templateLabel(send.template)}</td>
                                            <td className="py-1 pr-3">{send.status}</td>
                                            <td className="py-1 pr-3">
                                              {send.sent_at
                                                ? `sent ${fmt(send.sent_at)}`
                                                : `due ${fmt(send.scheduled_at)}`}
                                            </td>
                                            <td className="py-1 pr-3">
                                              {send.opened_at ? `opened ${fmt(send.opened_at)}` : "not opened"}
                                            </td>
                                            <td className="py-1 text-destructive">{send.error ?? ""}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-end gap-2">
                                  <select
                                    value={newTag[`send-${lead.id}`] ?? "reminder_24h"}
                                    onChange={(event) =>
                                      setNewTag((prev) => ({
                                        ...prev,
                                        [`send-${lead.id}`]: event.target.value,
                                      }))
                                    }
                                    className="h-8 w-72 rounded border border-border bg-background px-2 text-[11px]"
                                  >
                                    {TEMPLATES.map((template) => (
                                      <option key={template.key} value={template.key}>
                                        {template.label}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    size="sm"
                                    className="h-8 bg-primary text-[11px] text-primary-foreground"
                                    disabled={loading}
                                    onClick={() =>
                                      void sendTo(
                                        newTag[`send-${lead.id}`] ?? "reminder_24h",
                                        [lead],
                                        true,
                                      )
                                    }
                                  >
                                    Send this one now
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Edit Contact Dialog */}
            <Dialog open={editingLead !== null} onOpenChange={(open) => !open && setEditingLead(null)}>
              <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Edit Contact Details</DialogTitle>
                </DialogHeader>
                {editingLead ? (
                  <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="edit-name" className="text-xs font-medium">
                        Full Name
                      </Label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 bg-background"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-email" className="text-xs font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="mt-1 bg-background"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-phone" className="text-xs font-medium">
                        Phone / WhatsApp (E.164)
                      </Label>
                      <Input
                        id="edit-phone"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+9198XXXXXXXX"
                        className="mt-1 bg-background"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                        Indian mobile format: 10 digits with +91 (e.g. <code>+919029877071</code>). Any extra leading zero (e.g. <code>+9109029...</code>) will be stripped automatically on save.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-status" className="text-xs font-medium">
                          Status
                        </Label>
                        <select
                          id="edit-status"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                        >
                          <option value="registered">registered</option>
                          <option value="attended">attended</option>
                          <option value="no_show">no_show</option>
                          <option value="dropped_off">dropped_off</option>
                          <option value="subscribed">subscribed</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="edit-session" className="text-xs font-medium">
                          Session Date
                        </Label>
                        <Input
                          id="edit-session"
                          value={editSessionDate}
                          onChange={(e) => setEditSessionDate(e.target.value)}
                          placeholder="YYYY-MM-DD"
                          className="mt-1 bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3 bg-muted/20">
                      <div>
                        <Label htmlFor="edit-consent" className="cursor-pointer text-xs font-medium">
                          WhatsApp Consent
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Lead opted-in for WhatsApp updates
                        </p>
                      </div>
                      <Switch
                        id="edit-consent"
                        checked={editConsent}
                        onCheckedChange={setEditConsent}
                      />
                    </div>
                    <DialogFooter className="gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditingLead(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={savingEdit}
                        className="bg-primary text-primary-foreground hover:bg-[var(--highlight)]"
                      >
                        {savingEdit ? "Saving..." : "Save changes"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : null}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ---------------------------- AUTOMATION ---------------------------- */}
          <TabsContent value="automation" className="space-y-6 pt-5">
            {settings ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">Nurture sequence</p>
                      <p className="text-xs text-muted-foreground">
                        Eleven daily emails after the session. Stops the moment someone is tagged
                        purchased.
                      </p>
                    </div>
                    <Switch
                      checked={settings.nurture_enabled}
                      onCheckedChange={(checked) =>
                        void saveSettings({ ...settings, nurture_enabled: checked })
                      }
                    />
                  </div>

                  {(
                    [
                      ["joining_link", "Joining link"],
                      ["calendar_link", "Add to calendar link (blank = generated)"],
                      ["registration_link", "Registration page"],
                      ["whatsapp_link", "WhatsApp community"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        value={settings[key]}
                        onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
                        className="mt-1 h-9 bg-background text-xs"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground"
                      onClick={() => void saveSettings(settings)}
                    >
                      Save links
                    </Button>
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => void runQueue()}>
                      Run the queue now
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Deliverability check</p>
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => void checkDns()}>
                      Run check
                    </Button>
                  </div>
                  {dns ? (
                    <ul className="space-y-2 text-xs">
                      {dns.map((check) => (
                        <li key={check.name} className="flex items-start justify-between gap-3">
                          <span className="font-medium">{check.name}</span>
                          <span className="flex-1 break-all text-right text-muted-foreground">
                            {check.value}
                          </span>
                          <span className={check.pass ? "text-primary" : "text-destructive"}>
                            {check.pass ? "OK" : "Missing"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Checks SPF, DKIM, DMARC and MX on onepageplan.in.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="p-3">Email</th>
                    <th className="p-3">Trigger</th>
                    <th className="p-3">Sent in range</th>
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATES.map((template) => {
                    const byTemplate = (stats["by_template"] ?? {}) as Record<string, number>;
                    return (
                      <tr key={template.key} className="border-b border-border/60">
                        <td className="p-3 font-medium">{template.label}</td>
                        <td className="p-3 text-muted-foreground">{template.trigger}</td>
                        <td className="tabular p-3">{byTemplate[template.key] ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ----------------------------- DELIVERY ----------------------------- */}
          {/* ----------------------------- EMAIL COPY ---------------------------- */}
          <TabsContent value="templates" className="pt-5">
            <TemplateEditor
              password={password}
              overrides={templates}
              onSaved={() => void load()}
            />
          </TabsContent>

          <TabsContent value="delivery" className="space-y-5 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setDeliveryFilter("dispatched")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    deliveryFilter === "dispatched" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dispatched ({sentSends.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryFilter("all")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    deliveryFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({sends.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryFilter("queued")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    deliveryFilter === "queued" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Queued ({queuedSends.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryFilter("failed")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    deliveryFilter === "failed" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Failed ({failedSends.length})
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSyncDelivery()}
                disabled={syncingResend || loading}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingResend ? "animate-spin" : ""}`} />
                {syncingResend ? "Checking Resend..." : "Sync Resend Delivery & Opens"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Sent" value={sentSends.length} />
              <Stat label="Open rate" value={`${realOpenRate}%`} hint={`${openedSends.length} opens`} />
              <Stat label="Delivered" value={deliveredSends.length} />
              <Stat label="Waiting in queue" value={queuedSends.length} />
              <Stat
                label="Not delivered"
                value={failedSends.length}
                hint={`${sends.filter((s) => s.status === "bounced").length} bounced`}
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="p-3">When</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Email Template</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Opened</th>
                    <th className="p-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliverySends.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No email sends found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDeliverySends.map((send) => (
                      <tr key={send.id} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="p-3">{fmt(send.sent_at ?? send.scheduled_at)}</td>
                        <td className="p-3 font-mono text-[11px]">{send.email}</td>
                        <td className="p-3">{templateLabel(send.template)}</td>
                        <td className="p-3">
                          {send.opened_at || send.status === "opened" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                              Opened
                            </span>
                          ) : send.status === "delivered" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                              Delivered
                            </span>
                          ) : send.status === "sent" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 border border-blue-500/30">
                              Sent
                            </span>
                          ) : send.status === "queued" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                              Queued
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                              {send.status}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {send.opened_at ? fmt(send.opened_at) : "-"}
                        </td>
                        <td className="p-3 text-destructive">{send.error ?? ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ----------------------------- COMMERCE ------------------------------ */}
          <TabsContent value="commerce" className="pt-5">
            {commerceLoading && !commerceData ? (
              <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Loading Commerce Console...</p>
              </div>
            ) : commerceData ? (
              <CommercePanel
                password={password}
                data={commerceData}
                onRefresh={() => void loadCommerce(undefined, true)}
              />
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {commerceError || "Commerce data not loaded yet."}
                </p>
                <Button onClick={() => void loadCommerce()} disabled={commerceLoading || loading}>
                  {commerceError ? "Retry Loading Commerce" : "Load Commerce Console"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* --------------------------- COMMUNICATIONS -------------------------- */}
          <TabsContent value="communications" className="pt-5">
            <CommunicationsPanel sends={sends} password={password} />
          </TabsContent>

          {/* -------------------------- WEBINAR ANALYTICS ------------------------ */}
          <TabsContent value="analytics" className="pt-5">
            <WebinarAnalytics password={password} />
          </TabsContent>

          {/* ---------------------------- WEBINAR LOG ---------------------------- */}
          <TabsContent value="webinar" className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Every join request sent to the webinar provider, with the exact reply it returned.
                Newest first, last 100 calls.
              </p>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void loadWebinarLogs()}>
                Refresh log
              </Button>
            </div>
            {webinarLogs.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
                No calls recorded yet. Open the room page once and refresh this log.
              </p>
            ) : (
              <div className="space-y-3">
                {webinarLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border bg-card p-4 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{fmt(log.created_at)}</span>
                      <span
                        className={
                          log.outcome === "ok" ? "text-primary" : "text-destructive font-semibold"
                        }
                      >
                        {log.outcome}
                      </span>
                      <span className="text-muted-foreground">
                        HTTP {log.response_status ?? "-"} · {log.email ?? "-"}
                      </span>
                    </div>
                    {log.error ? <p className="mt-2 text-destructive">{log.error}</p> : null}
                    <p className="mt-2 break-all text-muted-foreground">
                      POST {log.request_url ?? "-"}
                    </p>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">
{JSON.stringify(log.request_body, null, 2)}
                    </pre>
                    <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">
{log.response_body ?? "(empty response)"}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
