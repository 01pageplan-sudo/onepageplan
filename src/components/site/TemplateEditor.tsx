import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATES,
  TEMPLATE_MAP,
  templateDraft,
  templateLabel,
  type TemplateOverride,
} from "@/lib/email-templates";
import {
  adminPreviewTemplate,
  adminResetTemplate,
  adminSaveTemplate,
} from "@/lib/admin.functions";

type Overrides = Record<string, TemplateOverride | undefined>;

const PLACEHOLDERS = [
  "{{first_name}}",
  "{{joining_link}}",
  "{{calendar_link}}",
  "{{registration_link}}",
  "{{whatsapp_link}}",
  "{{monthly_checkout_link}}",
  "{{annual_checkout_link}}",
];

/** Edit the copy of any email in the sequence. Blank fields use the original copy. */
export function TemplateEditor({
  password,
  overrides,
  onSaved,
}: {
  password: string;
  overrides: Overrides;
  onSaved: () => void;
}) {
  const [key, setKey] = useState(TEMPLATES[0]?.key ?? "confirmation");
  const [draft, setDraft] = useState<TemplateOverride | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const original = useMemo(() => {
    const spec = TEMPLATE_MAP[key];
    return spec ? templateDraft(spec) : { subject: "", heading: "", body: "" };
  }, [key]);

  const saved = overrides[key];
  const current = draft ?? {
    subject: saved?.subject ?? "",
    heading: saved?.heading ?? "",
    body: saved?.body ?? "",
  };
  const edited = Boolean(
    (saved?.subject ?? "") || (saved?.heading ?? "") || (saved?.body ?? ""),
  );

  function select(next: string) {
    setKey(next);
    setDraft(null);
    setPreview(null);
    setNotice("");
  }

  function set(field: keyof TemplateOverride, value: string) {
    setDraft({ ...current, [field]: value });
  }

  async function save() {
    setBusy(true);
    setNotice("");
    const result = await adminSaveTemplate({
      data: {
        password,
        key,
        subject: current.subject ?? "",
        heading: current.heading ?? "",
        body: current.body ?? "",
      },
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error ?? "Could not save.");
      return;
    }
    setDraft(null);
    setNotice("Saved. New sends of this email use your copy.");
    onSaved();
  }

  async function reset() {
    setBusy(true);
    setNotice("");
    const result = await adminResetTemplate({ data: { password, key } });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error ?? "Could not reset.");
      return;
    }
    setDraft(null);
    setNotice("Back to the original copy.");
    onSaved();
  }

  async function showPreview() {
    setBusy(true);
    setNotice("");
    const result = await adminPreviewTemplate({
      data: {
        password,
        key,
        subject: current.subject ?? "",
        heading: current.heading ?? "",
        body: current.body ?? "",
      },
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error ?? "Could not build the preview.");
      return;
    }
    setPreview({ subject: result.subject, html: result.html });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="rounded-lg border border-border bg-card p-2">
        <ul className="max-h-[520px] space-y-1 overflow-y-auto">
          {TEMPLATES.map(({ key: template }) => {
            const isEdited = Boolean(
              (overrides[template]?.subject ?? "") ||
                (overrides[template]?.heading ?? "") ||
                (overrides[template]?.body ?? ""),
            );
            return (
              <li key={template}>
                <button
                  type="button"
                  onClick={() => select(template)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${
                    template === key ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span>{templateLabel(template)}</span>
                  {isEdited ? <span className="text-[10px] text-[var(--brass)]">edited</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold">{templateLabel(key)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Leave a field empty to keep the original wording. You can use {PLACEHOLDERS.join(", ")}{" "}
            and write links as [label](https://…).
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold">
              Subject
              <Input
                className="mt-1"
                value={current.subject ?? ""}
                placeholder={original.subject}
                onChange={(event) => set("subject", event.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold">
              Heading
              <Input
                className="mt-1"
                value={current.heading ?? ""}
                placeholder={original.heading}
                onChange={(event) => set("heading", event.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold">
              Body — one paragraph per line
              <Textarea
                className="mt-1 min-h-[220px] font-mono text-xs"
                value={current.body ?? ""}
                placeholder={original.body}
                onChange={(event) => set("body", event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save copy
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void showPreview()}>
              Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft({ subject: original.subject, heading: original.heading, body: original.body })}
            >
              Load original into the fields
            </Button>
            {edited ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void reset()}>
                Reset to original
              </Button>
            ) : null}
          </div>

          {notice ? <p className="mt-3 text-xs text-[var(--brass)]">{notice}</p> : null}
        </div>

        {preview ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="text-sm font-semibold">{preview.subject}</p>
            <iframe
              title="Email preview"
              className="mt-3 h-[520px] w-full rounded border border-border bg-white"
              srcDoc={preview.html}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
