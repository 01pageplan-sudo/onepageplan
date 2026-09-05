/**
 * Single source of truth for the session timing.
 * Target: the next occurrence of Saturday 19:00 India Standard Time (UTC+05:30).
 * Computed with a fixed offset so the visitor's device timezone never matters.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Dates (YYYY-MM-DD in IST) where the session was moved or skipped.
 * Specifically moves the session from today (2026-09-05) to next Saturday (2026-09-12).
 */
const SKIPPED_OR_MOVED_SESSIONS = new Set<string>([
  "2026-09-05", // Moved to next Saturday (12 Sep 2026) only for this session
]);

function getSkippedSessionDates(): Set<string> {
  const dates = new Set<string>(SKIPPED_OR_MOVED_SESSIONS);
  try {
    const envVal =
      (typeof import.meta !== "undefined" &&
        (import.meta as any).env?.["VITE_SKIPPED_SESSIONS"]) ||
      (typeof process !== "undefined" && process.env?.["VITE_SKIPPED_SESSIONS"]);
    if (envVal && typeof envVal === "string") {
      for (const d of envVal.split(",")) {
        const trimmed = d.trim();
        if (trimmed) dates.add(trimmed);
      }
    }
  } catch {
    /* ignore */
  }
  return dates;
}

export function getNextSessionIST(from: Date = new Date()): Date {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const day = ist.getUTCDate();
  const weekday = ist.getUTCDay(); // 6 = Saturday
  const minutesNow = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  let daysAhead = (6 - weekday + 7) % 7;
  if (daysAhead === 0 && minutesNow >= 19 * 60) {
    daysAhead = 7;
  }

  // 19:00 IST == 13:30 UTC on the same calendar day.
  let target = new Date(Date.UTC(year, month, day + daysAhead, 13, 30, 0, 0));

  const skipped = getSkippedSessionDates();
  while (skipped.has(sessionDateISO(target))) {
    daysAhead += 7;
    target = new Date(Date.UTC(year, month, day + daysAhead, 13, 30, 0, 0));
  }

  return target;
}

/** yyyy-mm-dd of the session, in IST. */
export function sessionDateISO(target: Date = getNextSessionIST()): string {
  const ist = new Date(target.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Renders like "6 Sep". */
export function formatSessionDayMonth(target: Date = getNextSessionIST()): string {
  const ist = new Date(target.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
}

/** Renders like "6 September 2026", used for "Last updated" lines. */
export function formatLongDate(date: Date = new Date()): string {
  const long = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCDate()} ${long[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

export type Remaining = { days: number; hours: number; minutes: number; seconds: number };

/**
 * Time left until the next session. Recomputes the target when the current one
 * passes, so this can never return zero or negative values.
 */
export function remainingToNextSession(now: Date = new Date()): Remaining {
  let target = getNextSessionIST(now);
  let diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    target = getNextSessionIST(new Date(now.getTime() + 60 * 1000));
    diff = target.getTime() - now.getTime();
  }
  const totalSeconds = Math.max(1, Math.floor(diff / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Returns true if current time in IST is Saturday on or after 18:30 (6:30 PM) for an active session. */
export function isSaturdayPost630PMIST(now: Date = new Date()): boolean {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const weekday = ist.getUTCDay(); // 6 = Saturday
  const minutesNow = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (weekday !== 6 || minutesNow < 1110) return false;

  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  const todayISO = `${y}-${m}-${d}`;

  return !getSkippedSessionDates().has(todayISO);
}

