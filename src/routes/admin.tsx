import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/site/Header";
import { fetchAdminRegistrations } from "@/lib/registration.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Registrations | The One Page Plan" },
      { name: "description", content: "Internal view of registrations for the current session." },
      { property: "og:title", content: "Registrations | The One Page Plan" },
      { property: "og:description", content: "Internal registrations view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Row = {
  created_at: string;
  full_name: string;
  email: string;
  phone_e164: string;
  whatsapp_consent: boolean;
  voice_consent: boolean;
  profile_type: string | null;
  pain_point: string | null;
  status: string;
  email_sent_at: string | null;
};

function toCsv(rows: Row[]) {
  const header = [
    "created_at",
    "full_name",
    "email",
    "phone_e164",
    "whatsapp_consent",
    "voice_consent",
    "profile_type",
    "pain_point",
    "status",
    "email_sent",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    [
      row.created_at,
      row.full_name,
      row.email,
      row.phone_e164,
      row.whatsapp_consent,
      row.voice_consent,
      row.profile_type,
      row.pain_point,
      row.status,
      row.email_sent_at ? "yes" : "no",
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function AdminPage() {
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sessionDate, setSessionDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminRegistrations({ data: { password } });
      if (!result.ok) {
        setError(result.error ?? "Could not load.");
        return;
      }
      setRows(result.rows as Row[]);
      setSessionDate(result.sessionDate);
    } catch {
      setError("Could not load registrations.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!rows) return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registrations-${sessionDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const painCounts = (rows ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.pain_point ?? "Not answered";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {!rows ? (
          <form
            className="max-w-sm space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <h1 className="text-2xl font-bold">Registrations</h1>
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
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Session {sessionDate}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rows.length} registration{rows.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void load()}>
                  Refresh
                </Button>
                <Button onClick={download} className="bg-primary text-primary-foreground">
                  Download CSV
                </Button>
              </div>
            </div>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="label-caps text-[var(--brass)]">Counts by situation</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {Object.entries(painCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => (
                    <li key={key} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="tabular font-semibold">{count}</span>
                    </li>
                  ))}
              </ul>
            </section>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">Call</th>
                    <th className="p-3">Profile</th>
                    <th className="p-3">Situation</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Email sent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.email + row.created_at} className="border-b border-border/60">
                      <td className="p-3">{row.full_name}</td>
                      <td className="p-3">{row.email}</td>
                      <td className="p-3">{row.phone_e164}</td>
                      <td className="p-3">{row.whatsapp_consent ? "Yes" : "No"}</td>
                      <td className="p-3">{row.voice_consent ? "Yes" : "No"}</td>
                      <td className="p-3">{row.profile_type}</td>
                      <td className="p-3">{row.pain_point}</td>
                      <td className="p-3">{row.status}</td>
                      <td className="p-3">{row.email_sent_at ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
