/**
 * Single source of truth for the session timing.
 * Target: the next occurrence of Saturday 19:00 India Standard Time (UTC+05:30).
 * Computed with a fixed offset so the visitor's device timezone never matters.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

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
  return new Date(Date.UTC(year, month, day + daysAhead, 13, 30, 0, 0));
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
