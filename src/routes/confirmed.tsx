import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { AskQuestion } from "@/components/site/AskQuestion";
import { Footer } from "@/components/site/Footer";
import { VideoEmbed } from "@/components/site/VideoEmbed";
import { Wordmark } from "@/components/site/Header";
import { getNextSessionIST } from "@/lib/session";

const TITLE = "Your seat is saved | The Money Reality Masterclass";
const DESCRIPTION =
  "Your seat for the free live Money Reality Masterclass is saved. One short step left: confirm on the session platform so you can join on Saturday.";

export const Route = createFileRoute("/confirmed")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmedPage,
});

function icsStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function downloadIcs(webinarUrl: string) {
  const start = getNextSessionIST();
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The One Page Plan//Masterclass//EN",
    "BEGIN:VEVENT",
    `UID:${start.getTime()}@onepageplan.in`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    "SUMMARY:The Money Reality Masterclass",
    `LOCATION:${webinarUrl}`,
    "DESCRIPTION:Ninety minutes, live. Sit somewhere quiet with a pen.",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "money-reality-masterclass.ics";
  link.click();
  URL.revokeObjectURL(url);
}

/** Fire the Meta Pixel Lead event once per registration, never on a refresh. */
function useTrackLeadOnce() {
  useEffect(() => {
    const key = "opp_lead_tracked";
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked, still track once for this page view */
    }
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function") {
      fbq("track", "Lead", { content_name: "Money Reality Masterclass registration" });
    }
  }, []);
}

function ConfirmedPage() {
  const webinarUrl = (import.meta.env["VITE_WEBINAR_URL"] as string | undefined) ?? "";
  const prepVideo = import.meta.env["VITE_PREP_VIDEO_URL"] as string | undefined;
  const groupUrl = import.meta.env["VITE_WHATSAPP_GROUP_URL"] as string | undefined;

  useTrackLeadOnce();


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-12">
        <div>
          <h1 className="text-[clamp(1.875rem,5vw,2.75rem)] leading-tight">Your seat is saved</h1>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <p className="label-caps text-[var(--brass)]">Step 1. Done.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your details are with us. The joining link is on its way by email and on WhatsApp.
          </p>
        </div>

        <div className="rounded-lg border-2 border-primary bg-card p-6">
          <p className="label-caps text-[var(--brass)]">Step 2. Confirm on the session platform.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            One more short form, and this is the one that lets you in on the night.
          </p>
          <Button
            asChild
            className="mt-5 h-auto w-full bg-primary py-4 text-base font-semibold text-primary-foreground hover:bg-[var(--highlight)]"
          >
            <a href={webinarUrl || "#"} target="_blank" rel="noopener noreferrer">
              Confirm my seat →
            </a>
          </Button>
        </div>

        {prepVideo ? (
          <section>
            <h2 className="text-xl font-bold">Two minutes before Saturday</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A short note on how to get the most out of the session.
            </p>
            <div className="mt-4">
              <VideoEmbed url={prepVideo} title="Two minutes before Saturday" />
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Before Saturday</h2>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex flex-col gap-2">
              <span className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-[var(--brass)]" />
                <span>Add it to your calendar.</span>
              </span>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => downloadIcs(webinarUrl)}
              >
                Download the calendar file
              </Button>
            </li>
            <li className="flex gap-3">
              <Check size={18} className="mt-0.5 shrink-0 text-[var(--brass)]" />
              <span>Sit somewhere quiet with a pen. You will be working on your own numbers.</span>
            </li>
            <li className="flex gap-3">
              <Check size={18} className="mt-0.5 shrink-0 text-[var(--brass)]" />
              <span>
                Check your email. If nothing arrives in ten minutes, look in Promotions or Spam and
                mark it as not spam.
              </span>
            </li>
          </ul>
        </section>

        {groupUrl ? (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Join the WhatsApp group</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Reminders before the session.</li>
              <li>The resources sent straight to you.</li>
              <li>Somewhere to ask a question before Saturday.</li>
            </ul>
            <Button asChild variant="outline" className="mt-5">
              <a href={groupUrl} target="_blank" rel="noopener noreferrer">
                Join the group →
              </a>
            </Button>
          </section>
        ) : null}

        <AskQuestion />
      </main>

      <Footer />
    </div>
  );
}
