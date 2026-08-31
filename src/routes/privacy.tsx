/* REVIEW REQUIRED BEFORE LAUNCH. Standard template, not legal advice. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Footer } from "@/components/site/Footer";
import { BackToHome, Wordmark } from "@/components/site/Header";
import { formatLongDate } from "@/lib/session";

const TITLE = "Privacy Policy | The One Page Plan";
const DESCRIPTION =
  "How The One Page Plan collects, uses and protects the name, email and WhatsApp number you share when you register for the Money Reality Masterclass.";

export const Route = createFileRoute("/privacy")({
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
  component: PrivacyPage,
});

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [updated, setUpdated] = useState("");
  useEffect(() => setUpdated(formatLongDate()), []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          <Wordmark />
          <BackToHome />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-[clamp(1.75rem,4.5vw,2.5rem)] leading-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {updated ? `Last updated ${updated}.` : null}
        </p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy explains how Mannrs Wellness LLP, which operates The One Page Plan by Milanaire,
        handles the information you share with us. If you have a question about anything here, write
        to connect@onepageplan.in.
      </p>

      <Block heading="What we collect">
        <p>
          When you register for a session we collect your name, your email address, your WhatsApp
          number, the description you select of what you do, and the description you select of your
          current situation.
        </p>
        <p>
          We also record technical and marketing details that arrive with your visit: the page you
          landed on, the website or advertisement that referred you, campaign tracking values in the
          link you clicked, and your IP address for the limited purpose of preventing abuse of the
          registration form.
        </p>
      </Block>

      <Block heading="Why we collect it">
        <p>
          To send you the joining link and reminders for the session you registered for, to run the
          session, to answer you when you write to us, to shape the teaching around the situations
          people actually report, and to send you educational emails and messages about our
          programmes.
        </p>
      </Block>

      <Block heading="Lawful basis">
        <p>
          We rely on your consent. You give it by submitting the registration form and by ticking the
          consent boxes on it. You can withdraw consent at any time and we will stop sending you
          messages.
        </p>
      </Block>

      <Block heading="WhatsApp consent and how to withdraw it">
        <p>
          The WhatsApp box on the registration form is a separate, specific consent to receive the
          joining link and session reminders on WhatsApp. It is unticked by default and you must tick
          it yourself.
        </p>
        <p>
          To stop WhatsApp messages, reply STOP to any message we send you. That ends WhatsApp
          messaging from us. You may still receive email until you unsubscribe from email separately.
        </p>
      </Block>

      <Block heading="Reminder phone calls">
        <p>
          There is a second, optional consent on the form covering reminder phone calls before the
          session. It is unticked by default and it is never required in order to register. To
          withdraw it, email connect@onepageplan.in and ask us to stop calling. We will action it.
        </p>
      </Block>

      <Block heading="Who else processes your data">
        <p>
          We use service providers to run the programme. They receive only what they need for the
          task they perform:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Our email delivery provider, to send you the confirmation email and reminders.</li>
          <li>Our WhatsApp business messaging provider, to send you WhatsApp messages.</li>
          <li>Our webinar platform, to admit you to the live session and record attendance.</li>
          <li>Our hosting and database provider, to store your registration securely.</li>
          <li>Analytics tools, to understand how the website is used.</li>
          <li>
            Meta, which serves our advertising. The Meta Pixel on this website reports website
            activity back to Meta so we can measure and target advertising.
          </li>
        </ul>
        <p>We do not sell your data and we do not rent your contact details to anyone.</p>
      </Block>

      <Block heading="Cookies and the Meta Pixel">
        <p>
          This website uses cookies and similar technology, including the Meta Pixel, to measure
          advertising and to understand which pages people use. You can block or delete cookies in
          your browser settings. Doing so does not stop you attending a session.
        </p>
      </Block>

      <Block heading="How long we keep it">
        <p>
          We keep registration records for as long as we run the programme and you remain on our
          list, and for a further period afterwards where we need it to meet legal, accounting or
          record keeping obligations. When it is no longer needed we delete it or anonymise it.
        </p>
      </Block>

      <Block heading="Your rights">
        <p>
          You can ask us for a copy of the personal data we hold about you, ask us to correct it, ask
          us to delete it, withdraw a consent you gave, or object to a particular use. Write to
          connect@onepageplan.in and we will respond within a reasonable period.
        </p>
      </Block>

      <Block heading="Security">
        <p>
          Registration data is stored in an access controlled database. Only the people who need it
          to run the programme can reach it. No system is perfectly secure, so please share only what
          the form asks for.
        </p>
      </Block>

      <Block heading="Children">
        <p>
          The programme is intended for adults. We do not knowingly collect data from anyone under
          eighteen.
        </p>
      </Block>

      <Block heading="Changes and contact">
        <p>
          If this policy changes we will update the date at the top of this page. For anything at all
          relating to your data, write to connect@onepageplan.in.
        </p>
      </Block>
    </LegalShell>
  );
}
