import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useRegistration } from "./registration-context";

function PageGlyph() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className="text-[var(--brass)]"
      aria-hidden="true"
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function Wordmark({ withByline = true }: { withByline?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <PageGlyph />
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-semibold">The One Page Plan</span>
        {withByline ? (
          <span className="label-caps mt-1 text-muted-foreground">By Milanaire</span>
        ) : null}
      </span>
    </span>
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
        <Button
          onClick={open}
          className="bg-primary text-primary-foreground hover:bg-[var(--highlight)]"
          size="sm"
        >
          Join free masterclass
        </Button>
      </div>
    </header>
  );
}
