import { createFileRoute, useRouterState } from "@tanstack/react-router";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AskQuestion } from "@/components/site/AskQuestion";
import { Footer } from "@/components/site/Footer";
import { VideoEmbed } from "@/components/site/VideoEmbed";
import { Wordmark } from "@/components/site/Header";
import { track } from "@/lib/analytics";
import { getSessionCalendar } from "@/lib/calendar";

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

/** Fire the conversion events exactly once per registration. */
function useTrackRegistrationOnce(registrationId: string | undefined) {
  useEffect(() => {
    if (!registrationId) return; // direct visit: page renders, no conversion events
    const key = `fired_${registrationId}`;
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked, still fire once for this page view */
    }
    track("CompleteRegistration", { content_name: "money_reality_masterclass" });
    track("Lead");

    // ChatGPT / OpenAI Ads Browser Pixel
    try {
      const win = window as unknown as { oaiq?: (...args: unknown[]) => void };
      if (typeof win.oaiq === "function") {
        win.oaiq(
          "measure",
          "registration_completed",
          { type: "customer_action" },
          { event_id: registrationId },
        );
      }
    } catch {
      /* pixel error tolerated */
    }
  }, [registrationId]);
}

function ConfirmedPage() {
  const webinarUrl = (import.meta.env["VITE_WEBINAR_URL"] as string | undefined) ?? "";
  const prepVideo = import.meta.env["VITE_PREP_VIDEO_URL"] as string | undefined;
  const groupUrl = import.meta.env["VITE_WHATSAPP_GROUP_URL"] as string | undefined;

  const routerState = useRouterState({
    select: (state) => state.location.state as unknown as { registrationId?: string },
  });
  const [registrationId, setRegistrationId] = useState<string | undefined>(
    routerState?.registrationId,
  );
  const [googleUrl, setGoogleUrl] = useState("");

  useEffect(() => {
    setGoogleUrl(getSessionCalendar(webinarUrl).googleUrl);
    if (registrationId) return;
    try {
      const stored = window.sessionStorage.getItem("opp_registration_id");
      if (stored) setRegistrationId(stored);
    } catch {
      /* storage blocked */
    }
  }, [webinarUrl, registrationId]);

  useTrackRegistrationOnce(registrationId);

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

          <div className="mt-5 border-t border-border pt-5">
            <h2 className="text-base font-bold">Put it in your calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ninety minutes, this Saturday at 7:00 PM IST.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-4 w-full border-border bg-background text-primary hover:bg-card sm:w-auto"
            >
              <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                Add to Google Calendar
              </a>
            </Button>
          </div>
        </div>



        <AskQuestion />

        {groupUrl ? (
          <section className="rounded-lg border border-border bg-card p-5">
            <p className="label-caps text-[var(--brass)]">Step 3.</p>
            <h2 className="mt-2 text-lg font-bold">Join the WhatsApp group</h2>
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

      </main>

      <Footer />
    </div>
  );
}
