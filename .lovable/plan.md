# onepageplan.in - The Money Reality Masterclass funnel

A single-page registration site with a three-step popup, thank-you page, privacy and terms pages, an admin view, and a backend that stores registrations and sends confirmations.

## One important adaptation

This project runs on TanStack Start, which has its own server runtime. Supabase Edge Functions are not used here. Everything you specified as an Edge Function is built as a server-side endpoint in this app instead, with identical behaviour, identical env vars and the same security model (service-role writes only, browser never touches the table).

Mapping:
- `register` -> server function `registerAttendee`
- `send-confirmation-email` -> server-side email sender (SMTP, called by register)
- `send-whatsapp` -> server-side sender, gated on `WHATSAPP_ENABLED`
- `webinar-webhook` -> public HTTP route `/api/public/webinar-webhook` (shared-secret header)
- admin password check -> server function, password never in the browser bundle

One more constraint: SMTP over raw TCP is not available in this app's server runtime. The email sender uses an HTTP email API instead. If you have credentials for a provider (Resend, Brevo, SendGrid, Mailgun, Postmark), I'll wire that; otherwise I ship the sender with the exact template and record `email_error` until a provider key is added. Tell me which provider you have and I'll use it.

## Design system

Cream `#FAF7F0`, white cards with `#E5DFD3` borders, text `#2B2B28` / `#6B6A63`, olive `#4A5A3A`, brass `#B8873B`, amber `#D9822B` reserved for countdown digits and primary hover. Bricolage Grotesque for display, IBM Plex Sans for body, both loaded via a font link in the root route. All colours as semantic tokens in `src/styles.css`. Mobile-first, verified at 380px. No stock-photo visuals, no graphs, coins, skylines or tech renders: type, thin rules, whitespace only.

## Routes

- `/` - full landing page, every section as specified in order: sticky header, attention pill, hero, video + countdown/chips/CTA block, credential strip, old way vs new way, three principles, three secrets, what changes after, for/not-for, three takeaways, host, testimonials (hidden by default), FAQ accordion, final CTA, footer with bordered disclaimer.
- `/confirmed` - two-step confirmation, prominent "Confirm my seat" to `VITE_WEBINAR_URL`, prep video block (hidden when unset), before-Saturday card with .ics download, WhatsApp group block (hidden when unset), same footer. No countdown, no sticky bar, no re-register CTA.
- `/privacy`, `/terms` - narrow single column, plain-English India-appropriate content covering everything you listed, `Last updated {computed}` line, and the REVIEW REQUIRED comment at the top of each file.
- `/admin` - password gate, current-session table, total count, counts by pain point, CSV download. No charts.

Each route gets its own head() metadata.

## Countdown

Shared helper `getNextSessionIST()` computes the next Saturday 19:00 at a fixed +05:30 offset, independent of device timezone, with your exact same-day before/after 19:00 rules. It is the single source for: countdown card, spec chip date, sticky bar, .ics file, and the server-computed `session_date`. Ticks every second, rolls forward at zero, never shows zeros or negatives. Days/hours/minutes only, no seconds.

## Registration popup

Modal, max 460px, cream, overlay-click and escape close, three-segment progress bar. Step 1 qualification with the polite exit branch for option B (no data captured, no write). Step 2 the two dropdowns, both required. Step 3 name, email, +91 10-digit phone stored as `+91XXXXXXXXXX`, required WhatsApp consent unchecked by default, optional voice consent in smaller text that can never block submit. Hidden UTM/referrer/landing_path capture on mount, invisible `company` honeypot that fakes success and writes nothing. Inline muted-red validation that never clears input. Step 1-2 answers persist on back navigation. Success navigates to `/confirmed`; failure keeps the form and shows the single error line.

## Copy rules enforced throughout

No em dashes anywhere. No scarcity, no seat counts, no struck prices, no rupee values, no returns or income or savings figures, no fund/stock/policy/insurer/bank names, no invented testimonials or awards. Host title is exactly "Financial Educator". Entity is "Mannrs Wellness LLP". No hardcoded dates in visible copy.

## Backend

Lovable Cloud gets enabled first. One migration creates `registrations` with exactly your columns, the `status` check constraint, a unique index on `(email, session_date)`, table grants, RLS enabled with no public select or insert.

`registerAttendee` validates everything server-side (voice consent never rejects), rate-limits 5 per IP per 10 minutes, computes `session_date` itself and ignores any browser date, upserts with consent never downgraded from true unless explicitly set false, sets `consent_at` / `voice_consent_at` on insert, then fires email and WhatsApp without blocking the response past 3 seconds. Send failures write `email_error` / `whatsapp_error` and never fail registration.

Email: table-based HTML with inline styles plus a plain-text part, subject "Your seat is saved for this Saturday", your exact body, footer with the full section 6.11 disclaimer, entity line and unsubscribe line.

WhatsApp: built now, off. Returns `{ skipped: true }` and logs the payload unless `WHATSAPP_ENABLED === "true"`; when on, POSTs the AiSensy campaign with `destination`, `userName` and template params, only when consent is true. Never throws.

Webhook: verifies `WEBHOOK_SHARED_SECRET`, stores the whole body in `raw_webhook`, matches by lowercased email on the current `session_date`, maps joined/attended to `attended` and drop-off/left-early to `dropped_off`, always returns 200, reads every field optionally.

## Environment variables

I'll create all of them, with `WHATSAPP_ENABLED=false` and `VITE_TESTIMONIALS_ENABLED=false`. The `VITE_*` ones (webinar URL, VSL, prep video, host image, WhatsApp group) start empty and every consuming block degrades cleanly as specified. Secrets I'll prompt you for: email provider key, `AISENSY_API_KEY`, `AISENSY_CAMPAIGN_NAME`, `WEBHOOK_SHARED_SECRET`, `ADMIN_PASSWORD`.

## Before I build

Confirm the email provider (see above). If you'd rather I just pick, I'll use Resend and ask for the key.
