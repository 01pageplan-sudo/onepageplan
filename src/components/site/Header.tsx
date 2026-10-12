import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import bmzIcon from "@/assets/bmz-icon.png";
import { Button } from "@/components/ui/button";
import { useRegistration } from "./registration-context";

export function Wordmark({ withByline = true }: { withByline?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <img src={bmzIcon} alt="" className="h-8 w-8 object-contain" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-semibold">The One Page Plan</span>
        {withByline ? (
          <span className="label-caps mt-1 text-muted-foreground">By Milanaire</span>
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
      className={`fixed top-0 right-0 left-0 z-40 transition-colors ${
        scrolled ? "border-b border-border bg-background" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="shrink-0">
          <Wordmark />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex">
          <a
            href="/#what-youll-learn"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            What You&apos;ll Learn
          </a>
          <a
            href="/#session-details"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Session Details
          </a>
          <a
            href="/#meet-the-presenter"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Meet the Presenter
          </a>
          <a
            href="/#blog"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Blog
          </a>
          <a
            href="/#register"
            onClick={(e) => {
              if (window.location.pathname === "/") {
                e.preventDefault();
                window.history.replaceState(null, "", "#register");
                open();
              }
            }}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Register for Free
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/#meet-the-presenter"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            Meet the Presenter
          </a>
          <Button
            onClick={open}
            className="bg-primary text-primary-foreground hover:bg-[var(--highlight)]"
            size="sm"
          >
            Join free masterclass
          </Button>
        </div>
      </div>
    </header>
  );
}
