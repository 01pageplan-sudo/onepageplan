import { Link } from "@tanstack/react-router";


export const DISCLAIMER =
  "The One Page Plan is a financial education programme by Milanaire, operated by Manrrs Wellness LLP. Everything on this page and in this session is educational content only. It is not investment advice and it is not a recommendation to buy or sell any security, scheme, policy or product. No returns are promised or implied. For anything tax related please consult a Chartered Accountant. For anything legal please consult a lawyer. Please make your own decisions.";

const SITELINKS = [
  {
    title: "What You'll Learn",
    line1: "Explore the masterclass topics",
    line2: "Understand what you own and owe",
    href: "/#what-youll-learn",
  },
  {
    title: "Session Details",
    line1: "Check the next session details",
    line2: "See the date, time and duration",
    href: "/#session-details",
  },
  {
    title: "Meet the Presenter",
    line1: "Meet Milan Dodhia, Financial Educator",
    line2: "Read more at milanaire.me",
    href: "/#meet-the-presenter",
  },
  {
    title: "Blog",
    line1: "Notes on Indian family finance",
    line2: "Read articles on milanaire.me/blog",
    href: "/#blog",
  },
  {
    title: "Register for Free",
    line1: "Join the free live masterclass",
    line2: "Complete your registration",
    href: "/#register",
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-12 pb-32 text-sm text-muted-foreground">
        <p>
          The One Page Plan by Milanaire ·{" "}
          <a className="underline" href="mailto:connect@onepageplan.in">
            connect@onepageplan.in
          </a>
        </p>

        <nav
          aria-label="Quick site links"
          className="grid gap-3 sm:grid-cols-2 md:grid-cols-3"
        >
          {SITELINKS.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-[var(--brass)]"
            >
              <p className="text-xs font-semibold text-foreground underline underline-offset-4">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.line1}</p>
              <p className="text-xs text-muted-foreground">{item.line2}</p>
            </a>
          ))}
        </nav>

        <div className="rounded-lg border border-border bg-card p-4 text-xs leading-relaxed">
          {DISCLAIMER}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <a href="/#what-youll-learn" className="underline">
            What You&apos;ll Learn
          </a>
          <a href="/#session-details" className="underline">
            Session Details
          </a>
          <a href="/#meet-the-presenter" className="underline">
            Meet the Presenter
          </a>
          <a href="/#blog" className="underline">
            Blog
          </a>
          <a href="/#register" className="underline">
            Register for Free
          </a>
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="underline">
            Terms of Use
          </Link>
          <Link to="/refund-policy" className="underline">
            Refund Policy
          </Link>
          <Link to="/shipping-policy" className="underline">
            Shipping & Delivery
          </Link>
          <Link to="/contact" className="underline">
            Contact Us
          </Link>
          <span>© {year} Manrrs Wellness LLP</span>
        </div>
      </div>
    </footer>
  );
}
