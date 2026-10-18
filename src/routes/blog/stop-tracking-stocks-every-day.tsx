import { createFileRoute } from "@tanstack/react-router";
import { BlogArticleView } from "@/components/site/BlogArticleView";

const PAGE_TITLE = "Stop Tracking Stocks Every Day | One Page Plan";
const PAGE_DESCRIPTION =
  "Stop confusing portfolio movement with financial progress. Learn why building a review habit matters more than daily stock market checking.";
const CANONICAL_URL = "https://www.onepageplan.in/blog/stop-tracking-stocks-every-day";

export const Route = createFileRoute("/blog/stop-tracking-stocks-every-day")({
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
            "You're Tracking Your Stocks Every Day. But Are You Tracking Your Financial Life?",
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
          articleSection: "Behavioral Finance",
          keywords: [
            "Stock Market",
            "Behavioral Finance",
            "Portfolio Tracking",
            "Financial Habits",
          ],
        }),
      },
    ],
  }),
  component: StopTrackingStocksPage,
});

function StopTrackingStocksPage() {
  return (
    <BlogArticleView
      title="You're Tracking Your Stocks Every Day. But Are You Tracking Your Financial Life?"
      breadcrumbTitle="Stop Tracking Stocks Daily"
      category="Behavioral Finance"
      tags={["Stock Market", "Behavioral Finance", "Portfolio Tracking"]}
      readingTime="4 min read"
      publishDate="October 13, 2026"
      contentTrackingName="blog_stop_tracking_stocks"
      leadParagraph={
        <p>
          You know exactly how much your portfolio gained today. But do you know whether your family
          is financially on track?
        </p>
      }
    >
      <p>For many investors, checking the stock market has become a daily habit.</p>

      <p>The market opens, and so does the trading app.</p>

      <p>A stock moves up. Another falls. Your portfolio changes colour.</p>

      <p>Even when you have no intention of buying or selling, you check again.</p>

      <p>
        Mutual fund investors may do something similar, tracking NAVs, returns and daily portfolio
        values.
      </p>

      <p>There is nothing inherently wrong with checking your investments.</p>

      <p className="font-semibold text-foreground">
        The question is whether the frequency of checking is helping you make better decisions.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Movement is not necessarily progress
      </h2>

      <p>Imagine your mutual fund portfolio grows by ₹40,000 in a month.</p>

      <p>It feels like progress.</p>

      <p>
        But what if, during the same period, your emergency savings declined, an insurance renewal
        was overlooked, or your household liabilities increased?
      </p>

      <p>Your portfolio performed well.</p>

      <p className="font-semibold text-foreground">
        But did your overall financial position improve?
      </p>

      <p>Those are two different questions.</p>

      <p>The financial market measures changes in the value of your investments.</p>

      <p>Your financial plan must consider your broader life.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        The problem with watching everything too closely
      </h2>

      <p>Stock prices change constantly.</p>

      <p>But many important financial goals are measured over years or decades.</p>

      <p>
        When we monitor long-term investments too frequently, everyday market movements can begin to
        feel more important than they really are.
      </p>

      <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90 my-3">
        <li>A decline may create unnecessary anxiety.</li>
        <li>A sharp rise may create overconfidence.</li>
        <li>An attractive recent return may encourage us to chase another investment.</li>
      </ul>

      <p>
        Frequent monitoring doesn&apos;t automatically lead to poor decisions. But it creates more
        opportunities to react to information that may have little relevance to your long-term plan.
      </p>

      <p>And there is another cost: attention.</p>

      <p>
        Every minute spent worrying about a temporary market movement is attention that could have
        been directed towards decisions within your control.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        The things that deserve your attention
      </h2>

      <p>Consider five questions worth reviewing periodically:</p>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 my-4">
        <div className="space-y-1">
          <p className="font-bold text-foreground">1. Is your emergency reserve adequate?</p>
          <p className="text-sm text-muted-foreground">
            Could your family manage an unexpected medical expense, job loss or major repair?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">2. Are your financial commitments manageable?</p>
          <p className="text-sm text-muted-foreground">
            Are loan repayments and other obligations putting pressure on your household?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">3. Is your family adequately protected?</p>
          <p className="text-sm text-muted-foreground">
            Are relevant insurance policies active, understood and regularly reviewed?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">
            4. Are you making progress towards your goals?
          </p>
          <p className="text-sm text-muted-foreground">
            Are your savings and investment contributions aligned with the amount and timeline
            required?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">5. Has something important changed?</p>
          <p className="text-sm text-muted-foreground">
            A new child, a job change, a parent becoming financially dependent, or a change in
            health may require more attention than a movement in the stock market.
          </p>
        </div>
      </div>

      <p>These are financial planning questions.</p>

      <p>And their answers can matter far more than today&apos;s portfolio return.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Build a review habit, not a checking habit
      </h2>

      <p>A financial review does not need to be complicated.</p>

      <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90 my-3">
        <li>You might review cash flow and upcoming obligations monthly.</li>
        <li>You might review your overall financial position quarterly.</li>
        <li>
          You might conduct a comprehensive annual review of insurance, goals, nominations,
          liabilities and important documents.
        </li>
      </ul>

      <p>The exact frequency should depend on your circumstances.</p>

      <p>But the principle is simple:</p>

      <p className="font-semibold text-foreground text-lg">
        Review your finances according to what needs a decision, not according to how frequently an
        app updates its numbers.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        What if doing less is sometimes the right financial action?
      </h2>

      <p>Financial platforms make transactions easy.</p>

      <p>But good financial planning doesn&apos;t always require a transaction.</p>

      <p>Sometimes the appropriate decision is to continue an existing plan.</p>

      <p>Sometimes it is to strengthen emergency savings.</p>

      <p>Sometimes it is to repay an expensive liability.</p>

      <p>Sometimes it is to update records or protect a family member.</p>

      <p>And sometimes the best decision is to change nothing.</p>

      <p>You don&apos;t need to watch your wealth every hour to build it responsibly.</p>

      <p>You need to understand what you&apos;re building it for.</p>

      <p className="font-bold text-primary text-xl">
        Stop confusing portfolio movement with financial progress.
      </p>

      <p className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground italic mt-6">
        Educational information only. Market investments involve risk; review frequencies and
        decisions should reflect individual circumstances.
      </p>
    </BlogArticleView>
  );
}
