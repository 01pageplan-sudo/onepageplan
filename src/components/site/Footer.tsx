import { Link } from "@tanstack/react-router";
import { trackOutboundCredibilityClick } from "@/lib/analytics";

export const DISCLAIMER =
  "OnePagePlan is a financial education brand founded by Milan Dodhia and operated by Manrrs Wellness LLP. Everything on this website and in The Money Reality Masterclass is educational content only. It does not constitute personalised investment advice, portfolio management, or a recommendation to buy or sell any security, scheme, policy or product. No returns are promised or implied. For anything tax related please consult a Chartered Accountant. For legal matters please consult a lawyer. Please make your own informed financial decisions.";

// Optional environment variable for verified official OnePagePlan Instagram presence
const ONEPAGEPLAN_INSTAGRAM_URL =
  (import.meta.env["VITE_ONEPAGEPLAN_INSTAGRAM_URL"] as string | undefined)?.trim() || null;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-12 pb-24 text-sm text-muted-foreground">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <p className="font-display font-semibold text-foreground text-base">OnePagePlan</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Founded by Milan Dodhia ·{" "}
              <a className="underline hover:text-foreground" href="mailto:connect@onepageplan.in">
                connect@onepageplan.in
              </a>
            </p>
          </div>

          {/* Explore More — Secondary Credibility Links */}
          <div className="space-y-2">
            <p className="label-caps text-xs text-[var(--brass)] font-semibold">Explore More</p>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <li>
                <a
                  href="https://milanaire.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Milanaire website (opens in a new tab)"
                  onClick={() => trackOutboundCredibilityClick("milanaire", "site_footer")}
                  className="underline underline-offset-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  Milanaire →
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/milanaire-me"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Milan Dodhia on LinkedIn (opens in a new tab)"
                  onClick={() => trackOutboundCredibilityClick("linkedin", "site_footer")}
                  className="underline underline-offset-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  LinkedIn →
                </a>
              </li>
              <li>
                <a
                  href="https://substack.com/@themilanaireletter"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="The Milanaire Letter on Substack (opens in a new tab)"
                  onClick={() => trackOutboundCredibilityClick("substack", "site_footer")}
                  className="underline underline-offset-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  The Milanaire Letter →
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/logician_milan/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Milan on Instagram (personal account @logician_milan, opens in a new tab)"
                  onClick={() => trackOutboundCredibilityClick("milan_instagram", "site_footer")}
                  className="underline underline-offset-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  Milan on Instagram →
                </a>
              </li>
              {ONEPAGEPLAN_INSTAGRAM_URL && (
                <li>
                  <a
                    href={ONEPAGEPLAN_INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="OnePagePlan on Instagram (official account, opens in a new tab)"
                    onClick={() =>
                      trackOutboundCredibilityClick("onepageplan_instagram", "site_footer")
                    }
                    className="underline underline-offset-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    OnePagePlan on Instagram →
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          {DISCLAIMER}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <Link to="/blog" className="underline hover:text-foreground">
            Blog
          </Link>
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="underline hover:text-foreground">
            Terms &amp; Conditions
          </Link>
          <Link to="/refund-policy" className="underline hover:text-foreground">
            Refund &amp; Cancellation Policy
          </Link>
          <Link to="/contact" className="underline hover:text-foreground">
            Contact Us
          </Link>
          <span className="text-muted-foreground/75">© {year} Manrrs Wellness LLP</span>
        </div>
      </div>
    </footer>
  );
}
