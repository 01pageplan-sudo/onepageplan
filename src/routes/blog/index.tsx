import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Clock, ArrowRight, User, BookOpen } from "lucide-react";

import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { RegistrationProvider, useRegistration } from "@/components/site/registration-context";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { track } from "@/lib/analytics";

const PAGE_TITLE = "Blog: Financial Clarity & Family Finance Notes | One Page Plan";
const PAGE_DESCRIPTION =
  "Practical essays, checklists, and frameworks on Indian family finance, protection continuity, and building clarity on one page.";
const CANONICAL_URL = "https://onepageplan.in/blog";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL_URL },
      { property: "og:site_name", content: "One Page Plan" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESCRIPTION },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      {
        rel: "canonical",
        href: CANONICAL_URL,
      },
    ],
  }),
  component: BlogIndexPage,
});

const ARTICLES = [
  {
    slug: "/blog/missed-health-insurance-renewal",
    title: "Seven Years of Health Insurance. One Missed Renewal. And a Costly Lesson.",
    category: "Financial Clarity",
    tag: "Insurance Renewal",
    readingTime: "5 min read",
    date: "October 13, 2026",
    summary:
      "For seven years, they paid their health insurance premiums. When they finally needed the policy, they discovered it had expired nearly 60 days earlier. A real-life account and 5-point protection checklist on why financial ownership must remain in the household.",
    featured: true,
  },
  {
    slug: "/blog/financial-apps-vs-financial-planning",
    title: "Your Financial App Shows You Everything. But Does It Tell You What Matters?",
    category: "Financial Clarity",
    tag: "Fintech & Clarity",
    readingTime: "4 min read",
    date: "October 13, 2026",
    summary:
      "India's fintech and Account Aggregator ecosystem makes tracking effortless. But does having all your numbers in one dashboard mean you have a financial plan? Learn why more information does not automatically mean more clarity.",
    featured: false,
  },
  {
    slug: "/blog/stop-tracking-stocks-every-day",
    title: "You're Tracking Your Stocks Every Day. But Are You Tracking Your Financial Life?",
    category: "Behavioral Finance",
    tag: "Market Habits",
    readingTime: "4 min read",
    date: "October 13, 2026",
    summary:
      "You know exactly how much your portfolio gained today. But do you know whether your family is financially on track? Stop confusing portfolio movement with financial progress and build a review habit.",
    featured: false,
  },
  {
    slug: "/blog/investments-vs-financial-plan",
    title: "You Have Investments, Insurance and Savings. But Do You Have a Financial Plan?",
    category: "Financial Planning",
    tag: "Asset Coordination",
    readingTime: "5 min read",
    date: "October 13, 2026",
    summary:
      "Most families don't lack financial products; they lack a complete picture of how those products fit together. Why managing money in isolated compartments fails to protect family-level risks.",
    featured: false,
  },
  {
    slug: "/blog/financial-advisor-incentives",
    title: "Who Is Your Financial Advisor Really Working For?",
    category: "Advisory & Conflicts",
    tag: "Advisory Models",
    readingTime: "5 min read",
    date: "October 13, 2026",
    summary:
      "Before accepting a financial recommendation, there's one question worth asking: How does the person recommending it get paid? Understanding commissions, fee-only models, and fiduciary roles in India.",
    featured: false,
  },
];

const EXTERNAL_ESSAYS = [
  {
    tag: "Simplicity",
    title: "Simplicity Is the Highest Form of Wealth",
    summary:
      "Why simple financial systems outperform complex portfolios in building long-term wealth.",
    href: "https://www.milanaire.me/simplicity-wealth",
  },
  {
    tag: "Behavioral Finance",
    title: "Why Smart People Make Poor Financial Decisions",
    summary:
      "Even experienced investors make mistakes due to overconfidence. Learn why doing less often leads to better financial outcomes.",
    href: "https://www.milanaire.me/smart-people-financial-mistakes",
  },
  {
    tag: "Mindset",
    title: "The Quiet Trap of Status Spending",
    summary:
      "Why people hesitate to invest but spend easily, and how status-driven decisions quietly delay wealth creation.",
    href: "https://www.milanaire.me/status-spending-trap",
  },
];

function BlogIndexPage() {
  const featuredArticle = ARTICLES[0];
  const regularArticles = ARTICLES.slice(1);

  return (
    <RegistrationProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="mx-auto max-w-4xl px-4">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Blog</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Header */}
            <header className="space-y-3 pb-10 border-b border-border">
              <p className="label-caps text-xs text-[var(--brass)]">
                Notes on Indian family finance
              </p>
              <h1 className="text-[clamp(2rem,4.5vw,3rem)] font-bold tracking-tight text-foreground">
                Blog &amp; Financial Notes
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
                Essays, arithmetic, and frameworks on building your own plan — moving away from
                isolated products to seeing your family&apos;s financial life as a whole.
              </p>
            </header>

            {/* Featured Article */}
            <div className="py-10">
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="h-4 w-4 text-[var(--brass)]" />
                <h2 className="label-caps text-xs text-[var(--brass)]">Featured Article</h2>
              </div>

              <Link
                to={featuredArticle.slug}
                className="group block rounded-2xl border border-[var(--brass)]/50 bg-card p-6 sm:p-8 transition-all hover:border-[var(--brass)] hover:shadow-md"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="label-caps rounded-full border border-[var(--brass)]/60 bg-[var(--brass)]/10 px-3 py-1 text-[var(--brass)]">
                      {featuredArticle.category}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{featuredArticle.tag}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {featuredArticle.title}
                  </h3>

                  <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                    {featuredArticle.summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/70 text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-[var(--brass)]" />
                        Milan Dodhia
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[var(--brass)]" />
                        {featuredArticle.date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[var(--brass)]" />
                        {featuredArticle.readingTime}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:text-[var(--highlight)]">
                      Read full article <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Articles Grid */}
            <div className="py-8 border-t border-border">
              <h2 className="label-caps text-xs text-[var(--brass)] mb-6">
                All Core Articles &amp; Frameworks
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {regularArticles.map((article) => (
                  <Link
                    key={article.slug}
                    to={article.slug}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 transition-all hover:border-[var(--brass)] hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="label-caps text-xs text-[var(--brass)]">
                          {article.category}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{article.readingTime}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {article.title}
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                        {article.summary}
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:text-[var(--highlight)]">
                      Read article →
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* External Thought Pieces */}
            <div className="py-8 border-t border-border">
              <h2 className="label-caps text-xs text-[var(--brass)] mb-6">
                More Essays &amp; Perspectives by Milan Dodhia
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                {EXTERNAL_ESSAYS.map((post) => (
                  <a
                    key={post.title}
                    href={post.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-[var(--brass)]"
                  >
                    <div>
                      <p className="label-caps text-xs text-[var(--brass)]">{post.tag}</p>
                      <h3 className="mt-2 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                        {post.summary}
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary group-hover:text-[var(--highlight)]">
                      Read essay →
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Primary One Page Plan CTA */}
            <BlogPageCta />
          </div>
        </main>
        <Footer />
      </div>
    </RegistrationProvider>
  );
}

function BlogPageCta() {
  const { open } = useRegistration();

  const handleCtaClick = () => {
    track("Contact", { content_name: "blog_index_cta" });
    open();
  };

  return (
    <div className="mt-12 rounded-xl border border-[var(--brass)]/40 bg-card p-6 sm:p-8 shadow-xs">
      <div className="space-y-3">
        <p className="label-caps text-xs text-[var(--brass)]">For One Page Plan readers</p>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Know where your family&apos;s finances stand.
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Explore One Page Plan to see how a clear financial overview can help you identify what
          deserves your attention.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Button
          onClick={handleCtaClick}
          className="h-auto bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground hover:bg-[var(--highlight)] transition-colors"
        >
          See your financial life as a whole →
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Before doing more with your money, understand what you already have.
      </p>
    </div>
  );
}
