import { Link } from "@tanstack/react-router";

import bmzLogoAsset from "@/assets/bmz-logo.png.asset.json";

export const DISCLAIMER =
  "The One Page Plan is a financial education programme by Milanaire, operated by Mannrs Wellness LLP. Everything on this page and in this session is educational content only. It is not investment advice and it is not a recommendation to buy or sell any security, scheme, policy or product. No returns are promised or implied. For anything tax related please consult a Chartered Accountant. For anything legal please consult a lawyer. Please make your own decisions.";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-12 pb-28 text-sm text-muted-foreground sm:pb-12">
        <img
          src={bmzLogoAsset.url}
          alt="Born Millionaire Zone"
          className="h-16 w-auto rounded-md bg-white object-contain"
          loading="lazy"
        />
        <p>
          The One Page Plan by Milanaire ·{" "}
          <a className="underline" href="mailto:connect@onepageplan.in">
            connect@onepageplan.in
          </a>
        </p>

        <div className="rounded-lg border border-border bg-card p-4 text-xs leading-relaxed">
          {DISCLAIMER}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="underline">
            Terms of Use
          </Link>
          <span>© {year} Mannrs Wellness LLP</span>
        </div>
      </div>
    </footer>
  );
}
