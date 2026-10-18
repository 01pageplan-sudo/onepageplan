import { getNextSessionIST } from "./session";

/**
 * Single source of truth for the calendar entry, shared by the confirmation
 * page and the confirmation email builder so the two can never disagree.
 * Google Calendar only. No Outlook links, no .ics files anywhere.
 */

export const SESSION_TITLE = "The Money Reality Masterclass";

/** The webinar platform id. Same value in the join-token call and the iframe. */
export const WEBINAR_ID = "cmthk6y4001kos60ybxfkbc67";

/** The webinar platform's own registration page. Kept only as a fallback. */
export const WEBINAR_REGISTER_URL = `https://webinar.gg/register/${WEBINAR_ID}`;

/** Where the session actually runs. This is the one link we hand out. */
export const ROOM_URL = "https://www.onepageplan.in/room";


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
  _webinarUrl: string,
  target: Date = getNextSessionIST(),
): SessionCalendar {
  // getNextSessionIST() already returns the UTC instant of 19:00 IST.
  const start = target;
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const startUtc = compactUtc(start);
  const endUtc = compactUtc(end);
  const title = SESSION_TITLE;
  // The session runs inside the site's own room, so that is the link people keep.
  const location = ROOM_URL;
  // Kept deliberately short: everything here is URL encoded into the calendar link.
  const description = `Free, live, ninety minutes. Bring a pen. Join at ${ROOM_URL}`;

  const googleUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${startUtc}/${endUtc}` +
    `&details=${encodeURIComponent(description)}` +
    `&location=${encodeURIComponent(location)}` +
    "&ctz=Asia/Kolkata";


  return { startUtc, endUtc, title, location, description, googleUrl };
}
