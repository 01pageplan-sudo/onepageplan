# onepageplan.in — Vercel deployment guide

Everything in this document is what **you** need to do in Vercel. The code is
already set up for Vercel: it no longer needs the private database key, so all
of it (registration, confirmation email, WhatsApp, the pre-work question, the
admin dashboard, the webinar webhook) runs on Vercel with the values below.

---

## 1. How the pieces fit together

```text
Visitor  ->  Vercel (the whole site + its server functions)
                |
                +--> Database (Lovable Cloud / Supabase)  : all data lives here
                +--> Resend                               : confirmation email
                +--> AiSensy                              : WhatsApp reminder
```

There is only **one** database and it already contains everything:

| Table                    | What is in it                                              |
| ------------------------ | ---------------------------------------------------------- |
| `registrations`          | every signup for each Saturday session                     |
| `prework_questions`      | the "Ask me one question" answers                          |
| `newsletter_subscribers` | emails captured on the "not for you" screen                |
| `app_config`             | the admin dashboard password                                |

Vercel does not need its own database and nothing has to be "pushed" to Vercel.
Both the Lovable preview and Vercel read and write the same live data.

---

## 2. Environment variables to add in Vercel

Vercel dashboard -> your project -> **Settings** -> **Environment Variables**.
Add each of these to **Production, Preview and Development** (tick all three).

**Fastest way:** open `vercel.env.txt` in this project, fill in the `<...>`
placeholders, then in Vercel use **Import .env** (or paste the whole block into
the bulk editor) to add every variable in one go. Redeploy afterwards. The
tables below are just the reference for what each value means.

### Required — the site does not work without these

| Name                             | Value                                                     |
| -------------------------------- | --------------------------------------------------------- |
| `VITE_SUPABASE_URL`              | `https://gdnekidfshegfgvshtsi.supabase.co`                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | `sb_publishable_6qtnTGDL3Ze_yFaudjRQ9Q_mwCAFECm`           |
| `VITE_SUPABASE_PROJECT_ID`       | `gdnekidfshegfgvshtsi`                                     |
| `SUPABASE_URL`                   | same as `VITE_SUPABASE_URL`                                |
| `SUPABASE_PUBLISHABLE_KEY`       | same as `VITE_SUPABASE_PUBLISHABLE_KEY`                    |

These two keys are **public by design** (they are already in the browser
bundle), so putting them in Vercel is safe.

### Required for confirmation emails

| Name             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| `RESEND_API_KEY` | your Resend API key (starts `re_`) — see section 3        |
| `FROM_EMAIL`     | `connect@onepageplan.in`                                 |
| `FROM_NAME`      | `Milan Dodhia`                                           |

### Links shown to the registrant

| Name                       | Value                                              |
| -------------------------- | -------------------------------------------------- |
| `VITE_WEBINAR_URL`         | the Zoom / platform joining link                   |
| `VITE_WHATSAPP_GROUP_URL`  | the WhatsApp group invite link (Step 3)            |
| `VITE_VSL_URL`             | optional main video link                           |
| `VITE_PREP_VIDEO_URL`      | optional prep video link                           |
| `VITE_TESTIMONIALS_ENABLED`| `true` to show the testimonial videos              |

### WhatsApp reminders (only when you are ready)

| Name                     | Value                                            |
| ------------------------ | ------------------------------------------------ |
| `WHATSAPP_ENABLED`       | `false` for now, `true` once AiSensy is approved |
| `AISENSY_API_KEY`        | your AiSensy API key                             |
| `AISENSY_CAMPAIGN_NAME`  | your AiSensy campaign name                       |

### Webinar attendance webhook (optional)

| Name                     | Value                                              |
| ------------------------ | -------------------------------------------------- |
| `WEBHOOK_SHARED_SECRET`  | any long random string you also paste into the webinar platform |

Endpoint to give the platform:
`https://onepageplan.in/api/public/webinar-webhook`
(send the secret in the `x-webhook-secret` header).

> `ADMIN_PASSWORD` is **no longer** an environment variable. The admin password
> now lives in the database (`app_config`), so the dashboard works identically
> on every host. It is currently set to the password you gave me.

After adding or changing any variable, **redeploy** — Vercel only picks up new
values on a fresh deployment.

---

## 3. Resend setup (5 minutes, needed for the confirmation email)

1. Create a free account at <https://resend.com>.
2. **Domains** -> **Add domain** -> `onepageplan.in`.
3. Resend shows a few DNS records (SPF/DKIM, and a return-path record). Add
   them where `onepageplan.in` DNS is managed. Wait for "Verified".
4. **API Keys** -> **Create API Key** (sending permission is enough).
5. Paste that key into Vercel as `RESEND_API_KEY`, then redeploy.

Until Resend is verified, registrations still save and the WhatsApp path still
works — only the email is skipped, and the reason is recorded against the
registration so you can see it in the dashboard data.

Free tier is 3,000 emails/month, which is comfortably above this funnel's volume.

---

## 4. Vercel project settings

| Setting            | Value                          |
| ------------------ | ------------------------------ |
| Framework preset   | **Other** (do not pick Vite)   |
| Install command    | `bun install` (or `npm install`)|
| Build command      | `npm run build`                |
| Output directory   | leave empty                    |
| Node version       | 20 or 22                       |

The build already detects Vercel automatically and produces a Vercel-compatible
server bundle, so you do not need a `vercel.json`.

Domain: Vercel -> **Settings** -> **Domains** -> add `onepageplan.in` and
`www.onepageplan.in`, and follow the DNS instructions Vercel shows.

---

## 5. Do you need the Vercel <-> Supabase integration?

**No, and I recommend against it.** That integration exists to create a *new*
Supabase project and inject its keys. Your data is already in this project's
database, and the two variables the site needs are public keys you can paste
manually in one minute (section 2). Adding the integration would either point
the site at an empty second database or overwrite your working variables.

If you ever do want the database in your own Supabase account instead, tell me
and I will export the schema (it is in `supabase/migrations/`) plus the data so
you can import it there — then only the two variables above change.

---

## 6. Checklist after deploying

1. Open `https://onepageplan.in` and register with a real email.
2. You should land on the success page and receive the confirmation email.
3. Send a question in Step 2 — it should confirm in place.
4. Open `https://onepageplan.in/admin`, enter the admin password: the list for
   this Saturday should appear, with **Download CSV** working.
5. If anything fails, Vercel -> **Deployments** -> latest -> **Functions/Logs**
   shows the exact reason (the code logs a clear message for each step).

---

## 7. Quick troubleshooting

| Symptom                                            | Cause / fix                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| "We could not save your seat just now"             | `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` missing in Vercel, or not redeployed after adding them |
| Registration saves but no email                    | `RESEND_API_KEY` missing, or the Resend domain is not verified yet        |
| Admin page says "Wrong password"                   | The password is the one stored in the database; tell me to change it and I will |
| Admin page does not load at all                    | Check the deployment succeeded and the domain points at this Vercel project |
| WhatsApp never arrives                             | `WHATSAPP_ENABLED` is `false`, or the AiSensy template is not approved    |
| Joining link empty in the email                    | `VITE_WEBINAR_URL` not set in Vercel                                     |

---

## 8. What I changed in the code for this

- All database work now goes through named database functions instead of the
  private service key, so the public key is enough. The tables themselves stay
  unreadable from the browser.
- The admin password moved from an environment variable into the database.
- Email now sends through Resend when `RESEND_API_KEY` is present.
- The build automatically targets Vercel when it runs on Vercel.
