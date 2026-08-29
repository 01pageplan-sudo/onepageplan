import { useEffect, useState } from "react";

import { remainingToNextSession, type Remaining } from "@/lib/session";

export function useCountdown(): Remaining | null {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(remainingToNextSession());
    const id = window.setInterval(() => setRemaining(remainingToNextSession()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return remaining;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Digits({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="tabular text-3xl leading-none font-bold text-[var(--highlight)] sm:text-4xl">
        {value}
      </div>
      <div className="label-caps mt-2 text-muted-foreground">{label}</div>
    </div>
  );
}

export function CountdownCard() {
  const remaining = useCountdown();

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="label-caps text-[var(--brass)]">Next session starts in</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Digits value={remaining ? pad(remaining.days) : "--"} label="Days" />
        <Digits value={remaining ? pad(remaining.hours) : "--"} label="Hours" />
        <Digits value={remaining ? pad(remaining.minutes) : "--"} label="Minutes" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Miss it and the next one is seven days away.
      </p>
    </div>
  );
}

export function CompactCountdown() {
  const remaining = useCountdown();
  if (!remaining) return <span className="tabular text-sm">Starts soon</span>;
  return (
    <span className="tabular text-sm">
      Starts in {remaining.days}d {pad(remaining.hours)}h {pad(remaining.minutes)}m
    </span>
  );
}
