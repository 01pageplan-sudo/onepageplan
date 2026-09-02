# One Page Plan

# LOVABLE BUILD PROMPT v2
**Project: onepageplan.in - registration funnel for The Money Reality Masterclass**
Paste everything below this line into Lovable as a single prompt.

---

Build a single-page registration site, a multi-step popup registration form, a thank you page, and privacy and terms pages, for a free live financial education webinar in India. Use Lovable Cloud (Supabase) for the database and Edge Functions. No third party automation tools.

Domain: `onepageplan.in`

## 0. Non-negotiable constraints

Read these first. They override any default you would otherwise apply.

1. **Never use em dashes in any copy on this site.** Use hyphens, colons or full stops.
2. **No fake scarcity.** Do not add "only X seats left", struck-through prices, "was ₹999", attendee counters, or any number that is not literally true. If a section feels like it needs a number, leave it out.
3. **No value stack.** Do not assign rupee values to the webinar or to any free resource. Describe what each thing does instead.
4. **The countdown is real and must never sit at zero.** See section 4.
5. **Never call the host an adviser, financial adviser, wealth manager or Wealth Architect.** His title is exactly "Financial Educator".
6. **No returns, no income figures, no savings projections, no "beat inflation" claims** anywhere.
7. **No fund names, stock names, policy names, insurer names or bank names** anywhere.
8. The legal entity is spelled **Mannrs Wellness LLP**. Not Manners.
9. Do not hardcode any calendar date in visible copy. All dates are computed at runtime.
10. Do not invent testimonials, awards, media logos or attendee numbers.

## 1. Design system

Warm, calm, editorial. This is the Sage archetype. It must not look like a hype funnel.

**Colours**
- Background / paper: `#FAF7F0` (cream)
- Surface cards: `#FFFFFF`, 1px border `#E5DFD3`
- Primary text: `#2B2B28`
- Secondary text: `#6B6A63`
- Brand primary: `#4A5A3A` (deep olive), used for buttons and heading accents
- Accent: `#B8873B` (aged brass), used for small caps labels, rules, check marks
- Single highlight: `#D9822B` (amber), used only for countdown digits and primary button hover

**Typography**
- Display and headings: `Bricolage Grotesque`, weights 600 and 700
- Body and UI: `IBM Plex Sans`, weights 400, 500, 600
- Hero headline: clamp 2.25rem mobile to 4rem desktop, leading 1.05, balanced wrap

**Banned visuals.** Do not generate or place: glowing blue tech renders, rising graphs or arrows, coins, currency notes, stock tickers, city skylines, handshakes, people in suits, crypto-style gradients. Use typography, thin rules and whitespace instead.

Mobile first. Most traffic is Meta ads on Android. Everything above the fold must work at 380px wide.

## 2. Page structure (route `/`)

Full scroll. Do not collapse or fold any section behind a "read more" button.

### 2.1 Sticky header
- Left: an icon mark (a simple single-page glyph, brass outline, no clip art) plus the wordmark `The One Page Plan` in Bricolage Grotesque 600, and directly under it in small caps secondary text `BY MILANAIRE`
- Right: button `Join free masterclass` which opens the registration popup
- Transparent at top, cream with a bottom border after 40px scroll

### 2.2 Attention pill
Centred, brass border, small caps, letter-spaced:

`FOR INDIANS AGED 30 TO 45 WHO EARN WELL AND CANNOT SAY WHERE IT WENT`

### 2.3 Hero headline

**Know exactly what you own, what it actually returns, and the one thing to fix first**

Render "what it actually returns" in deep olive. No other colour changes.

### 2.4 Hero subhead

Two paragraphs, secondary text, max width 60ch, centred:

"The Money Reality Masterclass. Free, live, ninety minutes, every Saturday evening."

"In ninety minutes I will show you how to build your own money picture, how to calculate what each thing you hold is actually returning after tax and after inflation, and how to name the one thing to fix first. You walk out with it on one page. You will be doing arithmetic on your own numbers, not watching mine."

### 2.5 Two column block

Desktop 55/45. Mobile stacks, video first.

**Left column: video.** Responsive 16:9, rounded corners, soft shadow. Embed slot driven by `VITE_VSL_URL`. If empty, show a neutral cream placeholder with the wordmark centred. No play button, no broken state.

Under the video, small text: `Milan Dodhia · Financial Educator, Milanaire`

**Right column, in this order:**

1. **Countdown card** (section 4)
2. **Four spec chips**, 2x2 grid, white surface, thin border, small icon plus label:
   - `This Saturday, {computed date}` rendered like `6 Sep`
   - `7:00 PM IST`
   - `90 minutes`
   - `English`
3. **Primary CTA**, full width, deep olive, white text, large: `Save my seat for this Saturday →` which opens the registration popup
4. One line of small secondary text under the button: `Free. Live. Nothing to download.`

No price, no struck-through price, no seat count anywhere in this block.

### 2.6 Credential strip
Immediately below the hero, full width, cream, thin brass rules top and bottom. Four items in a row on desktop, 2x2 on mobile. Large number or short phrase in olive, small caps label under it in secondary text.

- `7.5 years` / EQUITY RESEARCH
- `13 years` / LICENSED MUTUAL FUND DISTRIBUTOR, SURRENDERED APRIL 2026
- `~200 families` / COACHED, ONE TO ONE AND IN GROUPS
- `MBA Finance` / AND NISM CERTIFIED

Do not add awards, media logos, or attendee counts. There are none.

## 3. Registration popup, three steps

Every CTA on the page opens this. It is a modal, not an inline form. Cream surface, rounded, max width 460px, closes on overlay click and on escape. A thin three segment progress bar at the top.

### Step 1: qualification
Heading: **One question first**
Sub: `So the session is worth your Saturday evening.`

Two large stacked option buttons, single select:

- Option A: `I want to understand my own money and make my own decisions`
- Option B: `I want someone to tell me which stock or fund to buy`

If A is selected, advance to step 2.

If B is selected, replace the modal contents with:

Heading: **Then this is not the right session for you**
Body: "I will never tell anyone which stock or which fund to buy, so you would leave disappointed and I would rather say that now than take your Saturday evening. If you ever want to learn how to evaluate those decisions yourself, the door is open."
Single button: `Take me back` which returns to step 1.

Do not capture contact details from anyone who selects B. Do not write them to the database.

### Step 2: profile and pain
Heading: **Tell me who I am talking to**
Sub: `Two taps. It changes what I focus on this Saturday.`

**Dropdown 1, label "What best describes you"** with options:
- Salaried professional, mid to senior level
- Business owner or self employed
- Doctor, architect, lawyer or other practice owner
- Senior manager or leadership role
- Recently started earning well
- Something else

**Dropdown 2, label "What is closest to your situation right now"** with options:
- I do not actually know what I own
- I have no idea what any of it is returning
- I have never checked whether my family is covered
- I own things I was sold and cannot explain
- My parents and my children both land on me
- I earn more than ever and nothing feels more secure

Button: `Continue →`. Both fields required.

### Step 3: contact
Heading: **Where do I send the joining link**

1. `full_name` - text, required, min 2 chars, label "Your name"
2. `email` - email, required, validated, label "Email"
3. `phone` - tel, required, label "WhatsApp number", fixed `+91` prefix, exactly 10 digits, stored as `+91XXXXXXXXXX`
4. `whatsapp_consent` - checkbox, **required to submit, unchecked by default**, label exactly:
   `Yes, send me the joining link and session reminders on WhatsApp. I can opt out any time by replying STOP.`
5. `voice_consent` - checkbox, **optional, unchecked by default**, rendered in smaller secondary text directly under the WhatsApp consent line, label exactly:
   `You may also call me with a reminder before the session.`
   This must never block submission. Do not style it to look required and do not pre-tick it.

Submit button: `Save my seat →`. Disabled with a spinner and the text `Saving your seat` while in flight.

**Validation:** inline, under each field, muted red. Never clear what the user typed.
**On success:** navigate to `/confirmed`.
**On failure:** keep the form filled, show one message: `Something went wrong on our side. Please try once more.`

**Hidden captured fields:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_path`. Read from the query string and `document.referrer` on mount.

**Honeypot:** invisible field named `company`. If filled, show success in the UI and write nothing.

Persist step 1 and 2 answers in component state so a user who goes back does not lose them.

## 4. Countdown logic

The most important logic on the page. Get it exactly right.

**Target:** the next occurrence of Saturday 7:00 PM India Standard Time (UTC+5:30).

**Rules**
- Compute the target in IST regardless of the visitor's device timezone, using a fixed +5:30 offset. Do not use browser local time for the target.
- Currently Saturday and IST time is before 19:00: target is today at 19:00 IST.
- Currently Saturday and IST time is 19:00 or later: target is next Saturday at 19:00 IST.
- Any other day: target is the coming Saturday at 19:00 IST.
- Recompute every second. **The moment it reaches zero it rolls forward to the following Saturday and keeps running.** It must never display 00:00:00 and never display negatives.

**Card design**
- Small caps brass label: `NEXT SESSION STARTS IN`
- Three digit groups in amber, tabular numerals, large: `DAYS`, `HOURS`, `MINUTES`. **Do not show seconds.**
- Small secondary text under the digits: `Miss it and the next one is seven days away.`

Expose a shared helper `getNextSessionIST()` returning the target `Date`. Use it for the countdown, the spec chip date, the sticky bar, the calendar file and the `session_date` written to the database, so all five can never disagree.

## 5. Sticky bottom bar

Appears only after the user scrolls past the hero block. Slides up, stays fixed, dismissible with a small close icon that keeps it hidden for the rest of the session.

- Left: compact countdown, `Starts in 3d 04h 12m`
- Right: button `Save my seat →` which opens the popup
- Cream background, top border, subtle shadow. Full width on mobile with the button taking the right half.

## 6. Content sections

Max width 900px, centred, generous vertical padding, thin brass rule between sections.

### 6.1 The old way and the new way
Heading: **Two ways to handle money, and only one of them compounds**

Two columns, side by side on desktop, stacked on mobile. Left column muted and greyed, right column white with an olive left border.

**THE OLD WAY**
- Work more hours, because raising your rate was never presented as an option
- Buy what someone recommended, then never go back and check it
- Judge a holding by whether the number went up
- Keep the whole picture in your head, in fragments, across eleven apps
- Decide nothing, because every answer has a confident opposite
- Never talk about it at home

**THE NEW WAY**
- Treat your income as a variable you are accountable for
- Evaluate anything before you hold it, including whatever anyone else recommends
- Judge a holding post tax and post inflation, using the right measure for it
- Hold the whole picture on one page, in your own file
- Decide, because you have a method for testing a claim
- Run it as a conversation your family is part of

### 6.2 How this works, in three principles
Heading: **Three things that change the arithmetic**

Three numbered cards:

1. **Effort is not a strategy.** Your income is a variable, not a constant. It is the one lever entirely inside your control and almost nobody is told that.
2. **Long term means thirty years, not five.** Every decade you can add is compounding you get for free. Almost everything in India is sold as long term at a three to five year horizon.
3. **Check whether the vehicle can produce the result before you pour years into it.** Executing correctly inside the wrong structure still gets you nothing.

### 6.3 The three secrets
Heading: **Three things almost nobody checks**

1. **Your money doubled and you got poorer.**
Doubling over ten years works out to about seven percent a year. Take tax off it, then set six percent inflation against it, and what is left can be less than nothing. The statement looked good the whole time. We will do this arithmetic live, on your numbers.

2. **You own things you never chose.**
A policy from a relative. Something a colleague recommended. Another flat because money had piled up. There is also a clause in most term policies, chosen at the start or never, that decides whether the payout reaches your spouse or settles what you owe. Almost nobody is told about it.

3. **Your income is not a constant.**
Everyone optimises the leftovers. Almost nobody questions the number at the top.

### 6.4 What changes after
Heading: **What you can do by Sunday morning**

Six lines with brass check marks:
- Open one page and see everything you own, in your own file
- Say your number out loud without having to go and check
- Calculate what any holding is actually returning, post tax and post inflation
- Explain every product you own in one sentence each
- Know whether your family is covered, on paper, rather than as a feeling
- Name the one thing to fix first, and know why it is that one

### 6.5 Who this is for, and who it is not for
Heading: **Read this before you register**

Two columns.

**THIS IS FOR YOU IF** (brass check marks)
- You are between thirty and forty-five, salaried or professional, and earning well
- You are carrying a home loan or another EMI
- Your parents are ageing behind you and your children's costs are ahead of you
- You own financial products you were sold rather than ones you chose
- Every answer has a confident opposite, so you have decided nothing in years
- There is nobody you can ask who is not also selling you something

**THIS IS NOT FOR YOU IF** (muted cross marks, grey column)
- You want stock tips or fund recommendations. I will never give one
- You want a guaranteed return. Nobody honest can promise you one
- You want somebody else to manage it for you. This teaches you to do it
- You are looking for a get rich scheme. This is arithmetic and it is slow
- You are not willing to look at your own numbers honestly for ninety minutes

### 6.6 What you take away
Heading: **Three things you keep**

Three cards. **No rupee values on any of them.**

1. **The Money Audit sheet.** Build your own consolidated picture, in your own file, so the data stays yours and nobody can sell to you off the back of it.
2. **The Real Return calculator.** Check anything you already hold, post tax and post inflation, using the right measure for it.
3. **The Nomination and MWP checklist.** Every account and policy, and the one clause most people have never heard of.

### 6.7 About the host
Two columns on desktop, portrait left, text right. Plain portrait, warm background, no props, driven by `VITE_HOST_IMAGE_URL`.

Heading: **Milan Dodhia**
Small caps brass subheading: `FINANCIAL EDUCATOR`

Body:

"Seven and a half years in equity research. Thirteen years as a licensed mutual fund distributor, a licence I surrendered in April 2026. Now inside a credit bureau, working across both the bank side and the credit side, which means I know what a lender sees when they look at you. MBA in Finance. Around two hundred families coached, one to one and in groups.

My father ran the same shop in Mumbai for thirty five years, from seven in the morning to one at night. Real income, earned through sheer hard work, with no financial education behind it. The hours were the strategy and there was never a second one. Years later I was able to tell him he could stop, and he did. Our family dinner moved from half past ten at night to half past eight.

I do not sell products, so I do not earn commissions. I teach the frameworks so you decide, and so you can judge whether anyone else's recommendation holds up. Including mine."

### 6.8 Testimonials
Build the component. Three cards, name, one line of context, a short quote.

**Render it only when `VITE_TESTIMONIALS_ENABLED` equals the string `"true"`. Default the variable to `false` so the section does not appear on launch.** Use neutral placeholder text inside the component. Do not invent realistic sounding testimonials, names or photographs.

### 6.9 FAQ
Accordion, closed by default.

- **Is this actually free?** Yes. It is a live ninety minute session and there is nothing to pay to attend.
- **Will there be a recording?** No. It runs live every Saturday, and if you miss one you can join the next.
- **Do I need to prepare anything?** Sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers.
- **Will you tell me what to invest in?** No. I teach how to evaluate anything, so you decide for yourself and can check anyone else's recommendation too.
- **Is this suitable if I already invest regularly?** Most people who attend already do. The question is whether anyone has ever gone back and checked what it is actually returning.
- **I am not good with numbers. Will I keep up?** Yes. It is addition, subtraction and one division. If you can read a bank statement you can do this.
- **Is this a sales pitch?** I teach for the first hour and a half and then I tell you what else I do. You are free to take the frameworks and never buy anything.
- **What happens after I register?** You will get an email and a WhatsApp message with the joining link, and a reminder before the session starts.

### 6.10 Final CTA block
Full width, deep olive background, cream text, generous padding.

Heading: **Ninety minutes this Saturday. What is your actual number?**
Sub: `Free, live, and you leave with it on one page.`
Button: cream background, olive text, `Save my seat for this Saturday →`

### 6.11 Footer
Cream, top border, small text, three stacked blocks.

**Contact:** `The One Page Plan by Milanaire · connect@onepageplan.in`

**Disclaimer**, in a bordered box so it reads as deliberate rather than buried:

"The One Page Plan is a financial education programme by Milanaire, operated by Mannrs Wellness LLP. Everything on this page and in this session is educational content only. It is not investment advice and it is not a recommendation to buy or sell any security, scheme, policy or product. No returns are promised or implied. For anything tax related please consult a Chartered Accountant. For anything legal please consult a lawyer. Please make your own decisions."

**Links:** `Privacy Policy` to `/privacy`, `Terms of Use` to `/terms`, and `© {computed year} Mannrs Wellness LLP`.

## 7. Thank you page (route `/confirmed`)

Same design system. No countdown. No sticky bar. No new registration CTA.

Heading: **Your seat is saved**

**Step 1. Done.** Your details are with us. The joining link is on its way by email and on WhatsApp.

**Step 2. Confirm on the session platform.** One more short form, and this is the one that lets you in on the night.
Button: `Confirm my seat →` linking to `VITE_WEBINAR_URL`, opens in a new tab. Style this as the most prominent element on the page.

**Prep video.** Responsive 16:9 slot driven by `VITE_PREP_VIDEO_URL`, with the heading `Two minutes before Saturday` and the line `A short note on how to get the most out of the session.` If the variable is empty, hide the entire block rather than showing a placeholder.

**Card: Before Saturday**
- Add it to your calendar. Button generating and downloading an `.ics` for the computed next Saturday, 19:00 to 20:30 IST, titled "The Money Reality Masterclass", with `VITE_WEBINAR_URL` in the location field.
- Sit somewhere quiet with a pen. You will be working on your own numbers.
- Check your email. If nothing arrives in ten minutes, look in Promotions or Spam and mark it as not spam.

**WhatsApp block.** Render only when `VITE_WHATSAPP_GROUP_URL` is set. Heading `Join the WhatsApp group`, three lines: reminders before the session, the resources sent straight to you, and somewhere to ask a question before Saturday. Button: `Join the group →`.

Footer identical to the main page.

## 8. Privacy and Terms pages

Create `/privacy` and `/terms` as real pages using the same design system, narrow single column, readable.

Generate standard, plain English content appropriate to an Indian financial education business that collects name, email and WhatsApp number through a registration form, runs Meta advertising, sends transactional and marketing email and WhatsApp messages, and uses cookies and Meta Pixel.

Privacy must cover: what is collected, why, lawful basis of consent, how WhatsApp consent works and how to withdraw it by replying STOP, that a separate optional consent covers reminder phone calls and can be withdrawn by emailing the contact address, third parties that process data (email provider, WhatsApp provider, webinar platform, analytics, Meta), retention, the user's rights, and a contact address of connect@onepageplan.in.

Terms must cover: the educational nature of the content, that nothing is investment advice or a recommendation, no guarantee of any outcome or return, intellectual property in the materials, acceptable use, limitation of liability, and governing law of India with jurisdiction in Mumbai.

At the top of each page render a small note in secondary text: `Last updated {computed date}.`

**Add an HTML comment at the top of both files reading: `REVIEW REQUIRED BEFORE LAUNCH. Standard template, not legal advice.`**

## 9. Database schema

Single table `registrations`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key, default gen_random_uuid() |
| `created_at` | timestamptz | default now() |
| `full_name` | text | not null |
| `email` | text | not null |
| `phone_e164` | text | not null |
| `whatsapp_consent` | boolean | not null, default false |
| `consent_at` | timestamptz | set at insert when whatsapp_consent is true |
| `voice_consent` | boolean | not null, default false |
| `voice_consent_at` | timestamptz | nullable, set at insert when voice_consent is true |
| `profile_type` | text | from step 2 dropdown 1 |
| `pain_point` | text | from step 2 dropdown 2 |
| `session_date` | date | the computed next Saturday |
| `status` | text | default 'registered'. Allowed: registered, attended, dropped_off, no_show |
| `utm_source` | text | nullable |
| `utm_medium` | text | nullable |
| `utm_campaign` | text | nullable |
| `utm_content` | text | nullable |
| `utm_term` | text | nullable |
| `referrer` | text | nullable |
| `email_sent_at` | timestamptz | nullable |
| `email_error` | text | nullable |
| `whatsapp_sent_at` | timestamptz | nullable |
| `whatsapp_error` | text | nullable |
| `raw_webhook` | jsonb | nullable |

**Indexes:** unique on `(email, session_date)`. On conflict, update name, phone, both consent flags, profile and pain point, and re-send the confirmation. Never downgrade a consent that was previously true unless the new submission explicitly sets it false.

**Row level security:** enabled. No public select, no public insert. All writes go through Edge Functions using the service role key. The browser never talks to the table directly.

## 10. Edge Functions

### 10.1 `register`
Public endpoint called by step 3 of the popup.

1. Validate: name length, email format, phone exactly 10 digits, `whatsapp_consent` true, honeypot empty, profile and pain point present. **`voice_consent` is optional and must never cause a rejection.** Set `voice_consent_at` only when it is true.
2. Rate limit: reject more than 5 submissions from one IP within 10 minutes.
3. Compute `session_date` server side using the same IST rules. Do not trust a date sent from the browser.
4. Upsert into `registrations`.
5. Invoke `send-confirmation-email`, then `send-whatsapp`. Return success to the browser as soon as the row is written. Do not block the response past 3 seconds.
6. Return `{ ok: true }`.

Email and WhatsApp failures must never fail the registration. Write the error to `email_error` or `whatsapp_error` and continue.

### 10.2 `send-confirmation-email`
Uses SMTP via `denomailer` (`https://deno.land/x/denomailer/mod.ts`). **Do not use Nodemailer. It is Node only and will not run in a Deno Edge Function.**

Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`.

Table based HTML with inline styles so it renders in Gmail. Cream background, olive heading, one button. Include a plain text alternative part.

Subject: `Your seat is saved for this Saturday`

Body:

"Hello {first name},

Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST and takes ninety minutes.

One thing left to do. Confirm your seat on the session platform using the button below. That is the step that actually lets you in on the night.

[Confirm my seat]

Before Saturday, sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers, not watching mine.

See you there.

Milan Dodhia
Financial Educator, Milanaire"

Every email footer carries the full disclaimer from section 6.11, plus `Mannrs Wellness LLP · connect@onepageplan.in` and an unsubscribe line.

Write `email_sent_at` on success, `email_error` on failure.

### 10.3 `send-whatsapp`
**Build it now, ship it switched off.**

Read `WHATSAPP_ENABLED`. If it is not the string `"true"`, log the payload that would have been sent and return `{ skipped: true }` without calling anything. Never throw.

When enabled, POST to the AiSensy campaign API using `AISENSY_API_KEY` and `AISENSY_CAMPAIGN_NAME`, with `destination` set to `phone_e164`, `userName` set to `full_name`, and template parameters for first name and the webinar URL. Only send when `whatsapp_consent` is true.

Write `whatsapp_sent_at` or `whatsapp_error`.

### 10.4 `webinar-webhook`
Public POST at `/functions/v1/webinar-webhook`.
- You own financial products you were sold rather than ones you chose
- Every answer has a confident opposite, so you have decided nothing in years
- There is nobody you can ask who is not also selling you something

**THIS IS NOT FOR YOU IF** (muted cross marks, grey column)
- You want stock tips or fund recommendations. I will never give one
- You want a guaranteed return. Nobody honest can promise you one
- You want somebody else to manage it for you. This teaches you to do it
- You are looking for a get rich scheme. This is arithmetic and it is slow
- You are not willing to look at your own numbers honestly for ninety minutes

### 6.6 What you take away
Heading: **Three things you keep**

Three cards. **No rupee values on any of them.**

1. **The Money Audit sheet.** Build your own consolidated picture, in your own file, so the data stays yours and nobody can sell to you off the back of it.
2. **The Real Return calculator.** Check anything you already hold, post tax and post inflation, using the right measure for it.
3. **The Nomination and MWP checklist.** Every account and policy, and the one clause most people have never heard of.

### 6.7 About the host
Two columns on desktop, portrait left, text right. Plain portrait, warm background, no props, driven by `VITE_HOST_IMAGE_URL`.

Heading: **Milan Dodhia**
Small caps brass subheading: `FINANCIAL EDUCATOR`

Body:

"Seven and a half years in equity research. Thirteen years as a licensed mutual fund distributor, a licence I surrendered in April 2026. Now inside a credit bureau, working across both the bank side and the credit side, which means I know what a lender sees when they look at you. MBA in Finance. Around two hundred families coached, one to one and in groups.

My father ran the same shop in Mumbai for thirty five years, from seven in the morning to one at night. Real income, earned through sheer hard work, with no financial education behind it. The hours were the strategy and there was never a second one. Years later I was able to tell him he could stop, and he did. Our family dinner moved from half past ten at night to half past eight.

I do not sell products, so I do not earn commissions. I teach the frameworks so you decide, and so you can judge whether anyone else's recommendation holds up. Including mine."

### 6.8 Testimonials
Build the component. Three cards, name, one line of context, a short quote.

**Render it only when `VITE_TESTIMONIALS_ENABLED` equals the string `"true"`. Default the variable to `false` so the section does not appear on launch.** Use neutral placeholder text inside the component. Do not invent realistic sounding testimonials, names or photographs.

### 6.9 FAQ
Accordion, closed by default.

- **Is this actually free?** Yes. It is a live ninety minute session and there is nothing to pay to attend.
- **Will there be a recording?** No. It runs live every Saturday, and if you miss one you can join the next.
- **Do I need to prepare anything?** Sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers.
- **Will you tell me what to invest in?** No. I teach how to evaluate anything, so you decide for yourself and can check anyone else's recommendation too.
- **Is this suitable if I already invest regularly?** Most people who attend already do. The question is whether anyone has ever gone back and checked what it is actually returning.
- **I am not good with numbers. Will I keep up?** Yes. It is addition, subtraction and one division. If you can read a bank statement you can do this.
- **Is this a sales pitch?** I teach for the first hour and a half and then I tell you what else I do. You are free to take the frameworks and never buy anything.
- **What happens after I register?** You will get an email and a WhatsApp message with the joining link, and a reminder before the session starts.

### 6.10 Final CTA block
Full width, deep olive background, cream text, generous padding.

Heading: **Ninety minutes this Saturday. What is your actual number?**
Sub: `Free, live, and you leave with it on one page.`
Button: cream background, olive text, `Save my seat for this Saturday →`

### 6.11 Footer
Cream, top border, small text, three stacked blocks.

**Contact:** `The One Page Plan by Milanaire · connect@onepageplan.in`

**Disclaimer**, in a bordered box so it reads as deliberate rather than buried:

"The One Page Plan is a financial education programme by Milanaire, operated by Mannrs Wellness LLP. Everything on this page and in this session is educational content only. It is not investment advice and it is not a recommendation to buy or sell any security, scheme, policy or product. No returns are promised or implied. For anything tax related please consult a Chartered Accountant. For anything legal please consult a lawyer. Please make your own decisions."

**Links:** `Privacy Policy` to `/privacy`, `Terms of Use` to `/terms`, and `© {computed year} Mannrs Wellness LLP`.

## 7. Thank you page (route `/confirmed`)

Same design system. No countdown. No sticky bar. No new registration CTA.

Heading: **Your seat is saved**

**Step 1. Done.** Your details are with us. The joining link is on its way by email and on WhatsApp.

**Step 2. Confirm on the session platform.** One more short form, and this is the one that lets you in on the night.
Button: `Confirm my seat →` linking to `VITE_WEBINAR_URL`, opens in a new tab. Style this as the most prominent element on the page.

**Prep video.** Responsive 16:9 slot driven by `VITE_PREP_VIDEO_URL`, with the heading `Two minutes before Saturday` and the line `A short note on how to get the most out of the session.` If the variable is empty, hide the entire block rather than showing a placeholder.

**Card: Before Saturday**
- Add it to your calendar. Button generating and downloading an `.ics` for the computed next Saturday, 19:00 to 20:30 IST, titled "The Money Reality Masterclass", with `VITE_WEBINAR_URL` in the location field.
- Sit somewhere quiet with a pen. You will be working on your own numbers.
- Check your email. If nothing arrives in ten minutes, look in Promotions or Spam and mark it as not spam.

**WhatsApp block.** Render only when `VITE_WHATSAPP_GROUP_URL` is set. Heading `Join the WhatsApp group`, three lines: reminders before the session, the resources sent straight to you, and somewhere to ask a question before Saturday. Button: `Join the group →`.

Footer identical to the main page.

## 8. Privacy and Terms pages

Create `/privacy` and `/terms` as real pages using the same design system, narrow single column, readable.

Generate standard, plain English content appropriate to an Indian financial education business that collects name, email and WhatsApp number through a registration form, runs Meta advertising, sends transactional and marketing email and WhatsApp messages, and uses cookies and Meta Pixel.

Privacy must cover: what is collected, why, lawful basis of consent, how WhatsApp consent works and how to withdraw it by replying STOP, that a separate optional consent covers reminder phone calls and can be withdrawn by emailing the contact address, third parties that process data (email provider, WhatsApp provider, webinar platform, analytics, Meta), retention, the user's rights, and a contact address of connect@onepageplan.in.

Terms must cover: the educational nature of the content, that nothing is investment advice or a recommendation, no guarantee of any outcome or return, intellectual property in the materials, acceptable use, limitation of liability, and governing law of India with jurisdiction in Mumbai.

At the top of each page render a small note in secondary text: `Last updated {computed date}.`

**Add an HTML comment at the top of both files reading: `REVIEW REQUIRED BEFORE LAUNCH. Standard template, not legal advice.`**

## 9. Database schema

Single table `registrations`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key, default gen_random_uuid() |
| `created_at` | timestamptz | default now() |
| `full_name` | text | not null |
| `email` | text | not null |
| `phone_e164` | text | not null |
| `whatsapp_consent` | boolean | not null, default false |
| `consent_at` | timestamptz | set at insert when whatsapp_consent is true |
| `voice_consent` | boolean | not null, default false |
| `voice_consent_at` | timestamptz | nullable, set at insert when voice_consent is true |
| `profile_type` | text | from step 2 dropdown 1 |
| `pain_point` | text | from step 2 dropdown 2 |
| `session_date` | date | the computed next Saturday |
| `status` | text | default 'registered'. Allowed: registered, attended, dropped_off, no_show |
| `utm_source` | text | nullable |
| `utm_medium` | text | nullable |
| `utm_campaign` | text | nullable |
| `utm_content` | text | nullable |
| `utm_term` | text | nullable |
| `referrer` | text | nullable |
| `email_sent_at` | timestamptz | nullable |
| `email_error` | text | nullable |
| `whatsapp_sent_at` | timestamptz | nullable |
| `whatsapp_error` | text | nullable |
| `raw_webhook` | jsonb | nullable |

**Indexes:** unique on `(email, session_date)`. On conflict, update name, phone, both consent flags, profile and pain point, and re-send the confirmation. Never downgrade a consent that was previously true unless the new submission explicitly sets it false.

**Row level security:** enabled. No public select, no public insert. All writes go through Edge Functions using the service role key. The browser never talks to the table directly.

## 10. Edge Functions

### 10.1 `register`
Public endpoint called by step 3 of the popup.

1. Validate: name length, email format, phone exactly 10 digits, `whatsapp_consent` true, honeypot empty, profile and pain point present. **`voice_consent` is optional and must never cause a rejection.** Set `voice_consent_at` only when it is true.
2. Rate limit: reject more than 5 submissions from one IP within 10 minutes.
3. Compute `session_date` server side using the same IST rules. Do not trust a date sent from the browser.
4. Upsert into `registrations`.
5. Invoke `send-confirmation-email`, then `send-whatsapp`. Return success to the browser as soon as the row is written. Do not block the response past 3 seconds.
6. Return `{ ok: true }`.

Email and WhatsApp failures must never fail the registration. Write the error to `email_error` or `whatsapp_error` and continue.

### 10.2 `send-confirmation-email`
Uses SMTP via `denomailer` (`https://deno.land/x/denomailer/mod.ts`). **Do not use Nodemailer. It is Node only and will not run in a Deno Edge Function.**

Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`.

Table based HTML with inline styles so it renders in Gmail. Cream background, olive heading, one button. Include a plain text alternative part.

Subject: `Your seat is saved for this Saturday`

Body:

"Hello {first name},

Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST and takes ninety minutes.

One thing left to do. Confirm your seat on the session platform using the button below. That is the step that actually lets you in on the night.

[Confirm my seat]

Before Saturday, sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers, not watching mine.

See you there.

Milan Dodhia
Financial Educator, Milanaire"

Every email footer carries the full disclaimer from section 6.11, plus `Mannrs Wellness LLP · connect@onepageplan.in` and an unsubscribe line.

Write `email_sent_at` on success, `email_error` on failure.

### 10.3 `send-whatsapp`
**Build it now, ship it switched off.**

Read `WHATSAPP_ENABLED`. If it is not the string `"true"`, log the payload that would have been sent and return `{ skipped: true }` without calling anything. Never throw.

When enabled, POST to the AiSensy campaign API using `AISENSY_API_KEY` and `AISENSY_CAMPAIGN_NAME`, with `destination` set to `phone_e164`, `userName` set to `full_name`, and template parameters for first name and the webinar URL. Only send when `whatsapp_consent` is true.

Write `whatsapp_sent_at` or `whatsapp_error`.

### 10.4 `webinar-webhook`
Public POST at `/functions/v1/webinar-webhook`.

- Verify a shared secret header against `WEBHOOK_SHARED_SECRET`. Reject with 401 on mismatch.
- Store the entire body into `raw_webhook`.
- Match the registration by email, case insensitive, on the current `session_date`.
- Joined or attended sets `status` to `attended`. Drop off or left early sets `status` to `dropped_off`.
- If no match, still return 200 so the sender does not retry forever. Log it.

Build defensively. The payload shape is not yet known. Read every field optionally and never throw on a missing key.

## 11. Admin view (route `/admin`)

Password gate using `ADMIN_PASSWORD`, checked inside an Edge Function, never in the browser bundle.

Table of registrations for the current `session_date`: name, email, phone, WhatsApp consent, call consent, profile type, pain point, status, email sent yes or no. Total count at the top, plus a simple breakdown of counts by pain point, since that is the ad copy signal. A "Download CSV" button.

Keep it plain. No charts.

## 12. Environment variables to create

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`, `VITE_WEBINAR_URL`, `VITE_VSL_URL`, `VITE_PREP_VIDEO_URL`, `VITE_HOST_IMAGE_URL`, `VITE_WHATSAPP_GROUP_URL`, `VITE_TESTIMONIALS_ENABLED`, `WHATSAPP_ENABLED`, `AISENSY_API_KEY`, `AISENSY_CAMPAIGN_NAME`, `WEBHOOK_SHARED_SECRET`, `ADMIN_PASSWORD`.

Set `WHATSAPP_ENABLED` to `false` and `VITE_TESTIMONIALS_ENABLED` to `false` for now.

### WhatsApp Activation (AiSensy Integration)

WhatsApp confirmations and reminders use the **AiSensy REST API** (Meta WhatsApp Business API). 
- By default, `WHATSAPP_ENABLED` is set to `false`. In this mode, the server logs simulated dispatches without sending real WhatsApp messages or failing registrations.
- To activate live WhatsApp alerts, set `WHATSAPP_ENABLED=true` and configure your `AISENSY_API_KEY` and `AISENSY_CAMPAIGN_NAME` in Vercel.
- **Detailed Step-by-Step Guide**: For complete instructions on Meta Business verification, template submission, AiSensy campaign setup, environment variable configuration, and Admin Dashboard monitoring, see [`WHATSAPP_SETUP_GUIDE.md`](file:///c:/Projects/One-page-plan-landing-page/plan-one-page/WHATSAPP_SETUP_GUIDE.md).

## 13. Completeness checklist

Build all of the following in this pass. Nothing here is optional or deferred.

1. Page layout, all copy, countdown, sticky bar, three step popup
2. Database table and RLS
3. `register` Edge Function and `/confirmed`
4. `send-confirmation-email`
5. `/privacy` and `/terms`
6. `send-whatsapp`, switched off behind `WHATSAPP_ENABLED`
7. `webinar-webhook`
8. `/admin`

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/304b69d4-09fb-40f6-9b4c-38417454f616).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
