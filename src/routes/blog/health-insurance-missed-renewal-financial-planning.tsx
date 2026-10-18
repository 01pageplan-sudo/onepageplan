import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Calendar, Clock, ExternalLink, ArrowRight, CheckCircle2, User } from "lucide-react";

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

const PAGE_TITLE = "Missed Health Insurance Renewal: A Family's Lesson | One Page Plan";
const PAGE_DESCRIPTION =
  "A family paid health insurance premiums for seven years, then discovered a missed renewal during hospitalisation. Learn why financial ownership matters.";
const CANONICAL_URL =
  "https://www.onepageplan.in/blog/health-insurance-missed-renewal-financial-planning";

export const Route = createFileRoute("/blog/health-insurance-missed-renewal-financial-planning")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL_URL },
      { property: "og:site_name", content: "One Page Plan" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESCRIPTION },
      { name: "author", content: "Milan Dodhia" },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      {
        rel: "canonical",
        href: CANONICAL_URL,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: "Seven Years of Health Insurance. One Missed Renewal. And a Costly Lesson.",
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          url: CANONICAL_URL,
          datePublished: "2026-10-13T00:00:00+05:30",
          dateModified: "2026-10-13T00:00:00+05:30",
          inLanguage: "en-IN",
          author: {
            "@type": "Person",
            name: "Milan Dodhia",
            url: "https://www.onepageplan.in",
          },
          publisher: {
            "@type": "Organization",
            name: "One Page Plan",
            url: "https://www.onepageplan.in",
            logo: {
              "@type": "ImageObject",
              url: "https://www.onepageplan.in/favicon.png",
            },
          },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": CANONICAL_URL,
          },
          articleSection: "Financial Clarity",
          keywords: [
            "Health Insurance",
            "Family Financial Planning",
            "Financial Awareness",
            "Insurance Renewal",
          ],
        }),
      },
    ],
  }),
  component: BlogArticlePage,
});

function BlogArticlePage() {
  return (
    <RegistrationProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <ArticleContent />
        </main>
        <Footer />
      </div>
    </RegistrationProvider>
  );
}

function ArticleCtaBox() {
  const { open } = useRegistration();

  const handleCtaClick = () => {
    track("Contact", { content_name: "blog_health_insurance_cta" });
    open();
  };

  return (
    <div className="my-12 rounded-xl border border-[var(--brass)]/40 bg-card p-6 sm:p-8 shadow-xs">
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

function ArticleContent() {
  useEffect(() => {
    track("ViewContent", {
      content_name: "health_insurance_missed_renewal_blog",
      content_type: "article",
    });
  }, []);

  return (
    <article className="mx-auto max-w-3xl px-4">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/blog">Blog</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Insurance Renewal Lesson</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Info */}
      <header className="space-y-4 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps rounded-full border border-[var(--brass)]/60 bg-[var(--brass)]/10 px-3 py-1 text-[var(--brass)]">
            Financial Clarity
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Family Financial Planning</span>
        </div>

        <h1 className="text-[clamp(2rem,4.5vw,3rem)] leading-[1.12] font-bold tracking-tight text-foreground text-balance">
          Seven Years of Health Insurance. One Missed Renewal. And a Costly Lesson.
        </h1>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground sm:text-sm">
          <div className="inline-flex items-center gap-1.5">
            <User className="h-4 w-4 text-[var(--brass)]" />
            <span>Milan Dodhia</span>
          </div>
          <span>·</span>
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[var(--brass)]" />
            <time dateTime="2026-10-13">October 13, 2026</time>
          </div>
          <span>·</span>
          <div className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[var(--brass)]" />
            <span>5 min read</span>
          </div>
        </div>
      </header>

      {/* Article Body */}
      <div className="pt-8 text-foreground/90 leading-relaxed text-base sm:text-lg space-y-6">
        {/* Intro */}
        <p className="font-semibold text-lg sm:text-xl leading-relaxed text-foreground">
          They had paid their health insurance premiums for seven years. When they needed the policy
          during a hospitalisation, they discovered it had expired nearly 60 days earlier.
        </p>

        <p>
          The problem wasn&apos;t that they had never understood the importance of health insurance.
          They had taken the sensible step of buying a policy and keeping it going year after year.
        </p>

        <p>What they had not done was build a simple system to make sure it stayed active.</p>

        {/* Section 1 */}
        <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          What happened
        </h2>

        <p>
          When the family originally bought the policy, they had no known health conditions. Their
          insurance agent helped them arrange the cover and, for years, reminded them when it was
          time to renew.
        </p>

        <p>Over time, those reminders became something the family depended on.</p>

        <p>
          Then the agent stopped working in that business. The reminders stopped too. Nobody in the
          family had independently recorded the due date or put a renewal check in place.
        </p>

        <p>The premium went unpaid.</p>

        <p>
          They realised what had happened only when hospitalisation created a need to use the
          insurance, almost <strong>60 days after the policy&apos;s expiry date</strong>.
        </p>

        <p>
          At exactly the moment they expected a financial safety net to help, they discovered they
          could no longer assume the policy would respond to their claim.
        </p>

        <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground italic">
          This real-life account is shared without identifying details. The precise insurer decision
          and claim outcome have not been independently verified, so no claim settlement outcome is
          asserted here.
        </div>

        {/* Section 2 */}
        <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Why seven years of continuity mattered
        </h2>

        <p>
          The family&apos;s situation had changed since the policy was first purchased. They were
          older, and health conditions had developed during the intervening years.
        </p>

        <p>
          Replacing a policy in those circumstances may not mean simply buying an identical one
          again. Depending on the product and underwriting, a new policy could involve different
          premiums, exclusions or other coverage restrictions, and fresh waiting periods for certain
          conditions. The available options may also be less suitable.
        </p>

        <p>
          There is a second issue: <strong>continuity benefits</strong>. Under India&apos;s
          health-insurance rules, renewing within the applicable grace period helps preserve accrued
          credits such as completed waiting periods. For annual-premium policies, the standard grace
          period is <strong>30 days</strong>. At almost 60 days after expiry, this family was
          outside that standard period. Whether any reinstatement or other remedy is available
          depends on the insurer, policy terms, and applicable rules.
        </p>

        <p>
          After years of maintaining cover, losing continuity can be much more consequential than
          merely forgetting one payment.
        </p>

        <p className="rounded-md border-l-2 border-[var(--brass)] bg-card/40 py-2 px-3 text-sm text-muted-foreground">
          For the IRDAI explanation of grace periods and continuity benefits, see{" "}
          <a
            href="https://irdai.gov.in/health-dept"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4 hover:text-[var(--highlight)]"
          >
            IRDAI&apos;s Health Insurance FAQ
            <ExternalLink className="inline h-3.5 w-3.5" />
          </a>
          .
        </p>

        {/* Section 3 */}
        <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          The agent wasn&apos;t the only missing link
        </h2>

        <p>
          It would be easy to turn this into a story about an agent who stopped sending reminders.
          But that would miss the more useful lesson.
        </p>

        <p>
          An agent can help with purchases, paperwork, renewals and claims. A good agent can be
          genuinely valuable. Yet a family&apos;s protection should never depend entirely on whether
          one individual remembers to call.
        </p>

        <p>The responsibility needs a home within the household.</p>

        <p>
          The same applies to loan due dates, nominations, investment records, emergency funds,
          important documents and other financial commitments. You may use apps, advisers and
          reminders to help manage them. But you still need to know what exists, when it needs
          attention, and what happens if nobody acts.
        </p>

        <p className="font-semibold text-foreground">
          You can outsource assistance. You cannot completely outsource responsibility.
        </p>

        {/* Section 4 */}
        <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Owning products is not the same as having a plan
        </h2>

        <p>
          Think about how many financial products an ordinary family may hold: health insurance,
          life insurance, bank accounts, provident fund balances, investments, loans and perhaps a
          property.
        </p>

        <p>Each product may have its own app, statement, agent or service provider.</p>

        <p>But who is responsible for seeing the whole picture?</p>

        <p>
          Who knows when a critical policy renews? Who can quickly find the documents during an
          emergency? Who knows whether coverage remains appropriate as the family changes? Who
          notices if something important quietly falls through the cracks?
        </p>

        <p>
          These are not questions about choosing the next financial product. They are questions
          about <strong>financial clarity</strong>.
        </p>

        {/* Section 5 */}
        <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          A simple 15-minute protection check
        </h2>

        <p>
          Before you check what your investments earned today, try checking whether the protections
          your family already pays for are actually in place.
        </p>

        <div className="my-6 space-y-4 rounded-xl border border-border bg-card p-6">
          <ol className="space-y-4 list-decimal list-inside text-sm sm:text-base">
            <li className="leading-relaxed">
              <strong className="text-foreground">List the policies.</strong> Record the insurer,
              policy number, covered family members, sum insured and renewal date for health and
              life policies.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Confirm their status.</strong> Verify coverage and
              payment status directly through the insurer&apos;s official website, app, helpline or
              documents; do not rely on an old message alone.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Set reminders you control.</strong> Put reminders
              on your own calendar well before each due date, with a second reminder to verify
              successful renewal.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Make the information accessible.</strong> Ensure
              another trusted adult in the household knows where to find the policy and claims
              information. Store sensitive details securely.
            </li>
            <li className="leading-relaxed">
              <strong className="text-foreground">Review at least annually.</strong> Check whether
              your cover, nominees, contact details and emergency arrangements still reflect your
              family&apos;s situation.
            </li>
          </ol>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          If a policy has already lapsed, contact the insurer promptly about possible reinstatement
          or renewal options and seek a written response. Do not assume that a missed renewal
          automatically has one universal outcome.
        </p>

        {/* Section 6 */}
        <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          The real financial question
        </h2>

        <p>
          We spend a surprising amount of attention on the value of our investments. We refresh apps
          to see whether our shares or mutual funds are up or down.
        </p>

        <p>
          Yet an overlooked renewal can matter far more to a family than a day of market movement.
        </p>

        <p>
          Financial security is not built only by accumulating assets. It also requires knowing what
          you own, what you owe, what protects you, and what needs attention next.
        </p>

        <p>
          That is the thinking behind <strong>One Page Plan</strong>: step away from isolated
          products and see your financial life as a whole.
        </p>

        <p className="font-semibold text-foreground text-lg">
          Before doing more with your money, make sure you understand what you already have.
        </p>

        {/* Single Primary CTA Box */}
        <ArticleCtaBox />

        {/* Article Footer Navigation */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4 hover:text-[var(--highlight)]"
          >
            ← Back to all articles
          </Link>
          <div className="flex flex-wrap gap-2">
            {["Health Insurance", "Family Financial Planning", "Insurance Renewal"].map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
