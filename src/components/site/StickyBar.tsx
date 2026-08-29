import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CompactCountdown } from "./Countdown";
import { useRegistration } from "./registration-context";

export function StickyBar() {
  const { open } = useRegistration();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 z-40 w-full border-t border-border bg-background shadow-[0_-2px_12px_rgba(43,43,40,0.08)] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CompactCountdown />
        </div>
        <Button
          onClick={open}
          className="flex-1 bg-primary text-primary-foreground hover:bg-[var(--highlight)] sm:flex-none"
        >
          Save my seat →
        </Button>
        <button
          type="button"
          aria-label="Hide this bar"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
