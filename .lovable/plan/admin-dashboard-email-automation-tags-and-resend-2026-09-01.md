# Admin dashboard, email automation, tags and resend

Rebuild `/admin` into a three-tab console (Leads, Email automation, Delivery stats), add the full webinar email sequence with reminders, post-session follow-up and an 11-day nurture, let you resend any email, tag leads, and move buyers into a post-purchase sequence.

## Leads tab

- Date-range chips (Today, Yesterday, Last 7 / 30 days, Last 3 months, All time, Custom) instead of the current single-session view.
- Counter cards: total leads, total registrations for the upcoming session, opt-in rate, buyers.
- Searchable table (name, email, phone) with source badge, registration date, WhatsApp consent, profile/situation.
- Per-row: tag chips, a "Resend…" menu, and a delete action.
- Export CSV of the filtered rows.

## Tags

- Free-form tags plus quick presets: `purchased`, `hot`, `no-show`, `attended`, `refunded`.
- Tagging a lead `purchased` stops the sales nurture and starts the post-purchase sequence from that day. Removing the tag reverses it.
- Tag filter chips above the table.

## Email automation tab

- Link settings saved in the database and used by every template: joining link, add-to-calendar link, registration page link, WhatsApp community link, monthly checkout link (₹1,001), annual checkout link (₹5,001).
- Nurture on/off master switch.
- Deliverability check button that reports SPF, DKIM, DMARC and MX on onepageplan.in.
- Sequence list showing each email, its trigger, and how many have gone out — with a "Send now" / "Resend" control per email per lead.

Sequence being built (all through your existing Resend sender):

| Email | When |
| --- | --- |
| Confirmation | on registration (already live) |
| Reminder 24 hours | day before, 7:00 PM IST |
| Reminder 1 hour | Saturday 6:00 PM IST |
| We are live | Saturday 7:00 PM IST |
| Late entry | Saturday 7:20 PM IST |
| Missed the session | Sunday morning, non-attendees only |
| Post-session follow-up | Sunday morning, attendees, with checkout links |
| Nurture 1–11 | one per day for 11 days after the session; stops on `purchased` |
| Post-purchase 1–5 | onboarding sequence, starts when tagged `purchased` |

Checkout links appear only in the post-session and nurture emails, never in pre-session reminders.

## Delivery stats and clarity about what was sent

- Every send is written to a log row with recipient, template, scheduled time, sent time, provider id, status (`queued`, `sent`, `failed`, `bounced`, `suppressed`) and error text.
- Stat cards: emails sent, open rate, people emailed, not delivered (failed + suppressed).
- Delivery events panel with bounce/complaint counts.
- Each lead row expands to a per-person timeline: every email, sent time, opened or not, failures — so it is always clear exactly what that person received.
- Open and bounce tracking via a Resend webhook endpoint; you paste the endpoint URL into Resend once and I will give you the URL and secret.

## Resend of any email

- From a lead row: resend the confirmation, any reminder, any nurture step, or the whole remaining sequence.
- Bulk resend for the current filter (for example "resend reminder to everyone with no open").
- Duplicate protection through an idempotency key, overridable with an explicit "send anyway".

## Technical notes

- New tables: `lead_tags`, `email_sequence_sends` (per-person per-template log with provider id and open/bounce state), `email_settings` (the link fields and nurture switch), `email_templates_state`. Each gets GRANTs and RLS; all reads/writes go through `SECURITY DEFINER` functions gated on the admin password, matching the existing `admin_registrations` pattern.
- Templates live in `src/lib/email-templates/` as plain HTML/text builders reusing the current brand styling from `email-template.server.ts`.
- Scheduling: a single `pg_cron` job runs **every 10 minutes** and calls one server route (`/api/public/email/dispatch`, shared-secret protected) that picks up due rows from `email_sequence_sends` and sends them through Resend. Ten minutes is needed because the 1-hour reminder and the "we are live" email must land within a few minutes of their slot; that cadence runs 144 times a day and keeps the database awake, which slightly increases Cloud cost. An hourly job would be cheaper but could delay a live-session email by up to an hour. One consolidated job, not one per sequence.
- Open/bounce webhook: `/api/public/email/resend-webhook`, signature-verified, updates the log rows.
- Attendance for the missed-vs-attended split comes from the existing webinar webhook `status` on `registrations`.
- Admin auth stays the current password gate; every new server function re-checks it server-side.
