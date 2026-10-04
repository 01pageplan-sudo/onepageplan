/**
 * The only place in the codebase that talks to the Meta Pixel.
 *
 * Notes for whoever reads this next:
 *
 * 1. A URL based custom conversion already exists in Meta Events Manager
 *    pointing at /confirmed. It fires on PageView and therefore also counts
 *    direct visits and refreshes. The CompleteRegistration event fired here is
 *    the cleaner signal. Only one of the two should ever be selected as a
 *    campaign's optimisation event.
 * 2. If the webinar platform's own analytics toggle is ever switched on with
 *    the same Pixel ID, its CompleteRegistration will double count against this
 *    site's. One of the two must then be turned off.
 *
 * Neither situation is handled in code.
 */

const STANDARD_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "Subscribe",
  "InitiateCheckout",
  "Purchase",
]);

export const META_PIXEL_ID =
  ((import.meta.env["VITE_META_PIXEL_ID"] as string | undefined) ?? "").trim();

type Fbq = (...args: unknown[]) => void;

/** Fires to the Pixel. Silently does nothing when analytics is absent. */
export function track(eventName: string, params?: Record<string, string | number | boolean>) {
  try {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (typeof fbq !== "function") return;
    const method = STANDARD_EVENTS.has(eventName) ? "track" : "trackCustom";
    if (params) fbq(method, eventName, params);
    else fbq(method, eventName);
  } catch {
    /* analytics must never break the page */
  }
}
