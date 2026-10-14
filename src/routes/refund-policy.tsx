import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark, BackToHome } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getLegalPolicyFn } from "@/lib/commerce/checkout.server";
import { formatLongDate } from "@/lib/session";

const TITLE = "Refund & Cancellation Policy | OnePagePlan";
const DESCRIPTION =
  "Official Refund and Cancellation Policy for OnePagePlan paid courses, masterclasses, and educational programmes.";

export const Route = createFileRoute("/refund-policy")({
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
  component: RefundPolicyPage,
});

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function RefundPolicyPage() {
  const [updated, setUpdated] = useState("");
  const [customMarkdown, setCustomMarkdown] = useState<string | null>(null);

  useEffect(() => {
    setUpdated(formatLongDate());
    void getLegalPolicyFn({ data: { policy: "refund" } }).then((res) => {
      if (res.customMarkdown) setCustomMarkdown(res.customMarkdown);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
            <Wordmark />
            <BackToHome />
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="text-[clamp(1.75rem,4.5vw,2.5rem)] font-bold leading-tight text-foreground">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {updated ? `Last updated ${updated}.` : null}
          </p>

          {customMarkdown ? (
            <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {customMarkdown}
            </div>
          ) : (
            <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
              <Block heading="Paid Courses — 14-Day Refund Policy">
                <p>
                  OnePagePlan offers a 14-day refund policy on eligible first-time course purchases
                  made without using a coupon.
                </p>
                <p>
                  A refund request must be submitted within 14 calendar days of the original
                  purchase date.
                </p>
                <p className="font-medium text-foreground">
                  You may request a refund even if you have completed the entire course during this
                  period.
                </p>
              </Block>

              <Block heading="Coupon Purchases">
                <p>
                  Purchases made using promotional or discount coupons are not eligible for the
                  standard 14-day refund policy.
                </p>
              </Block>

              <Block heading="Course Repurchases">
                <p>
                  If you previously purchased a course and subsequently purchase the same course
                  again, the subsequent purchase is not eligible for the standard 14-day refund
                  policy.
                </p>
                <p>This applies even if your original purchase was refunded.</p>
              </Block>

              <Block heading="Free Masterclasses">
                <p>
                  Free educational masterclasses do not require payment. Therefore, refunds are not
                  applicable.
                </p>
              </Block>

              <Block heading="Payment Errors and Technical Issues">
                <p>
                  Duplicate charges, incorrect payments, failure to provide purchased content, and
                  other applicable consumer complaints will be reviewed separately.
                </p>
                <p>
                  Nothing in this policy limits rights or remedies available under applicable law.
                </p>
              </Block>

              <Block heading="How to Request a Refund">
                <p>
                  Contact OnePagePlan through the support details published on the website within
                  the eligible refund period:
                </p>
                <p className="font-mono text-xs text-foreground bg-muted p-2 rounded-md">
                  Email: connect@onepageplan.in
                </p>
                <p>
                  Include your registered email address, course name and transaction reference.
                </p>
                <p>
                  Eligible requests will be reviewed, and approved refunds will generally be
                  returned through the original payment method, where supported.
                </p>
                <p>Processing times depend on the payment provider and banking system.</p>
              </Block>

              <Block heading="Programme Cancellation">
                <p>
                  If OnePagePlan cancels a paid course or programme without delivering the purchased
                  service, customers will be offered an appropriate remedy, including a refund where
                  applicable.
                </p>
              </Block>

              <Block heading="Policy Updates">
                <p>
                  OnePagePlan may update this policy periodically. The latest version and its
                  effective date will be displayed on this page.
                </p>
              </Block>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
