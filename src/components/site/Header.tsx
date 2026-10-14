import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import oppLogo from "@/assets/opp-logo.png";
import { Button } from "@/components/ui/button";
import { useRegistration } from "./registration-context";

export function Wordmark({ withByline = true }: { withByline?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <img src={oppLogo} alt="OnePagePlan" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 object-contain" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-sm sm:text-base font-semibold tracking-tight text-foreground">
          OnePagePlan
        </span>
        {withByline ? (
          <span className="label-caps mt-0.5 text-[9px] sm:text-[10px] tracking-wider text-muted-foreground whitespace-nowrap">
            Founded by Milan Dodhia
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function BackToHome() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
    >
      ← Back to home
    </Link>
  );
}

export function Header() {
  const { open } = useRegistration();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-40 transition-colors duration-200 ${
        scrolled
          ? "border-b border-border bg-background/95 backdrop-blur-sm"
          : "border-b border-transparent bg-background/80 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3.5">
        <Link to="/" className="shrink-0" aria-label="OnePagePlan Home">
          <Wordmark />
        </Link>
        <div className="flex items-center shrink-0">
          <Button
            onClick={open}
            className="bg-primary text-primary-foreground hover:bg-[var(--highlight)] text-xs sm:text-sm font-semibold px-2.5 py-1.5 sm:px-4 sm:py-2 h-auto"
            size="sm"
          >
            <span className="sm:hidden">Join Free</span>
            <span className="hidden sm:inline">Join Free Masterclass</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
