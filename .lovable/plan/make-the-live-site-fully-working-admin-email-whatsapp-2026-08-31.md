# Make the live site fully working (admin, email, WhatsApp)

## What's actually going on

- The admin dashboard **does exist** in the code at `/admin`: password box, table of this session's registrations, counts by situation, CSV download. Its password check and its database read both run on the server.
- Everything server-side in this site (saving a registration, sending the confirmation email, WhatsApp, the admin read, the pre-work question) needs secret keys that live in Lovable Cloud.
- Your Vercel deployment has none of those keys, so on Vercel the admin page can't authenticate or load data, and confirmation emails won't send. Two of the required keys — the database service key and the Lovable email key — **cannot be retrieved from Lovable Cloud at all**, so they can never be copied into Vercel. This is not something extra code can work around.
- The database is one single Lovable Cloud database. All three tables already exist (`registrations`, `prework_questions`, `newsletter_subscribers`). There is nothing to "push through Vercel" — Vercel only serves pages; both hosts would read the same database.

## Recommendation

Serve the real site from the Lovable published URL and point `onepageplan.in` at it. That is the only setup where registration, confirmation email, WhatsApp, the pre-work question and the admin dashboard all work. Keep the GitHub/Vercel deploy only as a code backup, not as the live site.

## Steps

1. Publish the app from Lovable, then confirm on the published URL:
   - registration end to end (row saved, redirect to the success page, confirmation email sent)
   - `/admin` opens with your password and lists the session's registrations
   - CSV download works
2. Point `onepageplan.in` (and `www`) at the Lovable deployment instead of Vercel, in Lovable's domain settings. Ad pixels, Hotjar and Meta Pixel are already in the app and follow the domain.
3. Turn the Vercel project's domain off (or leave it on its `*.vercel.app` URL) so the two deployments don't compete for the same domain and so no visitor lands on the version that can't email them.
4. Re-verify the Meta Pixel `Lead` event fires on the success page under the live domain.

## Small hardening included

- Make `/admin` show a clear message when the server has no admin password configured, instead of a generic "Wrong password" — so a misconfigured host is obvious immediately.

## If you insist on staying on Vercel

Then, honestly: registration would need to be reworked to write directly from the browser under database access rules (doable), but confirmation emails, WhatsApp sends and the admin dashboard cannot be made to work there, because their keys are not retrievable. Say the word and I'll write that reduced-scope plan instead.

## Technical notes

- Server logic is TanStack Start server functions in `src/lib/registration.functions.ts` / `registration.server.ts`, plus the webhook route `src/routes/api/public/webinar-webhook.ts`.
- Server env needed by that code: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`, `FROM_EMAIL`, `FROM_NAME`, `ADMIN_PASSWORD`, `WEBHOOK_SHARED_SECRET`, `WHATSAPP_ENABLED` (+ AiSensy keys when enabled). Lovable's own hosting injects all of these automatically.
- `ADMIN_PASSWORD` is set in Lovable Cloud to the value you gave me.
