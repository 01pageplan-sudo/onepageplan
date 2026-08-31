/* REVIEW REQUIRED BEFORE LAUNCH. Standard template, not legal advice. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Footer } from "@/components/site/Footer";
import { BackToHome, Wordmark } from "@/components/site/Header";
import { formatLongDate } from "@/lib/session";

const TITLE = "Terms of Use | The One Page Plan";
const DESCRIPTION =
  "The terms that govern use of The One Page Plan website and the Money Reality Masterclass: educational content only, no advice, no guaranteed outcome.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function TermsPage() {
  const [updated, setUpdated] = useState("");
  useEffect(() => setUpdated(formatLongDate()), []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-[clamp(1.75rem,4.5vw,2.5rem)] leading-tight">Terms of Use</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {updated ? `Last updated ${updated}.` : null}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>
            These terms apply to this website and to The Money Reality Masterclass, both operated by
            Mannrs Wellness LLP under the name The One Page Plan by Milanaire. By using the website or
            attending a session you accept them.
          </p>

          <Block heading="Educational content only">
            <p>
              Everything on this website, in the session, and in any sheet, template or calculator we
              share is financial education. It teaches methods and arithmetic so you can look at your
              own situation yourself.
            </p>
          </Block>

          <Block heading="Not advice and not a recommendation">
            <p>
              Nothing we publish or teach is investment advice, tax advice, insurance advice or legal
              advice, and nothing is a recommendation to buy, hold or sell any security, scheme,
              policy or product. We do not assess your personal circumstances and we do not act for
              you. For anything tax related please consult a Chartered Accountant. For anything legal
              please consult a lawyer. Every decision you take is your own.
            </p>
          </Block>

          <Block heading="No guaranteed outcome">
            <p>
              We make no promise about any result, return, saving or outcome from attending a session
              or using any material we share. Any figure used in teaching is an illustration of a
              calculation method, not a projection of what you will experience.
            </p>
          </Block>

          <Block heading="Intellectual property">
            <p>
              The website, the session content, the sheets, the calculators and the checklists belong
              to Mannrs Wellness LLP. You may use them for your own personal purposes. You may not
              copy, resell, republish, record, redistribute or teach them commercially without our
              written permission.
            </p>
          </Block>

          <Block heading="Acceptable use">
            <p>
              Please do not disrupt a live session, harass other attendees or the host, share joining
              links publicly, record or screen capture the session, submit false details on the
              registration form, or attempt to interfere with the website or its systems. We may
              remove anyone from a session or refuse a future registration where this happens.
            </p>
          </Block>

          <Block heading="Registration and scheduling">
            <p>
              Sessions are free to attend. We may change the schedule, reschedule a session or stop
              running sessions. Registration does not create any ongoing obligation on either side.
            </p>
          </Block>

          <Block heading="Third party links and platforms">
            <p>
              Sessions run on a third party webinar platform, and this website may link to other
              websites. We do not control those services and we are not responsible for their
              content, availability or terms.
            </p>
          </Block>

          <Block heading="Limitation of liability">
            <p>
              To the fullest extent permitted by law, Mannrs Wellness LLP and Milan Dodhia are not
              liable for any loss, damage or cost arising from your use of this website, from
              attending a session, or from any decision you take after either. Nothing in these terms
              limits liability that cannot be limited by law.
            </p>
          </Block>

          <Block heading="Governing law">
            <p>
              These terms are governed by the laws of India. The courts at Mumbai have exclusive
              jurisdiction over any dispute arising from them.
            </p>
          </Block>

          <Block heading="Contact">
            <p>Questions about these terms: connect@onepageplan.in.</p>
          </Block>
        </div>
      </main>

      <Footer />
    </div>
  );
}
