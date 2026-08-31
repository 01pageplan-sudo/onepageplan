import { getNextSessionIST } from "./session";

/**
 * Single source of truth for the calendar entry, shared by the confirmation
 * page and the confirmation email builder so the two can never disagree.
 * Google Calendar only. No Outlook links, no .ics files anywhere.
 */

export const SESSION_TITLE = "The Money Reality Masterclass";

/** YYYYMMDDTHHMMSSZ */
function compactUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type SessionCalendar = {
  startUtc: string;
  endUtc: string;
  title: string;
  location: string;
  description: string;
  googleUrl: string;
};

export function getSessionCalendar(
  webinarUrl: string,
  target: Date = getNextSessionIST(),
): SessionCalendar {
  // getNextSessionIST() already returns the UTC instant of 19:00 IST.
  const start = target;
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const startUtc = compactUtc(start);
  const endUtc = compactUtc(end);
  const title = SESSION_TITLE;
  const location = webinarUrl;
  const description = `Free, live, ninety minutes. Sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers. Joining link: ${webinarUrl}`;

  const googleUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${startUtc}/${endUtc}` +
    `&details=${encodeURIComponent(description)}` +
    `&location=${encodeURIComponent(location)}` +
    "&ctz=Asia/Kolkata";

  return { startUtc, endUtc, title, location, description, googleUrl };
}
