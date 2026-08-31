# Fix the registration error, add a conversion event, and add "Ask me one question"

## 1. Fix the submission error (first step)

The registrations table is currently empty, so no submission has been saved. The exact cause is not yet confirmed from the code alone, so step one is to reproduce a submission against the running app, read the server-side error, and fix whatever it reports. Likely suspects to check in order:

- The hidden anti-spam "company" field being auto-filled by the browser (would silently skip saving).
- The visitor-IP lookup used for rate limiting throwing inside the server runtime.
- The database write itself failing (unique index on email + session date, or a not-null column).

The fix follows the real error; no code will be changed until the error message is in hand. A test registration will be made and then removed.

## 2. Conversion event on the success page

- Fire the Meta Pixel `Lead` event once when the "Your seat is saved" page loads, guarded so a refresh or a return visit does not double-count.
- Google Ads is left out for now; it can be added later once the conversion ID and label are available.

## 3. New section on the success page: "Ask me one question"

Added below all existing content on `/confirmed`. Nothing already on that page changes.

Copy is used exactly as supplied: heading, sub-line, guidance line above the textarea, placeholder, button label, post-submit confirmation, and the small-print disclaimer for the section.

Behaviour:

- Textarea, 4 rows, hard 500-character limit; live character count appears only past 400 characters.
- Full-width, large tap-target button; mobile first; existing colours, fonts and tokens only; no icons.
- On success the form is replaced in place with the confirmation copy — no navigation, no reload.
- A localStorage flag makes a returning visitor see the submitted state.
- On failure the typed text stays in the box with a retry option; nothing is ever lost.
- The question is matched to the registrant when the registration id or email is known on the page; if not, the submission still saves with those fields empty.

Nothing is emailed or sent to WhatsApp — database only.

## Technical notes

- New table `prework_questions`: `id` (uuid pk), `registration_id` (uuid, nullable, references `registrations`), `email` (text, nullable), `question` (text, not null), `created_at`. Row-level security on, with no public read access; writes go through the server only, so no anon grants for reading.
- New server function `submitPreworkQuestion` in `src/lib/registration.functions.ts` (this stack uses TanStack server functions rather than separate Edge Functions): optional `registration_id` and `email`, required `question`; trims input, rejects empty/whitespace-only, caps at 500 characters, per-IP throttle in addition to the client-side one-per-session flag, returns success or a plain message.
- To pass the registrant identity through, the registration server function will return the saved registration id, and the modal will hand it to `/confirmed` via router state plus a sessionStorage fallback so a refresh keeps it.
- New component `src/components/site/AskQuestion.tsx` rendered at the bottom of `src/routes/confirmed.tsx`.
- Meta Pixel `Lead` call lives in a small effect on `/confirmed`, using the pixel already installed in the site shell.
