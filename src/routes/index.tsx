import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, Globe, Timer, X } from "lucide-react";
import { useEffect, useState } from "react";

import milanHeadshotAsset from "@/assets/milan-headshot.png.asset.json";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CountdownCard } from "@/components/site/Countdown";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { StickyBar } from "@/components/site/StickyBar";
import { Testimonials } from "@/components/site/Testimonials";
import { VideoEmbed } from "@/components/site/VideoEmbed";
import {
  RegistrationProvider,
  useRegistration,
} from "@/components/site/registration-context";
import { formatSessionDayMonth } from "@/lib/session";

const TITLE = "The Money Reality Masterclass | The One Page Plan";
const DESCRIPTION =
  "A free live ninety minute session for Indians aged 30 to 45. Build your own money picture, work out what each holding actually returns, and name the one thing to fix first.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function SectionRule() {
  return <div className="mx-auto h-px max-w-[900px] bg-[var(--brass)]/35" />;
}

function PrimaryCta({ label, className = "" }: { label: string; className?: string }) {
  const { open } = useRegistration();
  return (
    <Button
      onClick={open}
      className={`h-auto w-full bg-primary py-4 text-base font-semibold text-primary-foreground hover:bg-[var(--highlight)] ${className}`}
    >
      {label}
    </Button>
  );
}

function SpecChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm">
      <span className="text-[var(--brass)]">{icon}</span>
      <span className="leading-snug">{label}</span>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function LandingPage() {
  return (
    <RegistrationProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <Hero />
          <CredentialStrip />
          <OldNew />
          <SectionRule />
          <Principles />
          <SectionRule />
          <Secrets />
          <SectionRule />
          <AfterSection />
          <SectionRule />
          <ForWhom />
          <SectionRule />
          <TakeAways />
          <SectionRule />
          <AboutHost />
          <Testimonials />
          <SectionRule />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
        <StickyBar />
      </div>
    </RegistrationProvider>
  );
}

function Hero() {
  const [chipDate, setChipDate] = useState("this Saturday");

  useEffect(() => {
    setChipDate(formatSessionDayMonth());
  }, []);

  const vslUrl = import.meta.env["VITE_VSL_URL"] as string | undefined;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-14">
      <div className="flex justify-center">
        <p className="label-caps rounded-full border border-[var(--brass)] px-4 py-2 text-center text-[var(--brass)]">
          For Indians aged 30 to 45 who earn well and cannot say where it went
        </p>
      </div>

      <h1 className="mx-auto mt-8 max-w-4xl text-center text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] text-balance">
        Know exactly what you own, <span className="text-primary">what it actually returns</span>,
        and the one thing to fix first
      </h1>

      <div className="mx-auto mt-6 max-w-[60ch] space-y-4 text-center text-muted-foreground">
        <p>The Money Reality Masterclass. Free, live, ninety minutes, this Saturday evening.</p>
        <p>
          In ninety minutes I will show you how to build your own money picture, how to calculate
          what each thing you hold is actually returning after tax and after inflation, and how to
          name the one thing to fix first. You walk out with it on one page. You will be doing
          arithmetic on your own numbers, not watching mine.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[55fr_45fr]">
        <div>
          <VideoEmbed url={vslUrl} title="The Money Reality Masterclass" />
          <p className="mt-3 text-xs text-muted-foreground">
            Milan Dodhia · Financial Educator, Milanaire
          </p>
        </div>

        <div className="space-y-4">
          <CountdownCard />
          <div className="grid grid-cols-2 gap-3">
            <SpecChip icon={<CalendarGlyph />} label={`This Saturday, ${chipDate}`} />
            <SpecChip icon={<Clock size={16} />} label="7:00 PM IST" />
            <SpecChip icon={<Timer size={16} />} label="90 minutes" />
            <SpecChip icon={<Globe size={16} />} label="English" />
          </div>
          <PrimaryCta label="Save my seat for this Saturday →" />
          <p className="text-center text-xs text-muted-foreground">
            Free. Live. Nothing to download.
          </p>
        </div>
      </div>
    </section>
  );
}

const CREDENTIALS = [
  { value: "7.5 years", label: "Equity research" },
  { value: "13 years", label: "Licensed mutual fund distributor, surrendered April 2026" },
  { value: "~200 families", label: "Coached, one to one and in groups" },
  { value: "MBA Finance", label: "And NISM certified" },
];

function CredentialStrip() {
  return (
    <section className="border-y border-[var(--brass)]/50 bg-background py-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 md:grid-cols-4">
        {CREDENTIALS.map((item) => (
          <div key={item.value}>
            <p className="font-display text-lg font-bold text-primary sm:text-xl">{item.value}</p>
            <p className="label-caps mt-2 text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const OLD_WAY = [
  "Work more hours, because raising your rate was never presented as an option",
  "Buy what someone recommended, then never go back and check it",
  "Judge a holding by whether the number went up",
  "Keep the whole picture in your head, in fragments, across eleven apps",
  "Decide nothing, because every answer has a confident opposite",
  "Never talk about it at home",
];

const NEW_WAY = [
  "Treat your income as a variable you are accountable for",
  "Evaluate anything before you hold it, including whatever anyone else recommends",
  "Judge a holding post tax and post inflation, using the right measure for it",
  "Hold the whole picture on one page, in your own file",
  "Decide, because you have a method for testing a claim",
  "Run it as a conversation your family is part of",
];

function OldNew() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">
        Two ways to handle money, and only one of them compounds
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-[var(--muted)] p-5">
          <p className="label-caps text-muted-foreground">The old way</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {OLD_WAY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border border-l-4 border-l-primary bg-card p-5">
          <p className="label-caps text-[var(--brass)]">The new way</p>
          <ul className="mt-4 space-y-3 text-sm">
            {NEW_WAY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    title: "Effort is not a strategy.",
    body: "Your income is a variable, not a constant. It is the one lever entirely inside your control and almost nobody is told that.",
  },
  {
    title: "Long term means thirty years, not five.",
    body: "Every decade you can add is compounding you get for free. Almost everything in India is sold as long term at a three to five year horizon.",
  },
  {
    title: "Check whether the vehicle can produce the result before you pour years into it.",
    body: "Executing correctly inside the wrong structure still gets you nothing.",
  },
];

function Principles() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">Three things that change the arithmetic</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PRINCIPLES.map((item, index) => (
          <div key={item.title} className="rounded-lg border border-border bg-card p-5">
            <p className="font-display text-2xl font-bold text-[var(--brass)]">{index + 1}</p>
            <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const SECRETS = [
  {
    title: "Your money doubled and you got poorer.",
    body: "Doubling over ten years works out to about seven percent a year. Take tax off it, then set six percent inflation against it, and what is left can be less than nothing. The statement looked good the whole time. We will do this arithmetic live, on your numbers.",
  },
  {
    title: "You own things you never chose.",
    body: "A policy from a relative. Something a colleague recommended. Another flat because money had piled up. There is also a clause in most term policies, chosen at the start or never, that decides whether the payout reaches your spouse or settles what you owe. Almost nobody is told about it.",
  },
  {
    title: "Your income is not a constant.",
    body: "Everyone optimises the leftovers. Almost nobody questions the number at the top.",
  },
];

function Secrets() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">Three things almost nobody checks</h2>
      <div className="mt-8 space-y-6">
        {SECRETS.map((item, index) => (
          <div key={item.title} className="border-l-2 border-[var(--brass)] pl-5">
            <h3 className="text-lg font-semibold">
              {index + 1}. {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const AFTER = [
  "Open one page and see everything you own, in your own file",
  "Say your number out loud without having to go and check",
  "Calculate what any holding is actually returning, post tax and post inflation",
  "Explain every product you own in one sentence each",
  "Know whether your family is covered, on paper, rather than as a feeling",
  "Name the one thing to fix first, and know why it is that one",
];

function AfterSection() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">What you can do by Sunday morning</h2>
      <ul className="mt-8 space-y-3">
        {AFTER.map((item) => (
          <li key={item} className="flex gap-3 text-sm">
            <Check size={18} className="mt-0.5 shrink-0 text-[var(--brass)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FOR_YOU = [
  "You are between thirty and forty-five, salaried or professional, and earning well",
  "You are carrying a home loan or another EMI",
  "Your parents are ageing behind you and your children's costs are ahead of you",
  "You own financial products you were sold rather than ones you chose",
  "Every answer has a confident opposite, so you have decided nothing in years",
  "There is nobody you can ask who is not also selling you something",
];

const NOT_FOR_YOU = [
  "You want stock tips or fund recommendations. I will never give one",
  "You want a guaranteed return. Nobody honest can promise you one",
  "You want somebody else to manage it for you. This teaches you to do it",
  "You are looking for a get rich scheme. This is arithmetic and it is slow",
  "You are not willing to look at your own numbers honestly for ninety minutes",
];

function ForWhom() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">Read this before you register</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="label-caps text-[var(--brass)]">This is for you if</p>
          <ul className="mt-4 space-y-3 text-sm">
            {FOR_YOU.map((item) => (
              <li key={item} className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-[var(--brass)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-[var(--muted)] p-5">
          <p className="label-caps text-muted-foreground">This is not for you if</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {NOT_FOR_YOU.map((item) => (
              <li key={item} className="flex gap-3">
                <X size={18} className="mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const TAKEAWAYS = [
  {
    title: "The Money Audit sheet.",
    body: "Build your own consolidated picture, in your own file, so the data stays yours and nobody can sell to you off the back of it.",
  },
  {
    title: "The Real Return calculator.",
    body: "Check anything you already hold, post tax and post inflation, using the right measure for it.",
  },
  {
    title: "The Nomination and MWP checklist.",
    body: "Every account and policy, and the one clause most people have never heard of.",
  },
];

function TakeAways() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">Three things you keep</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {TAKEAWAYS.map((item) => (
          <div key={item.title} className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-base font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AboutHost() {
  const hostImage =
    (import.meta.env["VITE_HOST_IMAGE_URL"] as string | undefined) ?? milanHeadshotAsset.url;

  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div>
          <img
            src={hostImage}
            alt="Milan Dodhia, Financial Educator"
            className="w-full rounded-lg border border-border object-cover"
            loading="lazy"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Milan Dodhia</h2>
          <p className="label-caps mt-2 text-[var(--brass)]">Financial Educator</p>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Seven and a half years in equity research. Thirteen years as a licensed mutual fund
              distributor, a licence I surrendered in April 2026. Now inside a credit bureau, working
              across both the bank side and the credit side, which means I know what a lender sees
              when they look at you. MBA in Finance. Around two hundred families coached, one to one
              and in groups.
            </p>
            <p>
              My father ran the same shop in Mumbai for thirty five years, from seven in the morning
              to one at night. Real income, earned through sheer hard work, with no financial
              education behind it. The hours were the strategy and there was never a second one.
              Years later I was able to tell him he could stop, and he did. Our family dinner moved
              from half past ten at night to half past eight.
            </p>
            <p>
              I do not sell products, so I do not earn commissions. I teach the frameworks so you
              decide, and so you can judge whether anyone else's recommendation holds up. Including
              mine.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Is this actually free?",
    a: "Yes. It is a live ninety minute session and there is nothing to pay to attend.",
  },
  {
    q: "Will there be a recording?",
    a: "No. The session is live and not recorded.",
  },
  {
    q: "Do I need to prepare anything?",
    a: "Sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers.",
  },
  {
    q: "Will you tell me what to invest in?",
    a: "No. I teach how to evaluate anything, so you decide for yourself and can check anyone else's recommendation too.",
  },
  {
    q: "Is this suitable if I already invest regularly?",
    a: "Most people who attend already do. The question is whether anyone has ever gone back and checked what it is actually returning.",
  },
  {
    q: "I am not good with numbers. Will I keep up?",
    a: "Yes. It is addition, subtraction and one division. If you can read a bank statement you can do this.",
  },
  {
    q: "Is this a sales pitch?",
    a: "I teach for the first hour and a half and then I tell you what else I do. You are free to take the frameworks and never buy anything.",
  },
  {
    q: "What happens after I register?",
    a: "You will get an email and a WhatsApp message with the joining link, and a reminder before the session starts.",
  },
];

function Faq() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">Questions people ask</h2>
      <Accordion type="single" collapsible className="mt-6">
        {FAQS.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCta() {
  const { open } = useRegistration();
  return (
    <section className="bg-primary px-4 py-16 text-[var(--background)]">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Ninety minutes this Saturday. What is your actual number?
        </h2>
        <p className="mt-3 text-sm opacity-90">
          Free, live, and you leave with it on one page.
        </p>
        <Button
          onClick={open}
          className="mt-8 h-auto bg-[var(--background)] px-8 py-4 text-base font-semibold text-primary hover:bg-[var(--highlight)] hover:text-[var(--background)]"
        >
          Save my seat for this Saturday →
        </Button>
      </div>
    </section>
  );
}
