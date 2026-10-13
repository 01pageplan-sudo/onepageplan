import { createFileRoute } from "@tanstack/react-router";
import { BlogArticleView } from "@/components/site/BlogArticleView";

const PAGE_TITLE = "Investments vs Financial Plan | One Page Plan";
const PAGE_DESCRIPTION =
  "Most families don't lack financial products; they lack a complete picture of how those products fit together. Why a collection of products is not a plan.";
const CANONICAL_URL = "https://onepageplan.in/blog/investments-vs-financial-plan";

export const Route = createFileRoute("/blog/investments-vs-financial-plan")({
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
          headline:
            "You Have Investments, Insurance and Savings. But Do You Have a Financial Plan?",
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          url: CANONICAL_URL,
          datePublished: "2026-10-13T00:00:00+05:30",
          dateModified: "2026-10-13T00:00:00+05:30",
          inLanguage: "en-IN",
          author: {
            "@type": "Person",
            name: "Milan Dodhia",
            url: "https://onepageplan.in",
          },
          publisher: {
            "@type": "Organization",
            name: "One Page Plan",
            url: "https://onepageplan.in",
            logo: {
              "@type": "ImageObject",
              url: "https://onepageplan.in/favicon.png",
            },
          },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": CANONICAL_URL,
          },
          articleSection: "Financial Planning",
          keywords: [
            "Financial Planning",
            "Wealth Management",
            "Family Finance",
            "Asset Coordination",
          ],
        }),
      },
    ],
  }),
  component: InvestmentsVsPlanPage,
});

function InvestmentsVsPlanPage() {
  return (
    <BlogArticleView
      title="You Have Investments, Insurance and Savings. But Do You Have a Financial Plan?"
      breadcrumbTitle="Investments vs Financial Plan"
      category="Financial Planning"
      tags={["Financial Planning", "Wealth Management", "Family Finance"]}
      readingTime="5 min read"
      publishDate="October 13, 2026"
      contentTrackingName="blog_investments_vs_plan"
      leadParagraph={
        <p>
          Most families don&apos;t lack financial products. They lack a complete picture of how
          those products fit together.
        </p>
      }
    >
      <p>
        Ask someone whether they have made financial arrangements for their future, and you&apos;ll
        probably hear familiar answers:
      </p>

      <div className="rounded-lg border-l-2 border-[var(--brass)] bg-card/40 p-4 space-y-2 text-sm sm:text-base italic text-foreground/90">
        <p>&ldquo;I have SIPs running.&rdquo;</p>
        <p>&ldquo;I have an LIC policy.&rdquo;</p>
        <p>&ldquo;I bought a flat.&rdquo;</p>
        <p>&ldquo;I have fixed deposits.&rdquo;</p>
        <p>&ldquo;My CA looks after my taxes.&rdquo;</p>
      </div>

      <p>These may all be sensible financial decisions.</p>

      <p>But here&apos;s the question:</p>

      <p className="font-semibold text-foreground text-lg">
        Who is looking at the complete picture?
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        We manage our money in separate compartments
      </h2>

      <p>For many Indian families, financial decisions are spread across different people.</p>

      <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90 my-3">
        <li>The insurance agent handles insurance.</li>
        <li>The mutual fund distributor looks after investments.</li>
        <li>The chartered accountant handles taxation.</li>
        <li>The bank helps with deposits and loans.</li>
      </ul>

      <p>Each professional may do their job competently.</p>

      <p className="font-semibold text-foreground">
        But nobody necessarily sees the relationship between all these decisions.
      </p>

      <p>
        An investment can be suitable when viewed alone but inappropriate when considered alongside
        an existing liability or an upcoming financial obligation.
      </p>

      <p>
        A family&apos;s tax planning can be organised while its emergency savings remain inadequate.
      </p>

      <p>
        Insurance premiums can be paid regularly without anyone checking whether the actual coverage
        still meets the family&apos;s needs.
      </p>

      <p>The individual pieces may appear organised. The overall financial picture may not be.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        A collection of products is not a plan
      </h2>

      <p>Consider a family earning ₹25 lakh annually.</p>

      <p>
        They own a home, invest regularly in mutual funds, have life insurance and maintain some
        fixed deposits.
      </p>

      <p>From the outside, their financial arrangements look fairly complete.</p>

      <p>But a closer review might reveal:</p>

      <div className="rounded-xl border border-border bg-card p-5 my-4">
        <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90">
          <li>Most of their wealth is tied up in a property.</li>
          <li>Their readily accessible savings are limited.</li>
          <li>They have an outstanding home loan.</li>
          <li>Important insurance coverage has not been reviewed for years.</li>
          <li>Retirement and children&apos;s education goals are not properly quantified.</li>
          <li>
            One spouse has little visibility into where the family&apos;s financial documents are
            kept.
          </li>
        </ul>
      </div>

      <p>Having several financial products does not resolve these issues automatically.</p>

      <p>
        The family needs to understand how its assets, liabilities, risks and future obligations
        interact.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Financial planning begins with questions, not products
      </h2>

      <p>Before deciding whether to make another investment, ask:</p>

      <div className="rounded-lg border-l-2 border-[var(--brass)] bg-card/40 p-4 space-y-2 text-sm sm:text-base text-foreground/90">
        <p>What are we trying to achieve?</p>
        <p>What do we already have?</p>
        <p>What do we owe?</p>
        <p>Which financial risks could seriously affect our family?</p>
        <p>How much flexibility do we have if our circumstances change?</p>
        <p className="font-semibold text-foreground">
          What is the next most important financial decision?
        </p>
      </div>

      <p>These questions change the conversation.</p>

      <p>
        Instead of asking, &ldquo;Where should I invest next?&rdquo; you begin asking, &ldquo;What
        does my family actually need next?&rdquo;
      </p>

      <p>Sometimes the answer will involve an investment.</p>

      <p>
        Sometimes it will involve insurance, debt management, liquidity, documentation or simply
        doing nothing until the next review.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        The missing element is coordination
      </h2>

      <p>Good financial planning brings individual decisions together.</p>

      <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90 my-3">
        <li>Your investments should be considered alongside your liabilities.</li>
        <li>
          Your insurance should be considered alongside your family&apos;s dependency on income.
        </li>
        <li>
          Your financial goals should be considered alongside available savings and expected future
          expenses.
        </li>
        <li>
          Your estate documents and nominations should be considered alongside the assets you own
          and the laws governing their transfer.
        </li>
      </ul>

      <p>
        Without coordination, you may make many individually reasonable decisions while overlooking
        an important family-level risk.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        One simple exercise
      </h2>

      <p>Take a blank page. Write down the following:</p>

      <div className="rounded-xl border border-border bg-card p-6 my-4 space-y-3 text-sm sm:text-base">
        <p>
          <strong className="text-foreground">What we own:</strong> property, bank balances,
          investments and other assets.
        </p>
        <p>
          <strong className="text-foreground">What we owe:</strong> loans and major financial
          commitments.
        </p>
        <p>
          <strong className="text-foreground">What protects us:</strong> insurance and emergency
          reserves.
        </p>
        <p>
          <strong className="text-foreground">What we&apos;re working towards:</strong> education,
          retirement, family obligations and other goals.
        </p>
        <p>
          <strong className="text-foreground">What needs attention:</strong> gaps, upcoming
          payments, missing records and decisions requiring review.
        </p>
      </div>

      <p>Now ask another family member to explain the same picture.</p>

      <p>
        If that is difficult, the first priority may not be another investment. It may be getting
        organised.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Your family&apos;s finances should make sense as a whole
      </h2>

      <p>
        Financial products are tools. Professionals contribute expertise. Technology helps
        consolidate information.
      </p>

      <p>But a meaningful plan connects everything to your family&apos;s actual circumstances.</p>

      <p className="font-bold text-primary text-xl">
        The real question isn&apos;t how many financial products you own. It&apos;s whether they
        work together towards the life you want.
      </p>

      <p className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground italic mt-6">
        Educational information only. Specific financial arrangements require consideration of
        personal circumstances.
      </p>
    </BlogArticleView>
  );
}
