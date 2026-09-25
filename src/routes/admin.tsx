import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackToHome, Wordmark } from "@/components/site/Header";
import {
  adminDashboard,
  adminDeleteLead,
  adminDeliverabilityCheck,
  adminRunDispatch,
  adminSaveSettings,
  adminSendEmails,
  adminSetTag,
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
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
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

  async function load(nextRange: RangeKey = range) {
    setLoading(true);
    setError("");
    try {
      const bounds = rangeBounds(nextRange);
      const result = await adminDashboard({ data: { password, ...bounds } });
      if (!result.ok) {
        setError(result.error ?? "Could not load.");
        return;
      }
      setAuthed(true);
      setLeads(result.leads);
      setSends(result.sends);
      setSettings(result.settings);
      setStats(result.stats);
      setTemplates(result.templates ?? {});
    } catch {
      setError("Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }

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
  const openRate = number("sent") > 0 ? Math.round((number("opened") / number("sent")) * 100) : 0;
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
              void load();
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
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Checking" : "Open"}
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
          <BackToHome />
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

        <Tabs defaultValue="analytics">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics">Webinar analytics</TabsTrigger>
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
                          <td className="p-3 font-medium">{lead.full_name}</td>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Sent" value={number("sent")} />
              <Stat label="Open rate" value={`${openRate}%`} hint={`${number("opened")} opens`} />
              <Stat label="People emailed" value={number("people")} />
              <Stat label="Waiting in queue" value={number("queued")} />
              <Stat
                label="Not delivered"
                value={number("failed") + number("bounced")}
                hint={`${number("bounced")} bounced · ${number("complained")} complaints`}
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="p-3">When</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Opened</th>
                    <th className="p-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.map((send) => (
                    <tr key={send.id} className="border-b border-border/60">
                      <td className="p-3">{fmt(send.sent_at ?? send.scheduled_at)}</td>
                      <td className="p-3">{send.email}</td>
                      <td className="p-3">{templateLabel(send.template)}</td>
                      <td className="p-3">{send.status}</td>
                      <td className="p-3">{send.opened_at ? fmt(send.opened_at) : "-"}</td>
                      <td className="p-3 text-destructive">{send.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
