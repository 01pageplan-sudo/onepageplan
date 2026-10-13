import { createFileRoute } from "@tanstack/react-router";
import { BlogArticleView } from "@/components/site/BlogArticleView";

const PAGE_TITLE = "Understanding Financial Advisor Incentives | One Page Plan";
const PAGE_DESCRIPTION =
  "Before accepting a financial recommendation, understand how the advisor gets paid. Learn how commissions and fees shape financial advice in India.";
const CANONICAL_URL = "https://onepageplan.in/blog/financial-advisor-incentives";

export const Route = createFileRoute("/blog/financial-advisor-incentives")({
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
          headline: "Who Is Your Financial Advisor Really Working For?",
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
          articleSection: "Advisory & Conflicts",
          keywords: [
            "Financial Advisors",
            "Commissions vs Fees",
            "SEBI RIA",
            "Mutual Fund Distributors",
          ],
        }),
      },
    ],
  }),
  component: AdvisorIncentivesPage,
});

function AdvisorIncentivesPage() {
  return (
    <BlogArticleView
      title="Who Is Your Financial Advisor Really Working For?"
      breadcrumbTitle="Financial Advisor Incentives"
      category="Advisory & Conflicts"
      tags={["Financial Advisors", "Commissions vs Fees", "SEBI RIA"]}
      readingTime="5 min read"
      publishDate="October 13, 2026"
      contentTrackingName="blog_advisor_incentives"
      leadParagraph={
        <p>
          Before accepting a financial recommendation, there&apos;s one question worth asking: How
          does the person recommending it get paid?
        </p>
      }
    >
      <p>Most of us seek help with financial decisions.</p>

      <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90 my-3">
        <li>We ask insurance agents about protection.</li>
        <li>We speak to mutual fund distributors about investments.</li>
        <li>We consult chartered accountants about tax matters.</li>
        <li>We approach bankers when we need loans or deposits.</li>
      </ul>

      <p>
        There is nothing wrong with seeking professional assistance. In fact, good professional
        guidance can be valuable.
      </p>

      <p className="font-semibold text-foreground">
        But understanding how someone earns their income is an important part of evaluating their
        recommendation.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Good intentions and financial incentives can coexist
      </h2>

      <p>Let&apos;s be clear about something.</p>

      <p>Earning a commission doesn&apos;t automatically make someone dishonest.</p>

      <p>
        And charging a fee doesn&apos;t automatically make someone competent or completely free from
        conflicts.
      </p>

      <p>
        Many professionals build long-term relationships with clients and provide meaningful
        support.
      </p>

      <p>
        However, the way a person or business earns money can influence what services receive
        attention and which solutions are presented.
      </p>

      <div className="rounded-xl border border-border bg-card p-6 my-4 space-y-4">
        <p className="text-sm sm:text-base leading-relaxed">
          <strong className="text-foreground">In the first model:</strong> a professional earns
          money when a customer purchases an eligible financial product.
        </p>
        <p className="text-sm sm:text-base leading-relaxed">
          <strong className="text-foreground">In the second model:</strong> a professional is
          compensated directly for an agreed planning or advisory service.
        </p>
      </div>

      <p>
        Both businesses need revenue. But their compensation structures may create different
        incentives.
      </p>

      <p>
        In the first model, recommending an additional product may generate additional compensation.
        In the second, the fee may be payable regardless of whether the client makes a transaction,
        although other conflicts can still exist.
      </p>

      <p className="font-semibold text-foreground text-lg">The difference matters.</p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        The recommendation may be suitable. But ask why.
      </h2>

      <p>Suppose you approach someone with ₹5 lakh available.</p>

      <p>You might receive a recommendation to invest that money.</p>

      <p>But what if you also have expensive outstanding debt?</p>

      <p>What if your emergency reserve is inadequate?</p>

      <p>What if a major family expense is approaching?</p>

      <p>
        In those circumstances, the most useful financial decision may not involve purchasing a new
        investment product.
      </p>

      <p>
        A good recommendation requires understanding the complete situation. And it should be
        possible to explain why a particular action is appropriate.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Understand the role of the professional
      </h2>

      <p>
        In India, different financial professionals operate under different qualifications,
        regulations and commercial arrangements.
      </p>

      <div className="space-y-3 rounded-xl border border-border bg-card p-6 my-4 text-sm sm:text-base">
        <p>
          <strong className="text-foreground">SEBI-registered investment advisers (RIAs)</strong>{" "}
          are regulated for personalised investment advice and must meet applicable fiduciary and
          conduct requirements.
        </p>
        <p>
          <strong className="text-foreground">Mutual fund distributors (MFDs)</strong> operate
          within a distribution framework and may receive commissions on eligible products.
        </p>
        <p>
          <strong className="text-foreground">Chartered accountants (CAs)</strong> may provide
          taxation, accounting and other professional services, but being a CA alone does not
          authorise someone to provide every category of regulated investment advice.
        </p>
        <p>
          <strong className="text-foreground">Insurance intermediaries</strong> have their own
          applicable IRDAI regulatory requirements.
        </p>
      </div>

      <p>These roles are not interchangeable.</p>

      <p className="font-semibold text-foreground">
        Before engaging someone, understand which service they are providing and what they are
        authorised to do.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Five questions every family should ask
      </h2>

      <p>Before accepting an important financial recommendation, consider asking:</p>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 my-4">
        <div className="space-y-1">
          <p className="font-bold text-foreground">1. How are you compensated?</p>
          <p className="text-sm text-muted-foreground">
            Is it a fee, commission, ongoing distribution payment or another arrangement?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">2. What alternatives have you considered?</p>
          <p className="text-sm text-muted-foreground">
            Does the recommendation reflect a comparison of relevant options, including the
            possibility of taking no action?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">3. Why is this suitable for my circumstances?</p>
          <p className="text-sm text-muted-foreground">
            Can the professional explain the relationship between the recommendation, your goals,
            your financial position and your ability to take risk?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">
            4. Are there any conflicts of interest I should know about?
          </p>
          <p className="text-sm text-muted-foreground">
            Could the professional receive additional compensation because you choose a particular
            product?
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-bold text-foreground">5. Who is responsible for ongoing reviews?</p>
          <p className="text-sm text-muted-foreground">
            Will the relationship include future support? What happens if the professional changes
            jobs, closes their business or becomes unavailable?
          </p>
        </div>
      </div>

      <p>
        These aren&apos;t accusations. They are reasonable questions when making decisions that can
        affect your family&apos;s financial security.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        You should understand your finances even when you trust someone else
      </h2>

      <p>Professional guidance can be useful.</p>

      <p>
        But the responsibility to remain informed about your family&apos;s finances should never
        disappear.
      </p>

      <ul className="space-y-2 list-disc list-inside text-sm sm:text-base text-foreground/90 my-3">
        <li>Keep your own records.</li>
        <li>Understand the broad purpose of the products you own.</li>
        <li>Know important renewal dates and obligations.</li>
        <li>Maintain access to relevant financial documents.</li>
        <li>And make sure another trusted family member can understand the overall picture.</li>
      </ul>

      <p>
        Because professional relationships can change. Your family&apos;s financial responsibilities
        continue.
      </p>

      <h2 className="pt-6 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        A good financial decision should make sense even without a sales pitch
      </h2>

      <p>The most useful question is not merely, &ldquo;Is this a good product?&rdquo;</p>

      <p className="font-semibold text-foreground text-lg">
        It is: &ldquo;Is this the right action for my family, at this stage of our financial
        life?&rdquo;
      </p>

      <p>
        Before acting, understand your current position, the recommendation, the alternatives and
        the costs.
      </p>

      <p className="font-bold text-primary text-xl">
        Clarity makes it easier to evaluate advice instead of depending entirely on the person
        delivering it.
      </p>

      <p className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground italic mt-6">
        Educational information only. The discussion of professional roles does not constitute an
        assessment of any individual professional or regulated entity.
      </p>
    </BlogArticleView>
  );
}
