import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  Clock,
  Compass,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  Scale,
  Shield,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";

import milanHeadshot from "@/assets/milan-headshot-transparent.png";
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
import { VideoEmbed } from "@/components/site/VideoEmbed";
import { RegistrationProvider, useRegistration } from "@/components/site/registration-context";
import { track, trackOutboundCredibilityClick } from "@/lib/analytics";
import { formatSessionDayMonth } from "@/lib/session";

const TITLE = "The Money Reality Masterclass | OnePagePlan";
const DESCRIPTION =
  "A free live 90-minute financial education masterclass by Milan Dodhia. Look beyond individual financial products and understand your complete financial picture.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://onepageplan.in" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://onepageplan.in" }],
  }),
  component: LandingPage,
});

function SectionRule() {
  return <div className="mx-auto h-px max-w-4xl bg-[var(--brass)]/25" />;
}

function PrimaryCta({
  label,
  className = "",
  size = "lg",
}: {
  label: string;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  const { open } = useRegistration();
  return (
    <Button
      onClick={open}
      size={size}
      className={`h-auto bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-[var(--highlight)] active:scale-[0.99] ${className}`}
    >
      {label}
    </Button>
  );
}

function SpecChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm">
      <span className="text-[var(--brass)] shrink-0">{icon}</span>
      <span className="font-medium text-foreground">{label}</span>
    </div>
  );
}

function LandingPage() {
  return (
    <RegistrationProvider>
      <LandingPageContent />
    </RegistrationProvider>
  );
}

function LandingPageContent() {
  const { open } = useRegistration();

  // Support #register URL hash for Google Ads sitelinks and direct navigation
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === "#register") {
        open();
      }
    };
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, [open]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[var(--brass)]/20 selection:text-foreground overflow-x-clip">
      <Header />
      <main className="pt-20 sm:pt-24 overflow-x-clip">
        <Hero />
        <SectionRule />
        <AudienceRecognition />
        <SectionRule />
        <LearningOutcomes />
        <SectionRule />
        <WhyThisMatters />
        <SectionRule />
        <PresenterSection />
        <SectionRule />
        <SessionDetails />
        <SectionRule />
        <BlogSection />
        <SectionRule />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
      <StickyBar />
    </div>
  );
}

/**
 * 3. Hero Section
 *
 * First screen communicates:
 * 1. What the masterclass is
 * 2. Why someone should attend
 * 3. Who is presenting
 * 4. That it is free
 * 5. How to register
 */
function Hero() {
  const [chipDate, setChipDate] = useState(() => formatSessionDayMonth());
  const { open } = useRegistration();

  useEffect(() => {
    setChipDate(formatSessionDayMonth());
    track("ViewContent", {
      content_name: "money_reality_masterclass",
      content_type: "webinar",
    });
  }, []);

  const vslUrl = import.meta.env["VITE_VSL_URL"] as string | undefined;

  return (
    <section className="mx-auto max-w-5xl px-4 pt-4 sm:pt-6 pb-16 sm:pb-20">
      {/* Eyebrow */}
      <div className="flex justify-center">
        <span className="label-caps inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)] bg-[var(--brass)]/10 px-3.5 py-1.5 text-center text-[11px] sm:text-xs text-[var(--brass)] font-semibold max-w-full">
          <Sparkles size={13} className="shrink-0 text-[var(--brass)]" />
          <span>FREE LIVE MONEY REALITY MASTERCLASS</span>
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="mx-auto mt-6 max-w-3xl text-center font-display text-[clamp(1.75rem,5.5vw,3.75rem)] font-bold leading-[1.12] tracking-tight text-foreground text-balance">
        You Have Investments. <br className="hidden sm:inline" />
        <span className="text-primary">But Do You Have a Financial Plan?</span>
      </h1>

      {/* Supporting Copy */}
      <div className="mx-auto mt-6 max-w-2xl space-y-3.5 text-center text-sm sm:text-lg leading-relaxed text-muted-foreground">
        <p>
          Most families have savings, investments, insurance and financial commitments. But very few
          have brought everything together to understand where they truly stand.
        </p>
        <p>
          Join Milan Dodhia for a free 90-minute masterclass on looking beyond individual financial
          products and understanding your complete financial picture.
        </p>
      </div>

      {/* Supporting Metadata & Schedule Badges */}
      <div className="mx-auto mt-7 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 sm:px-3 font-medium text-foreground">
          <Globe size={14} className="text-[var(--brass)]" />
          Live online
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 sm:px-3 font-medium text-foreground">
          <Timer size={14} className="text-[var(--brass)]" />
          90 minutes
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 sm:px-3 font-medium text-foreground">
          <Globe size={14} className="text-[var(--brass)]" />
          English
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--brass)]/60 bg-[var(--brass)]/10 px-2.5 py-1.5 sm:px-3 font-semibold text-[var(--brass)]">
          <Calendar size={14} />
          Saturday, {chipDate} at 7:00 PM IST
        </span>
      </div>

      {/* Primary CTA */}
      <div className="mx-auto mt-8 flex flex-col items-center justify-center gap-2 max-w-md">
        <Button
          onClick={open}
          size="lg"
          className="w-full bg-primary py-4 text-base sm:text-lg font-semibold text-primary-foreground shadow-sm hover:bg-[var(--highlight)] transition-all"
        >
          Reserve My Free Seat →
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          100% Free · Live Interactive Masterclass · No Products Sold
        </p>
      </div>

      {/* Presenter Video / Overview Preview */}
      <div className="mx-auto mt-12 max-w-3xl">
        <VideoEmbed url={vslUrl} title="The Money Reality Masterclass with Milan Dodhia" />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Presented by Milan Dodhia · Founder, OnePagePlan | Financial Educator
        </p>
      </div>
    </section>
  );
}

/**
 * 4. Audience Recognition — New Section
 */
const AUDIENCE_STATEMENTS = [
  "I invest regularly, but I'm not sure whether I'm actually on track.",
  "My finances are spread across different accounts, policies and platforms.",
  "I know what my investments are worth, but I've never looked at my complete financial position.",
  "I keep making financial decisions, but I don't have one clear picture guiding them.",
];

function AudienceRecognition() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <p className="label-caps text-xs text-[var(--brass)]">Audience Recognition</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
          Does Any of This Sound Familiar?
        </h2>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {AUDIENCE_STATEMENTS.map((statement, idx) => (
          <div
            key={idx}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs transition-colors hover:border-[var(--brass)]/60"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brass)]/40 bg-[var(--brass)]/10 font-display text-xs font-bold text-[var(--brass)]">
              {idx + 1}
            </span>
            <p className="text-sm sm:text-base leading-relaxed text-foreground italic">
              "{statement}"
            </p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-[var(--brass)]/30 bg-[var(--brass)]/5 p-4 text-center">
        <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
          If you've thought about any of these, this masterclass is designed to help you ask better
          questions about your money.
        </p>
      </div>
    </section>
  );
}

/**
 * 5. Learning Outcomes — Rebuilt Section
 */
const LEARNING_CARDS = [
  {
    letter: "A",
    title: "Know What You Actually Have",
    description:
      "Understand the importance of looking at assets, liabilities, savings and commitments together.",
    icon: <Layers className="h-5 w-5 text-[var(--brass)]" />,
  },
  {
    letter: "B",
    title: "Look Beyond Investment Returns",
    description:
      "Explore why portfolio performance alone cannot tell you whether you're financially secure.",
    icon: <Scale className="h-5 w-5 text-[var(--brass)]" />,
  },
  {
    letter: "C",
    title: "Recognise Financial Blind Spots",
    description:
      "Understand how insurance, debt, emergency reserves and future obligations can affect the overall picture.",
    icon: <ShieldAlert className="h-5 w-5 text-[var(--brass)]" />,
  },
  {
    letter: "D",
    title: "Think Before Taking the Next Financial Action",
    description:
      "Learn why clarity about your current position should come before another product purchase or investment decision.",
    icon: <Compass className="h-5 w-5 text-[var(--brass)]" />,
  },
];

function LearningOutcomes() {
  const { open } = useRegistration();

  return (
    <section id="what-youll-learn" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="label-caps text-xs text-[var(--brass)]">Learning Outcomes</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
          What You'll Discover in 90 Minutes
        </h2>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          This masterclass is not about finding the next stock, fund or financial product. It's
          about understanding the bigger picture behind your financial decisions.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {LEARNING_CARDS.map((card) => (
          <div
            key={card.letter}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xs transition-all hover:border-[var(--brass)]/70 hover:shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="label-caps inline-flex items-center rounded-md border border-border bg-[var(--muted)] px-2.5 py-1 text-xs font-bold text-foreground">
                  Section {card.letter}
                </span>
                {card.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button
          onClick={open}
          size="lg"
          className="bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-[var(--highlight)] transition-colors"
        >
          Join the Free Masterclass →
        </Button>
      </div>
    </section>
  );
}

/**
 * 8. Why This Matters — New Section
 */
function WhyThisMatters() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-xs">
        <p className="label-caps text-xs text-[var(--brass)]">The Core Problem</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
          Financial Activity Is Not the Same as Financial Progress
        </h2>

        <div className="mt-6 space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
          <p>
            You might be investing every month, checking your portfolio regularly and purchasing
            products intended to secure your family's future.
          </p>
          <p className="font-medium text-foreground">
            But are those decisions connected to one clear financial picture?
          </p>
          <p>
            Your financial life includes what you own, what you owe, what you need to protect and
            what you're working towards.
          </p>
          <p>
            Understanding how these pieces fit together is the starting point for more deliberate
            financial decisions.
          </p>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="font-display text-lg sm:text-xl font-bold text-primary">
            Before doing more with your money, understand what you already have.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 6. Presenter Section — Rebuilt
 */
const CREDENTIALS = [
  { value: "7.5 Years", label: "Equity Research Experience" },
  {
    value: "13 Years",
    label: "Licensed Mutual Fund Distributor (Surrendered April 2026 to ensure independence)",
  },
  { value: "Credit Bureau", label: "Insights on lender risk & credit assessment" },
  { value: "~200 Families", label: "Coached individually and in group workshops" },
];

function PresenterSection() {
  return (
    <section id="meet-the-presenter" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="grid gap-10 md:grid-cols-[280px_1fr] md:items-start">
        {/* Presenter Portrait */}
        <div className="flex flex-col items-center text-center">
          <div className="overflow-hidden rounded-2xl border border-border bg-[var(--muted)] shadow-xs w-60 sm:w-full max-w-[280px]">
            <img
              src={milanHeadshot}
              alt="Milan Dodhia, Founder of OnePagePlan & Financial Educator"
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Milan Dodhia</p>
        </div>

        {/* Presenter Bio */}
        <div>
          <p className="label-caps text-xs text-[var(--brass)]">Meet Your Presenter</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
            Milan Dodhia
          </h2>
          <p className="label-caps mt-1 text-sm text-primary font-semibold">
            Founder, OnePagePlan | Financial Educator
          </p>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Milan Dodhia believes that financial education should begin with understanding your
              current position, not with purchasing another financial product.
            </p>
            <p>
              Through OnePagePlan, his aim is to help individuals and families look at their money
              more holistically, ask better questions and approach financial decisions with greater
              clarity.
            </p>
            <p>
              Having spent over seven years in equity research and thirteen years as a licensed mutual
              fund distributor (a license surrendered in April 2026 to focus exclusively on unbiased
              education), he brings deep industry insight without any product sales or commission
              motives.
            </p>
            <p>
              Milan is also the person behind Milanaire, his personal and advisory brand. Through his
              professional work and writing, he encourages individuals and families to approach money
              with greater understanding and clarity.
            </p>
          </div>

          {/* Understated Credibility Links */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a
              href="https://milanaire.me"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Explore Milanaire (opens in a new tab)"
              onClick={() => trackOutboundCredibilityClick("milanaire", "presenter")}
              className="inline-flex items-center text-xs sm:text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Explore Milanaire →
            </a>
            <a
              href="https://www.linkedin.com/in/milanaire-me"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Connect with Milan Dodhia on LinkedIn (opens in a new tab)"
              onClick={() => trackOutboundCredibilityClick("linkedin", "presenter")}
              className="inline-flex items-center text-xs sm:text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Connect on LinkedIn →
            </a>
          </div>

          {/* Credentials Strip */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6">
            {CREDENTIALS.map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-3.5">
                <p className="font-display text-base font-bold text-foreground">{item.value}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Educational credentials: MBA in Finance and NISM certified. OnePagePlan provides
            financial education and does not offer personalised investment advisory services.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * 7. Session Details — Rebuilt
 */
function SessionDetails() {
  const [chipDate, setChipDate] = useState(() => formatSessionDayMonth());
  const { open } = useRegistration();

  useEffect(() => {
    setChipDate(formatSessionDayMonth());
  }, []);

  return (
    <section id="session-details" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="text-center">
        <p className="label-caps text-xs text-[var(--brass)]">Session Details</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
          Join the Next Live Session
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-base text-muted-foreground leading-relaxed">
          Set aside 90 minutes to look at your finances from a different perspective.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-6">
        {/* Countdown */}
        <CountdownCard />

        {/* Specifications Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SpecChip icon={<Calendar size={16} />} label={`Saturday, ${chipDate}`} />
          <SpecChip icon={<Clock size={16} />} label="7:00 PM IST" />
          <SpecChip icon={<Timer size={16} />} label="90 Minutes" />
          <SpecChip icon={<Globe size={16} />} label="English" />
        </div>

        <div className="rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/5 p-4 text-center">
          <p className="text-sm font-semibold text-foreground">
            Free live online educational session · No recordings · Live interactive Q&amp;A
          </p>
        </div>

        <div className="text-center pt-2">
          <Button
            onClick={open}
            size="lg"
            className="w-full sm:w-auto bg-primary px-10 py-4 text-base sm:text-lg font-semibold text-primary-foreground hover:bg-[var(--highlight)] transition-colors"
          >
            Save My Free Seat →
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Immediate confirmation · Joining link sent directly to your registered email and
            WhatsApp
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Blog / Editorial Section
 *
 * Keeps all internal blog articles connected, crawlable and compatible with Google Ads sitelinks.
 */
const BLOG_ARTICLES = [
  {
    tag: "Financial Clarity",
    title: "Your Financial App Shows You Everything. But Does It Tell You What Matters?",
    summary:
      "India's Account Aggregator makes data tracking effortless. But does having all your numbers in one dashboard mean you have a financial plan?",
    to: "/blog/financial-apps-vs-financial-planning" as const,
  },
  {
    tag: "Behavioral Finance",
    title: "You're Tracking Your Stocks Every Day. But Are You Tracking Your Financial Life?",
    summary:
      "Stop confusing portfolio movement with financial progress. Why building a review habit matters more than daily stock market checking.",
    to: "/blog/stop-tracking-stocks-every-day" as const,
  },
  {
    tag: "Financial Planning",
    title: "You Have Investments, Insurance and Savings. But Do You Have a Financial Plan?",
    summary:
      "Most families don't lack financial products; they lack a complete picture of how those products fit together. Why managing money in silos fails.",
    to: "/blog/investments-vs-financial-plan" as const,
  },
];

function BlogSection() {
  return (
    <section id="blog" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label-caps text-xs text-[var(--brass)]">Blog</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
            Notes on Indian Family Finance
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Essays, arithmetic, and frameworks on building your own plan and seeing your family's
            financial life as a whole.
          </p>
        </div>
        <Link
          to="/blog"
          className="shrink-0 text-sm font-semibold text-primary underline underline-offset-4 hover:text-[var(--highlight)]"
        >
          Explore all articles →
        </Link>
      </div>

      {/* Featured Internal Article */}
      <Link
        to="/blog/missed-health-insurance-renewal"
        className="group mt-8 block rounded-xl border border-[var(--brass)]/50 bg-card p-6 transition-all hover:border-[var(--brass)] hover:shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps rounded-full border border-[var(--brass)]/60 bg-[var(--brass)]/10 px-2.5 py-0.5 text-xs text-[var(--brass)]">
            Financial Clarity
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">5 min read</span>
        </div>
        <h3 className="mt-3 font-display text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
          Seven Years of Health Insurance. One Missed Renewal. And a Costly Lesson.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          They had paid their health insurance premiums for seven years. When they needed the policy
          during a hospitalisation, they discovered it had expired nearly 60 days earlier. A lesson
          in financial ownership.
        </p>
        <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:text-[var(--highlight)]">
          Read full article →
        </span>
      </Link>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {BLOG_ARTICLES.map((post) => (
          <Link
            key={post.title}
            to={post.to}
            className="group flex flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--brass)]"
          >
            <div>
              <p className="label-caps text-xs text-[var(--brass)]">{post.tag}</p>
              <h3 className="mt-2 font-display text-base font-semibold group-hover:text-primary text-foreground transition-colors">
                {post.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:text-[var(--highlight)]">
              Read article →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * 9. FAQ — New Section
 */
const FAQ_ITEMS = [
  {
    q: "Is the masterclass free?",
    a: "Yes. Registration for this live educational masterclass is free.",
  },
  {
    q: "Who should attend?",
    a: "Indian working professionals and families who want to understand their finances more holistically, whether they are beginning their financial journey or already saving and investing.",
  },
  {
    q: "Do I need investment knowledge?",
    a: "No. The session is intended to make important financial concepts easier to understand.",
  },
  {
    q: "Will you recommend stocks or mutual funds?",
    a: "The masterclass focuses on financial understanding and decision-making principles, not specific stock or fund recommendations.",
  },
  {
    q: "Is this personalised financial advice?",
    a: "No. It is an educational session. Individual financial circumstances may require separate professional advice.",
  },
  {
    q: "How long is the session?",
    a: "Approximately 90 minutes.",
  },
  {
    q: "When will I receive joining details?",
    a: "Upon completing your free registration, you will immediately see your confirmation details with an option to add the session to your calendar. We also send your private webinar access link and schedule reminders directly to your registered email address and WhatsApp number prior to the live masterclass.",
  },
];

function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="text-center">
        <p className="label-caps text-xs text-[var(--brass)]">Answers</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl text-foreground">
          Frequently Asked Questions
        </h2>
      </div>

      <Accordion type="single" collapsible className="mt-10">
        {FAQ_ITEMS.map((item, idx) => (
          <AccordionItem key={idx} value={`item-${idx}`} className="border-border">
            <AccordionTrigger className="text-left font-display text-base font-semibold text-foreground hover:text-primary">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground pb-4">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/**
 * 10. Final CTA
 */
function FinalCta() {
  const [chipDate, setChipDate] = useState(() => formatSessionDayMonth());
  const { open } = useRegistration();

  useEffect(() => {
    setChipDate(formatSessionDayMonth());
  }, []);

  return (
    <section
      id="register"
      className="scroll-mt-24 bg-primary px-4 py-16 sm:py-20 text-primary-foreground"
    >
      <div className="mx-auto max-w-2xl text-center">
        <span className="label-caps inline-block rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-3.5 py-1 text-xs text-primary-foreground">
          Reserve Your Free Seat
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold sm:text-3xl text-balance">
          Before You Make Another Financial Decision, Understand Your Complete Financial Picture.
        </h2>
        <p className="mt-4 text-base opacity-90 leading-relaxed max-w-xl mx-auto">
          Join The Money Reality Masterclass and explore a clearer way to look at your money.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-2 text-xs sm:text-sm">
          <Calendar size={15} />
          <span>Next Live Session: Saturday, {chipDate} at 7:00 PM IST</span>
        </div>

        <div className="mt-8">
          <Button
            onClick={open}
            size="lg"
            className="h-auto bg-[var(--background)] px-10 py-4 text-base font-semibold text-primary hover:bg-[var(--highlight)] hover:text-white transition-all shadow-md"
          >
            Reserve My Free Seat →
          </Button>
        </div>
        <p className="mt-3 text-xs opacity-75">
          100% Free · 90-minute live online educational masterclass
        </p>
      </div>
    </section>
  );
}
