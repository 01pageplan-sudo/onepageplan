# The One Page Plan (onepageplan.in)
## Comprehensive Website Functionality Specification & End-to-End UAT Testing Manual

---

### Document Overview
This document specifies **every single functionality, integration, database rule, pricing mechanic, automation workflow, and operational edge-case** built into **The One Page Plan** (`onepageplan.in`). It is accompanied by **exhaustive test data sets, mock payloads, simulation guides, and 25 step-by-step User Acceptance Testing (UAT) test cases** so that no scenario is left to chance.

---

## 1. System Architecture & Topology

```
                                          +-------------------------------------------------------------+
                                          |                    CLIENT BROWSERS                          |
                                          |  • Desktop / Mobile Visitors     • Enrolled Members         |
                                          |  • Masterclass Registrants       • System Administrators    |
                                          +-------------------------------------------------------------+
                                                                         |
                                                   HTTPS / TLS 1.3       v
+----------------------------------------------------------------------------------------------------------------------------------------+
|                                                      TANSTACK START / VERCEL SERVERLESS                                                |
|                                                                                                                                        |
|  [PUBLIC FRONTEND ROUTES]                 [COMMERCE & CHECKOUT]                     [REST API & WEBHOOK INGESTION]                     |
|  • / (Landing & Registration)             • /checkout/money-reality-check           • /api/public/razorpay-webhook                     |
|  • /confirmed (Thank You & Calendar)      • /checkout/silver                        • /api/public/whatsapp-webhook                     |
|  • /room (Live Webinar.gg Embed)          • /checkout/gold                          • /api/public/resend-webhook                       |
|  • /course (Member Curriculum Portal)     • /checkout/diamond                       • /api/public/email-dispatch (Cron)                |
|  • /course/complete (Completion Reward)   • /upgrade/silver                         • /api/public/unsubscribe                         |
|  • /payment/pending                       • /upgrade/gold                           • /api/commerce/create-order                       |
|  • /payment/failed                        • /complete/[slug] (Tamper-Proof)         • /api/commerce/validate-coupon                    |
|  • Legal: /terms, /privacy, etc.                                                    • /api/invoices/$token (HTML/PDF)                  |
|                                                                                                                                        |
|  [ADMIN CONSOLE (/admin)]                                                                                                              |
|  • Webinar Analytics   • Commerce Engine   • Communications Hub   • Leads CRM   • Email Automation   • Delivery Health                 |
+----------------------------------------------------------------------------------------------------------------------------------------+
        |                                       |                                    |                                    |
        v                                       v                                    v                                    v
+--------------------+               +--------------------+               +--------------------+               +--------------------+
|  SUPABASE POSTGRES |               |  RAZORPAY GATEWAY  |               |  META WHATSAPP API |               |   RESEND / ZOHO    |
|  • RLS Security    |               |  • Server Orders   |               |  • Cloud API v21.0 |               |  • Transactional   |
|  • Auto Migrations |               |  • Webhook HMAC    |               |  • Inbound 2-Way   |               |  • Drip Sequences  |
|  • RPC Functions   |               |  • Daily Reconcile |               |  • STOP Opt-outs   |               |  • SPF/DKIM/DMARC  |
+--------------------+               +--------------------+               +--------------------+               +--------------------+
```

---

## 2. Master Product Catalog, Pricing & Entitlement Rules

### Product Hierarchy & Feature Matrix

| Product Key | Public Facing Name | Base Price (INR) | Eligibility / Conditions | Entitlements & Included Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| `money_reality_check` | **Money Reality Check (MRC)** | **₹601** (Fixed) | Open to all | • 12 recorded diagnostic audit sessions<br>• 4 core financial audit calculators & sheets<br>• 1 Thursday guest seat (valid 60 days)<br>• 60 days private community access<br>• Locks Silver upgrade credit of ₹601 for 30 days |
| `silver` | **The Calm Money System (Silver)** | **₹6,001** (Dynamic Milestone) | Open to all | • Lifetime access to complete curriculum & sprints<br>• Consolidated asset & liability audit model<br>• Real return & 30% tax drag calculators<br>• MWP Act, nomination & legal transmission vault<br>• Active cohort assignment<br>• First 10 members per cohort get 1:1 strategy bonus |
| `silver` (Upgrade) | **Silver Upgrade from MRC** | **₹5,401** (Locked) | Active MRC purchaser within 30-day window | • Full Silver lifetime entitlements<br>• Credit of ₹601 deducted from locked base price (₹6,001 - ₹601 = ₹5,400 -> rounded to ₹5,401)<br>• Replaces MRC access tier with Silver |
| `gold` | **Gold Master Access** | **₹24,000** (Base) | Open when `gold_on_sale` is TRUE | • Lifetime Silver access + complete Gold curriculum<br>• Advanced wealth transmission & family trust vault<br>• Direct quarterly portfolio reviews<br>• Priority cohort positioning |
| `gold` (Completer) | **Gold Completer Upgrade** | **₹18,001** (Special) | Silver members completing course before deadline | • Special completer reward price of ₹18,001<br>• Unlocked via `/course/complete`<br>• Enforces deadline countdown |
| `diamond` | **Diamond Elite Private Office** | **₹60,001** (Base) | Open when `diamond_on_sale` is TRUE | • Lifetime Silver and Gold membership<br>• 12 months direct private office advisory with Milan Dodhia<br>• Bespoke trust, estate, and international tax architecture |
| `diamond_renewal` | **Diamond Annual Renewal** | **₹60,001** (Renewal) | Existing Diamond members | • Extends Diamond advisory access by 365 days from current expiry date |

### Mathematical Rounding Rule
For all upgrades, credits, and adjusted transactions, the system enforces the **"End in 01" Rounding Rule**:
- *Algorithm:* `Subtract credit -> if result doesn't end in 01, round up to the next integer ending in 01.`
- *Formula:*
  ```typescript
  export function roundUp01(amount: number): number {
    if (amount <= 0) return 1;
    const rem = amount % 100;
    if (rem === 1) return amount;
    return Math.floor(amount / 100) * 100 + (rem > 1 ? 101 : 1);
  }
  ```
- *Examples:*
  - ₹6,001 - ₹601 = ₹5,400 -> **₹5,401**
  - ₹24,000 - ₹6,002 = ₹17,998 -> **₹18,001**
  - ₹6,000 -> **₹6,001**
  - ₹6,001 -> **₹6,001** (unchanged)

### Dynamic Milestone Pricing for Silver
- Base price starts at **₹6,001**.
- System queries active, unrefunded Silver purchases using database RPC `compute_current_silver_pricing`.
- Configured milestones (in `commerce_settings.silver_milestones`):
  - 0 to 99 members: **₹6,001**
  - 100 to 199 members: **₹7,001**
  - 200 to 299 members: **₹8,001**
  - 300+ members: **₹9,001**
- Checkout displays real-time banner: *"Current tier: ₹6,001. Next price: ₹7,001 once milestone is reached."*

---

## 3. Website Routes & Detailed Functionality Map

### Public & Lead Generation Pages
1. **`GET /` (Landing Page)**:
   - **Hero Section**: Dynamic session date badge (formats to upcoming Saturday 7:00 PM IST), primary CTA *"Reserve Your Free Seat"*, VSL video embed.
   - **Credential Strip**: Highlights Milan Dodhia's background, assets advised, and track record.
   - **Old vs New Model**: Comparison between conventional commission-driven advice vs fiduciary one-page plan.
   - **Principles & Secrets**: 3 core masterclass pillars and 12-question financial diagnostics.
   - **FAQ & Testimonials**: Accordion-based FAQs and verified participant reviews.
   - **Sticky Bar**: Floating CTA on mobile and desktop scroll with real-time countdown to session start.
   - **Registration Modal**:
     - Fields: Full Name, Email Address, WhatsApp Mobile Number (+91 default).
     - Indian Mobile Sanitization: Automatically strips extraneous leading `0` (e.g. `+9109820...` -> `+919820...`), deduplicates pasted `+91` or `91`.
     - Consent Checkbox: Pre-checked WhatsApp communication consent.
     - On Submit: Calls `registerAttendee` server function, creates lead in `registrations`, queues confirmation email + WhatsApp, triggers Meta Pixel `Lead` & `CompleteRegistration`, triggers ChatGPT server-side Conversion API (`registration_completed`), redirects to `/confirmed`.

2. **`GET /confirmed` (Seat Confirmation & Pre-Webinar Warmup)**:
   - Displays confirmed date and time (Saturday 7:00 PM IST).
   - One-click calendar integrations: Google Calendar, iCalendar (.ics), Outlook Calendar.
   - Video orientation embed (Milan Dodhia walkthrough).
   - Pre-Webinar Question Submitter (`AskQuestion` component): allows attendee to submit their #1 financial worry directly to Milan Dodhia (`registrations.unanswered_question`).
   - Private WhatsApp Community Join CTA (`VITE_WHATSAPP_GROUP_URL`).
   - Idempotent conversion pixel tracking (sessionStorage guard `fired_{registrationId}`).

3. **`GET /room` (In-Page Live Webinar Room)**:
   - Query Parameter: `?email=user@example.com`
   - Flow:
     - If email provided, calls `getJoinToken({ email })`.
     - Looks up lead in `registrations`. If found, calls Webinar.gg API (`/api/get-webinar-token`) to generate a unique viewer JWT.
     - Renders full-screen responsive iframe embed (`WebinarEmbed` component) pointed to `https://webinar.gg/embed/...`.
     - If attendee not found: renders prompt asking user to enter registered email or opens registration modal.
     - Handles iframe postMessage security events (`user.joined`, `user.left`, tab duplicate prevention).

4. **`GET /resources` (Curated Resource Vault)**:
   - Open vault containing downloadable audit sheets, masterclass slides, and sample plans.

5. **Legal & Compliance Pages**:
   - `GET /terms`: Terms of Service (Governed by laws of India, educational disclaimer, no SEBI investment advice guarantee).
   - `GET /privacy`: DPDP Act & GDPR compliant privacy policy covering data handling, cookies, and communications.
   - `GET /refund-policy`: Transparent refund policy detailing non-refundable live sessions, 30-day MRC upgrade credit rollover, and statutory rights.
   - `GET /shipping-policy`: Digital goods delivery timeline (instant access upon payment confirmation via email and member portal).
   - `GET /contact`: Full legal entity details (`Manrrs Wellness LLP`), registered address, grievance officer contact, email, and phone.

---

### Commerce, Checkout & Upgrade Pages
6. **`GET /checkout/money-reality-check`**:
   - Fixed price: **₹601**.
   - Server-calculated checkout view (`CheckoutView` component).
   - Form fields: Full Name, Email, Phone, Terms acceptance, WhatsApp consent.
   - Razorpay Standard Checkout SDK embed.
   - Coupon discount code validation input (`/api/commerce/validate-coupon`).
   - On completion: redirects to `/complete/money-reality-check?order_id=...&token=...`.

7. **`GET /checkout/silver`**:
   - Dynamic price: **₹6,001** (or milestone price).
   - Displays active cohort name and start date (e.g. *"Cohort 14 starting Monday, 2 November"*).
   - Real-time bonus counter: *"First 10 members receive a private 1:1 strategy session with Milan Dodhia (X spots remaining)"*.
   - Server-enforced price locking: prevents browser tampering.

8. **`GET /checkout/gold` & `GET /checkout/diamond`**:
   - Price: **₹24,000** (Gold) / **₹60,001** (Diamond).
   - Enforces sale status check: if `gold_on_sale` or `diamond_on_sale` is false in `commerce_settings`, displays *"Currently Closed — By Application Only"* state.

9. **`GET /upgrade/silver`**:
   - Query Parameter: `?email=user@example.com`
   - Server validates whether the user holds an active MRC purchase within 30 days.
   - If eligible (e.g. Day 20): displays locked price **₹5,401** with breakdown:
     - Standard Silver: ₹6,001
     - MRC Credit Applied: -₹601
     - Total Payable: **₹5,401**
     - Countdown badge: *"Your credit expires in 10 days"*.
   - If window expired (e.g. Day 31): displays notice that 30-day credit has elapsed and charges full current milestone price.

10. **`GET /upgrade/gold`**:
    - Query Parameter: `?email=user@example.com`
    - Validates whether user completed course before deadline.
    - If eligible: charges special completer price **₹18,001** (saving ₹5,999 from base ₹24,000).

---

### Completion & Payment Status Pages
11. **`GET /complete/[slug]` (`money-reality-check`, `silver`, `silver-upgrade`, `gold`, `diamond`)**:
    - Query Parameters: `?order_id=...&token=...`
    - **Tamper-Proof HMAC Security Guard**:
      - Server generates SHA-256 HMAC of `order_id` salted with `COMMERCE_SIGNING_SECRET`.
      - Only requests with valid signature or matching logged-in buyer email can view the page.
      - Tampered or forged requests return `401 Unauthorized`.
    - **Order Status Polling Engine**:
      - If payment is in flight and webhook has not arrived yet, page enters polling mode (`status: "polling"`).
      - Polls `/api/commerce/poll-order-status` every 2 seconds.
      - As soon as status flips to `captured`, page automatically refreshes and displays full access tokens.
      - If webhook takes longer than 120 seconds, gracefully redirects to `/payment/pending`.
    - **Dynamic Mustache Token Replacement Engine**:
      - Tokens evaluated: `{{first_name}}`, `{{amount_paid}}`, `{{invoice_url}}`, `{{member_area_url}}`, `{{cohort_name}}`, `{{cohort_start_date}}`, `{{#if bonus}}...{{/if}}`, `{{bonus_booking_url}}`, `{{community_url}}`.
      - Strict HTML escaping prevents XSS injection from attendee names.
    - **Meta Pixel Purchase Tracking**:
      - Automatically fires `fbq('track', 'Purchase', { value, currency: 'INR', content_name })` with unique `eventID: orderDbId`.
      - Deduplicated across session and local storage to prevent duplicate firing on page refreshes.

12. **`GET /payment/pending`**:
    - Displays friendly pending settlement notice when bank transaction is under review.
    - Advises user that receipt and access link will reach their email upon bank confirmation.

13. **`GET /payment/failed`**:
    - Displays clean error notice: *"Payment not completed — nothing was charged"*.
    - Contextual back-button preserving original checkout URL.

---

### Member Area & Course Curriculum
14. **`GET /course` (Member Portal)**:
    - Query Parameter: `?email=user@example.com`
    - Tier-Gated Access Matrix:
      - MRC members: Unlocks MRC 12 diagnostic sessions + 4 audit calculators.
      - Silver members: Unlocks complete Calm Money System video curriculum, implementation spreadsheets, mission sprint guides.
      - Gold members: Unlocks Silver + Gold master modules.
      - Diamond members: Unlocks full library + private office booking portal.
      - Owner / Admin Bypass: Emails configured in `COURSE_ADMIN_EMAILS` (e.g. `dodhia.milan@gmail.com`) automatically receive 100% unlocked access.
    - Video Protection: Vimeo / custom embed with domain restriction, disabling direct download.

15. **`GET /course/complete` (Course Completion & Gold Upgrade Unlock)**:
    - Query Parameter: `?email=user@example.com`
    - Allows Silver members who completed the curriculum to submit proof (worksheet links, completed one-page plan).
    - Upon submission: records entry in `course_completions`, calculates completion deadline (e.g. 7 days), unlocks the special ₹18,001 Gold upgrade tier, and triggers the Gold Completer email sequence.

16. **`GET /api/invoices/$token` (Tax Invoice & Receipt Generator)**:
    - Renders clean, high-resolution, print-ready HTML / PDF document.
    - Sequential FY numbering format: `INV-2026-27/0001` (Tax Invoice) or `RCPT-2026-27/0001` (Receipt).
    - Includes legal entity: `Manrrs Wellness LLP`, GSTIN, SAC Code `999293`, customer details, itemized breakdown, and credit lines.

---

### Internal Management Console (`/admin`)
Authenticated via `ADMIN_PASSWORD` (session stored with local storage fallback).

1. **Tab 1: Webinar Analytics (`WebinarAnalytics`)**:
   - Real-time attendee counter, peak attendance, average watch duration.
   - Attendance drop-off chart by minute.
   - Live activity terminal: real-time stream of webinar.gg webhook events (`user.joined`, `user.left`, chat messages).

2. **Tab 2: Commerce Panel (`CommercePanel`)**:
   - **Subtab Orders**: Complete orders log with status filters (`captured`, `pending`, `failed`, `refunded`), buyer details, amount, invoice link, and 1-click Razorpay refund button.
   - **Subtab Settings**: Configure base prices (MRC ₹601, Silver ₹6,001, Gold ₹24,000, etc.), milestone increments, sale toggles (`gold_on_sale`, `diamond_on_sale`), GSTIN, SAC Code, and Community URL.
   - **Subtab Manual Grants**: Manually provision access to any email for any tier without charging.
   - **Subtab Bulk Upload**: CSV importer for migrating existing members.
   - **Subtab Discounts**: Create and manage coupons (Fixed ₹ discount or Percentage %, max uses, expiry date, tier restrictions).
   - **Subtab Referrals**: Manage affiliate/referral partners (track clicks, conversions, commission earned).
   - **Subtab Completion Templates**: In-browser code editor to customize HTML templates for all 6 completion slugs with live preview, token inspection, and version rollback.
   - **Subtab Reconciliation**: Daily automated reconciliation comparing Razorpay API captured payments against database orders, flagging orphan payments or amount mismatches.

3. **Tab 3: Communications Hub (`CommunicationsPanel`)**:
   - **Subtab Registry**: Manage all Email and WhatsApp template copies, mustache variables, and active toggles.
   - **Subtab Scheduled Queue**: View all queued, pending, sent, and cancelled messages across sequences.
   - **Subtab Attendance Uploader**: CSV upload for post-webinar attendance files; automatically tags attendees as `attended` or `no-show` and dispatches appropriate follow-ups.
   - **Subtab Settings**: Toggle `messaging_test_mode` (when TRUE, all outbound messages redirect to admin test email & phone).
   - **Subtab Email Delivery**: Real-time status logs for Resend emails (sent, delivered, opened, clicked, bounced).
   - **Subtab WhatsApp Stats**: Meta template sync status, delivery metrics (sent, delivered, read, clicked).
   - **Subtab Live WhatsApp Inbox (`WhatsAppInboxPanel`)**: Two-way interactive messaging console displaying live chat threads with leads; supports direct manual replies, message deletion, and simulated inbound testing.

4. **Tab 4: Leads CRM**:
   - Real-time registrations table with date range filtering (Today, Yesterday, 7d, 30d, 90d, All).
   - Search across name, email, phone, and tags.
   - In-line editing modal: update name, email, phone, session date, WhatsApp consent, or status.
   - Bulk actions: Tag leads (`purchased`, `hot`, `attended`, `no-show`, etc.), export to CSV, or delete leads.
   - One-click individual test email dispatch.

5. **Tab 5: Email Automation Sequence**:
   - Visual toggle and delay editor for the 6 masterclass nurture drip steps:
     - Step 0: Instant Confirmation (Immediate)
     - Step 1: 24h Before Reminder
     - Step 2: 2h Before Room Notice
     - Step 3: 15m Before Starting Alert
     - Step 4: Live Now Alert
     - Step 5: Post-Session Followup
   - Delay adjustment and test dispatch triggers.

6. **Tab 6: Email Copy (Template Editor)**:
   - Full WYSIWYG/Markdown editor for all masterclass nurture emails.

7. **Tab 7: Delivery Health**:
   - Automated DNS & domain health auditor checking SPF, DKIM, DMARC, and MX records for `onepageplan.in`.
   - 1-click Resend webhook synchronization.

8. **Tab 8: Webinar Logs**:
   - Raw database audit trail of all webhook requests from webinar.gg.

---

## 4. Messaging & Marketing Automation Engine

### Quiet Hours Marketing Window Enforcement
All promotional and reminder messages strictly obey **TRAI / Indian Quiet Hours (9:00 AM to 8:00 PM IST / 03:30 to 14:30 UTC)**:
- *Algorithm:*
  ```typescript
  export function enforceMarketingWindow(scheduledDate: Date): Date {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(scheduledDate.getTime() + istOffset);
    const hourIST = istTime.getUTCHours();

    if (hourIST >= 9 && hourIST < 20) return scheduledDate;

    const adjusted = new Date(scheduledDate.getTime());
    if (hourIST >= 20) adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setUTCHours(3, 30, 0, 0); // 9:00 AM IST
    return adjusted;
  }
  ```
- *Rule:* Transactional order receipts and login details dispatch immediately regardless of time. Marketing reminders scheduled outside 9 AM - 8 PM IST automatically roll over to 9:00 AM IST the next day.

### MRC 6-Stage Upgrade Sequence (Dispatched at 11:00 AM IST)
Triggered upon purchasing Money Reality Check:
1. **Day 15**: 15 days remaining in locked credit window (`mrc_upgrade_reminder_day15`)
2. **Day 23**: 7 days remaining (`mrc_upgrade_reminder_day23_7d`)
3. **Day 25**: 5 days remaining (`mrc_upgrade_reminder_day25_5d`)
4. **Day 26**: 4 days remaining (`mrc_upgrade_reminder_day26_4d`)
5. **Day 28**: 2 days remaining (`mrc_upgrade_reminder_day28_2d`)
6. **Day 29**: 24 hours remaining — Final Notice (`mrc_upgrade_reminder_day29_24h`)
- **Automatic Cancellation Rule**: If the member upgrades to Silver or requests a refund at any time, all remaining scheduled messages in this sequence are immediately cancelled (`status: 'cancelled', skip_reason: 'refund_or_upgrade_cancelled'`).

### Gold Completer 4-Stage Reminder Sequence
Triggered when a Silver member completes the curriculum before deadline:
1. **Immediate (+5 mins)**: Congratulations & unlock intimation (`gold_completer_eligible_initial`)
2. **5 Days Before Deadline**: 5-day warning (`gold_completer_reminder_5d`)
3. **2 Days Before Deadline**: 48-hour warning (`gold_completer_reminder_2d`)
4. **1 Day Before Deadline**: Final 24-hour warning (`gold_completer_reminder_24h`)

### Payment Failure 1-Time Intimation
- Triggered on abandoned or failed checkout attempts.
- **Strict Deduplication**: Exactly 1 email and 1 WhatsApp message per product per user within a 24-hour window.
- Includes a direct 1-click checkout resumption URL.

### Unsubscribe & WhatsApp Opt-Out Compliance
- **Email**: Every outbound marketing email includes a mandatory footer with a 1-click unsubscribe link: `GET /api/public/unsubscribe?email=...`. Calling this immediately logs a record in `communication_suppressions` and cancels all pending marketing messages.
- **WhatsApp**: Any incoming inbound message with keywords **`STOP`**, **`UNSUBSCRIBE`**, or **`CANCEL`** automatically revokes WhatsApp consent on the registration record and creates an entry in `communication_suppressions` with channel `whatsapp`.

---

## 5. Third-Party Integrations & Webhook Ingestion Engine

### 1. Razorpay Payment Gateway
- **Checkout Type**: Standard Razorpay modal integration (`checkout.js`).
- **Endpoint**: `POST /api/public/razorpay-webhook`
- **Security**: Verifies `x-razorpay-signature` header using `HMAC-SHA256` salted with `RAZORPAY_WEBHOOK_SECRET`.
- **Supported Events**:
  - `payment.captured` / `order.paid`: Verifies order amount in paise against DB order. Invokes Supabase RPC `grant_entitlement_on_capture`, creates sequential FY invoice, issues access grant, queues confirmation email & WhatsApp, schedules upgrade drip.
  - `payment.failed`: Records failure, triggers 1-time failed payment recovery email & WhatsApp intimation.
  - `refund.processed`: Flips order to `refunded`, revokes active entitlements in `member_access_grants`, cancels pending scheduled reminders.
- **Idempotency**: Webhook verifies whether `orders.status === 'captured'` prior to processing; duplicate deliveries return `200 OK` immediately without repeating actions.

### 2. Direct Meta WhatsApp Cloud API (v21.0)
- **Endpoint**: `GET /api/public/whatsapp-webhook` & `POST /api/public/whatsapp-webhook` (also aliased at `/api/public/hooks/whatsapp-webhook`).
- **Handshake (GET)**: Responds to Meta verification challenge matching `WHATSAPP_VERIFY_TOKEN`.
- **Status Updates (POST)**: Ingests real-time statuses (`sent`, `delivered`, `read`, `failed`) and updates `whatsapp_sends` table via RPC `record_whatsapp_event`.
- **Inbound 2-Way Chat (POST)**: Ingests incoming customer messages (text, quick replies, images, voice notes), matches sender by phone to `registrations`, logs into `whatsapp_inbound_messages`, and displays in admin live chat console. Detects `STOP` keywords for instant opt-out.

### 3. Zoho ZeptoMail & Resend
- **Primary Transactional Provider**: Exclusively powered by **Resend** (with Zoho ZeptoMail fallback support).
- **Endpoints**:
  - `POST /api/public/resend-webhook`: Ingests email delivery events (`delivered`, `opened`, `clicked`, `bounced`).
  - `POST /api/public/zeptomail-webhook`: Supports ZeptoMail event payloads.
- **Scheduled Dispatcher**: `GET /api/public/email-dispatch` or `POST /api/public/email-dispatch`
  - Authenticated via `x-cron-secret: CRON_SHARED_SECRET`.
  - Cron frequency: Every 10 minutes.
  - Queries `scheduled_messages` where `status = 'pending'` and `scheduled_for <= now()`.
  - Dispatches up to 25 messages per batch and records delivery timestamps.

### 4. Webinar.gg Integration
- **Endpoints**:
  - `POST /api/get-webinar-token`: Generates secure viewer JWT.
  - `GET /api/get-webinar-metrics`: Returns live session statistics.
  - `POST /api/public/webinar-webhook`: Ingests live event stream (`user.joined`, `user.left`, `webinar.started`, `webinar.ended`).
  - Logs every raw event into `webinar_webhook_logs` table.

### 5. OpenAI / ChatGPT Ads Conversion Tracking
- **Web Pixel**: Initialized in `src/routes/__root.tsx` with Pixel ID `LCLQYPUtFAeHU1BCs5buMR`.
- **Server Conversion API**: Endpoint `/api/public/chatgpt-conversion` dispatches server-to-server event `registration_completed` when an attendee registers on `/`.

---

## 6. Master UAT Test Environment Configuration

| Variable Key | Test / Staging Value | Purpose |
| :--- | :--- | :--- |
| `ADMIN_PASSWORD` | `MilanTest2026!` *(or your configured password)* | Master admin unlock for `/admin` |
| `VITE_SITE_URL` | `http://localhost:3000` or staging domain | Application base URL |
| `RAZORPAY_KEY_ID` | `rzp_test_YourTestKeyHere` | Public test key for checkout modal |
| `RAZORPAY_KEY_SECRET` | `YourTestSecretHere` | Private server secret for order signing |
| `RAZORPAY_WEBHOOK_SECRET` | `opp_rzp_test_webhook_secret` | Webhook verification secret |
| `WHATSAPP_ENABLED` | `true` | Enables WhatsApp delivery engine |
| `WHATSAPP_PHONE_NUMBER_ID` | `105938472910485` *(Test ID)* | Meta test phone ID |
| `WHATSAPP_ACCESS_TOKEN` | `EAAG...` | Meta Graph API permanent system token |
| `WHATSAPP_VERIFY_TOKEN` | `opp_whatsapp_verify_token` | Meta webhook handshake token |
| `COMMERCE_SIGNING_SECRET` | `onepageplan_completion_token_secret_salt_2026` | Token signing salt for HMAC verification |
| `CRON_SHARED_SECRET` | `test_cron_secret_opp_2026` | Shared secret for `/api/public/email-dispatch` |
| `COURSE_ADMIN_EMAILS` | `dodhia.milan@gmail.com,testadmin@onepageplan.in` | Unrestricted course access bypass |

---

## 7. Master Test Personas & Contact Test Data Sets

| Persona ID | Full Name | Email Address | Mobile Number (E.164) | Assigned Test Scenario |
| :--- | :--- | :--- | :--- | :--- |
| **P-01** | **Aarav Mehta** | `aarav.uat.masterclass@onepageplan.test` | `+919820011111` | Free Masterclass Registration & Webinar Join |
| **P-02** | **Priya Sharma** | `priya.uat.mrc@onepageplan.test` | `+919820022222` | Money Reality Check (₹601) Purchase & Invoice |
| **P-03** | **Rohan Gupta** | `rohan.uat.upgrade@onepageplan.test` | `+919820033333` | Day 20 Silver Upgrade (₹5,401) with Reminder Cancellation |
| **P-04** | **Sneha Patel** | `sneha.uat.expired@onepageplan.test` | `+919820044444` | Day 35 Silver Upgrade (Expired Credit -> Full ₹6,001) |
| **P-05** | **Vikram Malhotra** | `vikram.uat.silver@onepageplan.test` | `+919820055555` | Direct Silver Purchase & Bonus 1:1 Booking Link Claim |
| **P-06** | **Ananya Iyer** | `ananya.uat.completer@onepageplan.test` | `+919820066666` | Course Completion Proof Submission & Gold Upgrade (₹18,001) |
| **P-07** | **Kabir Khanna** | `kabir.uat.fail@onepageplan.test` | `+919820077777` | Payment Failure & 1-Time Recovery Intimation |
| **P-08** | **Neha Joshi** | `neha.uat.coupon@onepageplan.test` | `+919820088888` | Discount Coupon Validation & Tier Restriction |
| **P-09** | **Dev Verma** | `dev.uat.stop@onepageplan.test` | `+919820099999` | Inbound WhatsApp "STOP" & Email Unsubscribe |
| **P-10** | **Milan Admin** | `dodhia.milan@gmail.com` | `+919820000000` | Super Admin Full Course Bypass & Console Operations |

---

## 8. Simulated Payment, Webhook & Event Payloads

### A. Razorpay Test Payment Data
- **Card (Success)**: `4111 1111 1111 1111` | Any Expiry (e.g. `12/28`) | CVV: `123` | OTP: `123456`
- **Card (Failure / Decline)**: `4000 0000 0000 0002` | Any Expiry | CVV: `123`
- **UPI (Success)**: `success@razorpay`
- **UPI (Pending / Processing)**: `pending@razorpay`

### B. Razorpay Payment Captured Webhook Payload
```json
{
  "entity": "event",
  "account_id": "acc_mock123",
  "event": "payment.captured",
  "contains": ["payment"],
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_TEST_CAP_001",
        "order_id": "order_TEST_RZP_001",
        "amount": 60100,
        "currency": "INR",
        "status": "captured",
        "email": "priya.uat.mrc@onepageplan.test",
        "contact": "+919820022222",
        "notes": {
          "email": "priya.uat.mrc@onepageplan.test",
          "name": "Priya Sharma",
          "product": "money_reality_check"
        }
      }
    }
  }
}
```

### C. Meta WhatsApp Inbound Message Payload (Simulated "STOP")
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID_001",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "105938472910485" },
            "contacts": [{ "profile": { "name": "Dev Verma" }, "wa_id": "919820099999" }],
            "messages": [
              {
                "from": "919820099999",
                "id": "wamid.HBgLOTE5ODIwMDk5OTk5FQIAERgSMOCK_MSG_STOP_01",
                "timestamp": "1775730000",
                "text": { "body": "STOP" },
                "type": "text"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### D. Webinar.gg Attendee Joined Webhook Payload
```json
{
  "event": "user.joined",
  "webinar_id": "cmthk6y4001kos60ybxfkbc67",
  "timestamp": "2026-10-10T13:30:00.000Z",
  "data": {
    "user_id": "usr_webinar_001",
    "email": "aarav.uat.masterclass@onepageplan.test",
    "name": "Aarav Mehta",
    "role": "attendee"
  }
}
```

### E. Resend Webhook Email Delivered Payload
```json
{
  "type": "email.delivered",
  "created_at": "2026-10-10T13:31:00.000Z",
  "data": {
    "email_id": "resend_msg_001",
    "from": "Milan Dodhia <connect@onepageplan.in>",
    "to": ["aarav.uat.masterclass@onepageplan.test"],
    "subject": "Your seat is confirmed for Saturday"
  }
}
```

---

## 9. Comprehensive End-to-End UAT Test Scenarios (TC-01 to TC-25)

### Group 1: Registration, Room & Webinar Experience

#### TC-01: Free Masterclass Registration Flow & Validation
- **Objective**: Verify attendee can register from homepage with mobile auto-sanitization.
- **Steps**:
  1. Open homepage `GET /`.
  2. Click *"Reserve Your Free Seat"* to open modal.
  3. Enter Name: `Aarav Mehta`.
  4. Enter Email: `aarav.uat.masterclass@onepageplan.test`.
  5. Enter Phone with leading zero: `09820011111` (or paste `+9109820011111`).
  6. Submit form.
- **Expected Results**:
  - Input field automatically normalizes phone to `+919820011111`.
  - Record created in `registrations` with status `registered`.
  - Browser redirects to `/confirmed`.
  - Meta Pixel `CompleteRegistration` and ChatGPT `registration_completed` fire exactly once.

#### TC-02: Confirmed Page Calendar & Question Submission
- **Objective**: Verify `/confirmed` page functions properly without crashing.
- **Steps**:
  1. On `/confirmed`, verify upcoming Saturday date is displayed.
  2. Click *"Add to Google Calendar"* button -> verify calendar event link opens with session details.
  3. In *"Have a specific question for Milan?"*, type: *"How do I evaluate ULIP surrender value?"* and click Submit.
- **Expected Results**:
  - Question submits smoothly with confirmation toast.
  - In database `registrations`, column `unanswered_question` updates to the submitted text.

#### TC-03: Webinar Room Authorization & Token Generation
- **Objective**: Verify `/room` route grants entry to registered attendees and blocks unregistered visitors.
- **Steps**:
  1. Open `/room?email=unregistered@onepageplan.test`.
  2. Verify page shows *"Email not found"* prompt with a link to register.
  3. Enter registered email: `aarav.uat.masterclass@onepageplan.test` and click *"Join Room"*.
- **Expected Results**:
  - System invokes `/api/get-webinar-token`.
  - Status transitions to `player`.
  - Responsive Webinar.gg iframe embeds smoothly without CORS errors.

#### TC-04: Webinar Attendance Webhook Ingestion
- **Objective**: Verify live join/leave events update the database.
- **Steps**:
  1. Post simulated `user.joined` webhook payload (Payload D) to `/api/public/webinar-webhook`.
  2. Inspect `/admin` Webinar Analytics tab.
- **Expected Results**:
  - HTTP response `200 OK`.
  - Entry logged in `webinar_webhook_logs`.
  - Attendee marked as `attended` in analytics terminal.

---

### Group 2: Money Reality Check (MRC) & Upgrade Credit Engine

#### TC-05: Money Reality Check Purchase at ₹601
- **Objective**: Verify purchasing MRC charges exact ₹601 and grants correct entitlements.
- **Steps**:
  1. Navigate to `/checkout/money-reality-check`.
  2. Fill Persona P-02 details (`Priya Sharma`, `priya.uat.mrc@onepageplan.test`, `+919820022222`).
  3. Accept terms, keep WhatsApp consent enabled, click Pay.
  4. Complete payment using Razorpay test card.
- **Expected Results**:
  - Razorpay order created for exactly 60,100 paise (₹601).
  - Webhook captures payment.
  - Redirects to `/complete/money-reality-check?order_id=...&token=...`.
  - Database reflects:
    - Order record with `amount_charged = 601`, `status = 'captured'`.
    - `member_access_grants` has `access_tier = 'money_reality_check'`, `expires_at` null.
    - `invoices` contains sequential receipt (e.g. `RCPT-2026-27/0001`).

#### TC-06: MRC 6-Stage Reminder Scheduling & Quiet Hours
- **Objective**: Verify that purchasing MRC schedules all 6 upgrade reminders at 11:00 AM IST.
- **Steps**:
  1. Query `scheduled_messages` for `priya.uat.mrc@onepageplan.test`.
- **Expected Results**:
  - Exactly 6 marketing messages queued for Days 15, 23, 25, 26, 28, and 29.
  - All timestamps set to 05:30:00 UTC (11:00 AM IST).
  - Context payload contains locked upgrade price `₹5,401` and upgrade link.

#### TC-07: Upgrade to Silver on Day 20 (₹601 Credit Applied)
- **Objective**: Verify MRC purchaser pays ₹5,401 during the 30-day window.
- **Steps**:
  1. Access `/upgrade/silver?email=rohan.uat.upgrade@onepageplan.test` (Persona P-03 with MRC purchased 20 days ago).
  2. Verify displayed pricing summary:
     - Base Silver: ₹6,001
     - Credit: -₹601
     - Total: **₹5,401**
  3. Click Pay and complete transaction.
- **Expected Results**:
  - Razorpay charges exactly 540,100 paise (₹5,401).
  - Redirects to `/complete/silver-upgrade?order_id=...&token=...`.
  - `member_access_grants` tier upgraded to `silver`.

#### TC-08: Automatic Cancellation of MRC Upgrade Reminders upon Upgrade
- **Objective**: Verify all pending MRC reminder messages cancel immediately once member upgrades.
- **Steps**:
  1. Inspect `scheduled_messages` for `rohan.uat.upgrade@onepageplan.test` after TC-07 completes.
- **Expected Results**:
  - All pending messages in `mrc_upgrade_sequence` have status updated to `cancelled`.
  - Column `skip_reason` set to `refund_or_upgrade_cancelled`.
  - No further MRC reminders are sent.

#### TC-09: Upgrade to Silver on Day 35 (Credit Expired)
- **Objective**: Verify MRC purchaser after 30 days is charged full current price.
- **Steps**:
  1. Access `/upgrade/silver?email=sneha.uat.expired@onepageplan.test` (Persona P-04 with MRC purchased 35 days ago).
- **Expected Results**:
  - Page displays alert: *"Your 30-day credit window has expired"*.
  - Price charged is full current Silver price (**₹6,001** or milestone price).
  - Credit applied is **₹0**.

---

### Group 3: Silver Tier, Milestones & Cohort Bonus

#### TC-10: Direct Silver Purchase & Cohort Assignment
- **Objective**: Verify direct Silver purchase allocates cohort and awards bonus if under limit.
- **Steps**:
  1. Open `/checkout/silver`.
  2. Fill Persona P-05 details (`Vikram Malhotra`).
  3. Pay ₹6,001 using test card.
- **Expected Results**:
  - Order captured for ₹6,001.
  - Active cohort member count increments by 1.
  - If member count <= 10: `has_bonus` is set to TRUE.
  - Completion page renders `{{#if bonus}}` block containing private 1:1 strategy booking link.

#### TC-11: Milestone Pricing Tier Escalation
- **Objective**: Verify milestone price increases when active Silver members reach threshold.
- **Steps**:
  1. In Supabase, update `orders` so active unrefunded Silver orders count reaches 100.
  2. Refresh `/checkout/silver`.
- **Expected Results**:
  - Server recalculates base price to **₹7,001**.
  - Checkout page displays: *"Tier 2 Active (100+ Members) — ₹7,001"*.
  - Razorpay checkout initializes at 700,100 paise.

---

### Group 4: Course Completion & Gold Upgrade

#### TC-12: Member Portal Tier-Gated Access
- **Objective**: Verify member portal unlocks modules strictly according to purchased tier.
- **Steps**:
  1. Open `/course?email=priya.uat.mrc@onepageplan.test` (MRC Member) -> verify only MRC modules are unlocked; Silver modules show locked padlock.
  2. Open `/course?email=vikram.uat.silver@onepageplan.test` (Silver Member) -> verify all Calm Money System modules unlocked.
  3. Open `/course?email=dodhia.milan@gmail.com` (Admin Bypass) -> verify 100% of modules unlocked across all tiers.
- **Expected Results**:
  - Content unlocks and locks strictly match active tier grants.

#### TC-13: Course Completion Proof Submission
- **Objective**: Verify member can submit completion proof and unlock ₹18,001 Gold rate.
- **Steps**:
  1. Open `/course/complete?email=ananya.uat.completer@onepageplan.test`.
  2. Submit form with worksheet URL: `https://docs.google.com/spreadsheets/d/test12345`.
- **Expected Results**:
  - Record created in `course_completions` with status `submitted`.
  - Submission deadline set to 7 days from submission.
  - Success banner displays unlocked Gold completer rate: **₹18,001**.

#### TC-14: Gold Completer Upgrade Purchase (₹18,001)
- **Objective**: Verify completer can purchase Gold at ₹18,001 before deadline.
- **Steps**:
  1. Open `/upgrade/gold?email=ananya.uat.completer@onepageplan.test`.
  2. Verify price is **₹18,001** (instead of standard ₹24,000).
  3. Complete payment.
- **Expected Results**:
  - Order captured for exactly 1,800,100 paise.
  - Tier upgraded to `gold` in `member_access_grants`.

---

### Group 5: Gold, Diamond & Sale Toggles

#### TC-15: Off-Sale Gating for Gold & Diamond
- **Objective**: Verify Gold and Diamond cannot be purchased when toggled off.
- **Steps**:
  1. In `/admin` Commerce Settings, toggle `gold_on_sale` to OFF.
  2. Visit `/checkout/gold`.
- **Expected Results**:
  - Page displays *"Currently Closed — By Application Only"*.
  - Payment button is disabled or hidden.
  - Attempting direct POST to `/api/commerce/create-order` returns HTTP 400.

#### TC-16: Diamond Annual Renewal Flow
- **Objective**: Verify Diamond renewal adds 365 days to existing expiry date.
- **Steps**:
  1. Call checkout for product `diamond_renewal` for an existing Diamond member.
- **Expected Results**:
  - Expiration date in `member_access_grants` extends by exactly 1 year from previous expiry.

---

### Group 6: Payment Failure, Coupons & Tamper Resistance

#### TC-17: Payment Failure & 1-Time Recovery Intimation
- **Objective**: Verify failed payment creates 1 intimation and deduplicates subsequent failures.
- **Steps**:
  1. At `/checkout/silver`, enter Persona P-07 details (`Kabir Khanna`).
  2. Attempt payment using Razorpay failure card `4000 0000 0000 0002`.
  3. Modal triggers failure; user lands on `/payment/failed`.
  4. Check `scheduled_messages` for Kabir.
  5. Attempt second failed checkout within 5 minutes.
- **Expected Results**:
  - Exactly 1 intimation email and WhatsApp message queued with resume link.
  - Second failure triggers deduplication check; no second message is created.

#### TC-18: Coupon Code Validation & Product Restriction
- **Objective**: Verify coupon codes validate discount value and reject wrong products.
- **Steps**:
  1. In `/admin`, create coupon `SILVER500` (Fixed ₹500 off, applicable only to `silver`).
  2. At `/checkout/money-reality-check`, enter `SILVER500` and click Apply.
  3. At `/checkout/silver`, enter `SILVER500` and click Apply.
- **Expected Results**:
  - On MRC: Error displayed: *"Coupon not applicable to this product"*.
  - On Silver: Coupon accepts, price decreases from ₹6,001 to ₹5,501.

#### TC-19: Browser Price Tampering Resistance
- **Objective**: Verify altering the price payload on the client cannot change charged amount.
- **Steps**:
  1. In browser DevTools console or Postman, send POST to `/api/commerce/create-order` with payload:
     `{ "product": "silver", "email": "hacker@test.com", "amount": 100 }`.
- **Expected Results**:
  - Server ignores client amount parameter.
  - Razorpay order created for server-computed price (600,100 paise / ₹6,001).

#### TC-20: Completion Page HMAC Token Forgery Resistance
- **Objective**: Verify `/complete/[slug]` rejects fake order IDs or forged tokens.
- **Steps**:
  1. Open `/complete/silver?order_id=fake-order-id-1234&token=invalid_hmac_hash`.
- **Expected Results**:
  - Server returns `401 Unauthorized`.
  - No access details or tokens are revealed.

---

### Group 7: Compliance, Unsubscribe & Two-Way WhatsApp

#### TC-21: One-Click Email Unsubscribe Flow
- **Objective**: Verify marketing email unsubscribe suppresses future emails.
- **Steps**:
  1. Open `GET /api/public/unsubscribe?email=dev.uat.stop@onepageplan.test`.
- **Expected Results**:
  - Unsubscribe confirmation page displays.
  - Entry inserted into `communication_suppressions` (`channel = 'email'`).
  - Pending marketing messages for this email set to `cancelled`.

#### TC-22: Inbound WhatsApp "STOP" Keyword Opt-Out
- **Objective**: Verify WhatsApp user replying STOP is suppressed immediately.
- **Steps**:
  1. Send simulated Meta WhatsApp webhook POST with body text `STOP` from `+919820099999` (Payload C).
- **Expected Results**:
  - Webhook returns `200 OK`.
  - `communication_suppressions` contains phone `919820099999` (`channel = 'whatsapp'`).
  - `registrations.whatsapp_consent` flipped to FALSE.

#### TC-23: Two-Way Live WhatsApp Admin Chat Reply
- **Objective**: Verify admin can read incoming messages and reply directly from `/admin`.
- **Steps**:
  1. In `/admin` Communications Hub -> WhatsApp Inbox, locate conversation with `+919820099999`.
  2. Type reply: *"Hi Dev, your masterclass seat is confirmed."* and click Send.
- **Expected Results**:
  - Meta Graph API dispatches outgoing message.
  - Message bubble renders in live chat stream.

---

### Group 8: Invoicing, Refunds & Admin Operations

#### TC-24: Tax Invoice Sequential Numbering & GST Verification
- **Objective**: Verify generated invoice contains valid FY number, GSTIN, and formatting.
- **Steps**:
  1. Navigate to `/api/invoices/[download_token]` for a captured order.
  2. Inspect rendered HTML.
- **Expected Results**:
  - Format conforms to `INV-2026-27/0001` or `RCPT-2026-27/0001`.
  - Shows `Manrrs Wellness LLP`, SAC code `999293`, customer name, and itemized total.

#### TC-25: 1-Click Razorpay Refund & Entitlement Revocation
- **Objective**: Verify refunding an order revokes entitlements and cancels drip reminders.
- **Steps**:
  1. In `/admin` Commerce Panel -> Orders, find captured order.
  2. Click *"Process Refund"*.
- **Expected Results**:
  - Razorpay processes refund.
  - Order status updates to `refunded`.
  - `member_access_grants.status` updates to `revoked`.
  - Pending drip reminders cancelled.

---

## 10. Verification & Acceptance Sign-off Matrix

| Test Suite | Scenario Count | Responsible Role | Pass Criteria | Status |
| :--- | :---: | :--- | :--- | :---: |
| **1. Registration & Room** | 4 (TC-01 - TC-04) | QA / Frontend | Form normalizes phone, pixel fires once, room embeds securely | [ ] PASS |
| **2. MRC & Upgrades** | 5 (TC-05 - TC-09) | QA / Payments | ₹601 charged, 6 reminders scheduled, ₹5,401 upgrade works, cancel on upgrade | [ ] PASS |
| **3. Silver & Milestones** | 2 (TC-10 - TC-11) | QA / Backend | Milestone price increases, cohort bonus awarded to first 10 | [ ] PASS |
| **4. Course & Completers** | 3 (TC-12 - TC-14) | QA / Product | Tier locking enforced, proof submitted, Gold completer at ₹18,001 | [ ] PASS |
| **5. Gold & Diamond** | 2 (TC-15 - TC-16) | QA / Commerce | Off-sale blocks checkouts, Diamond renewal adds 365 days | [ ] PASS |
| **6. Security & Tamper** | 4 (TC-17 - TC-20) | Security Engineer | Rate limits hold, HMAC token verified, price tampering impossible | [ ] PASS |
| **7. Compliance & Chat** | 3 (TC-21 - TC-23) | QA / Operations | Unsubscribe works, STOP suppresses WhatsApp, 2-way chat functional | [ ] PASS |
| **8. Invoices & Admin** | 2 (TC-24 - TC-25) | Finance / Lead QA | FY sequential numbering correct, 1-click refund revokes access | [ ] PASS |
| **TOTAL** | **25 Scenarios** | **Sign-off Lead** | **100% Pass Rate across all 25 test cases** | **[ ] READY FOR UAT** |

---
*Document Version: 2.0.0 (Production Release)*  
*Maintained by: Antigravity AI Engineering Team & Milan Dodhia*  
*Project Repository: `c:\Projects\One-page-plan-landing-page\plan-one-page`*
