import { createFileRoute } from "@tanstack/react-router";
import { BlogArticleView } from "@/components/site/BlogArticleView";

const PAGE_TITLE = "Financial Apps vs Financial Planning | One Page Plan";
const PAGE_DESCRIPTION =
  "Having all your financial information in one app doesn't mean you have a plan. Learn why financial clarity requires more than account aggregation.";
const CANONICAL_URL = "https://onepageplan.in/blog/financial-apps-vs-financial-planning";

export const Route = createFileRoute("/blog/financial-apps-vs-financial-planning")({
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
          headline: "Your Financial App Shows You Everything. But Does It Tell You What Matters?",
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
          articleSection: "Financial Clarity",
          keywords: [
            "Financial Apps",
            "Account Aggregator",
            "Financial Planning",
            "Financial Clarity",
          ],
        }),
      },
    ],
  }),
  component: FinancialAppsVsPlanningPage,
});

function FinancialAppsVsPlanningPage() {
  return (
    <BlogArticleView
      title="Your Financial App Shows You Everything. But Does It Tell You What Matters?"
      breadcrumbTitle="Financial Apps vs Planning"
      category="Financial Clarity"
      tags={["Financial Apps", "Account Aggregator", "Financial Planning"]}
      readingTime="4 min read"
      publishDate="October 13, 2026"
      contentTrackingName="blog_financial_apps_vs_planning"
      leadParagraph={
        <p>
          What good is having all your financial information in one place if you still don&apos;t
          know where you stand?
        </p>
      }
    >
      <p>India&apos;s financial technology ecosystem has made remarkable progress.</p>

      <p>
        Today, you can access bank balances, investments, loans and other financial information
        through digital platforms. India&apos;s Account Aggregator framework also enables
        consent-based financial data sharing between participating financial institutions.
      </p>

      <p>
        What once required collecting statements from several institutions can now be significantly
        easier.
      </p>

      <p>This is genuinely useful progress.</p>

      <p>But there is an important question we rarely ask:</p>

      <p className="font-semibold text-foreground">
        Does having access to all your financial information mean you have a financial plan?
      </p>

      <p>Not necessarily.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        More information does not automatically mean more clarity
      </h2>

      <p>Imagine opening an app and seeing:</p>

      <div className="rounded-xl border border-border bg-card p-5 my-4">
        <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90">
          <li>₹18 lakh invested in mutual funds.</li>
          <li>₹7 lakh in direct equities.</li>
          <li>₹4 lakh in bank deposits.</li>
          <li>An outstanding home loan of ₹42 lakh.</li>
          <li>Two insurance policies.</li>
        </ul>
      </div>

      <p>
        You can see the numbers. You can track their movements. You might even see attractive graphs
        showing how your investments have performed.
      </p>

      <p>But those numbers alone cannot answer some of the most important financial questions.</p>

      <div className="rounded-lg border-l-2 border-[var(--brass)] bg-card/40 p-4 space-y-2 text-sm sm:text-base text-foreground/90">
        <p>If your income stopped tomorrow, how long could your family comfortably manage?</p>
        <p>Are your major financial commitments adequately protected?</p>
        <p>Is your family making progress towards its actual goals?</p>
        <p>Are there policies, liabilities, or financial responsibilities that need attention?</p>
        <p className="font-semibold text-foreground">
          Are you financially secure, or simply financially active?
        </p>
      </div>

      <p>These questions require something more than aggregation.</p>

      <p>They require interpretation, context and deliberate planning.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Technology is useful. Dependence is the risk.
      </h2>

      <p>
        Financial apps can help organise information, calculate returns and simplify record-keeping.
      </p>

      <p>There is no reason to reject these advantages.</p>

      <p>
        The concern begins when we become so dependent on technology that we stop taking personal
        responsibility for understanding our finances.
      </p>

      <p>Consider your insurance policies.</p>

      <p>Would you know the renewal date without opening an app?</p>

      <p>Would your spouse know where the policy documents are stored?</p>

      <p>Could your family identify important liabilities if something happened to you?</p>

      <p>
        If your favourite finance app disappeared tomorrow, would you still have a reliable record
        of your financial position?
      </p>

      <p>These aren&apos;t arguments against technology.</p>

      <p>They are reasons to maintain financial awareness independently of any single platform.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Your financial information and your financial decisions are different things
      </h2>

      <p>An app may tell you that your investments grew by 12%.</p>

      <p>
        But whether that growth is sufficient depends on your financial goals, remaining time,
        future obligations and ability to handle risk.
      </p>

      <p>It may tell you your net worth increased.</p>

      <p>But that doesn&apos;t automatically mean your financial resilience improved.</p>

      <p>It may show your insurance policies.</p>

      <p>
        But you still need to understand their coverage, limitations and renewal responsibilities.
      </p>

      <p className="font-semibold text-foreground text-lg">
        Financial information tells you what you own. Financial clarity helps you understand what it
        means for your life.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Start with a simple financial picture
      </h2>

      <p>You don&apos;t necessarily need another sophisticated dashboard.</p>

      <p>Begin by preparing a consolidated view containing:</p>

      <div className="rounded-xl border border-border bg-card p-6 my-4">
        <ol className="space-y-3 list-decimal list-inside text-sm sm:text-base">
          <li>
            <strong>Your assets and liabilities.</strong>
          </li>
          <li>
            <strong>Your regular income and expenses.</strong>
          </li>
          <li>
            <strong>Your emergency reserves.</strong>
          </li>
          <li>
            <strong>Your insurance coverage and renewal dates.</strong>
          </li>
          <li>
            <strong>Your important financial goals and commitments.</strong>
          </li>
          <li>
            <strong>Your next review dates and actions.</strong>
          </li>
        </ol>
      </div>

      <p>Review it periodically, and update it when something significant changes.</p>

      <p>The objective isn&apos;t to track every rupee every day.</p>

      <p>It&apos;s to know where you stand without constantly depending on an app to tell you.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Before the next financial decision, understand your current position
      </h2>

      <p>Technology has made it easier to access financial information.</p>

      <p>The next step is using that information thoughtfully.</p>

      <p>
        Because the purpose of financial planning isn&apos;t to have the most impressive dashboard.
      </p>

      <p>It&apos;s to make better decisions for the life you&apos;re building.</p>

      <p className="font-semibold text-foreground text-lg">
        Start with clarity. Then decide what action, if any, is necessary.
      </p>

      <p className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground italic mt-6">
        Educational information only. This article does not constitute personalised investment
        advice.
      </p>
    </BlogArticleView>
  );
}
