<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project Instructions & Documentation Map

## Core Features & Workflow Integration
- **Webinar Integration (`webinar.gg`)**:
  - Live Room: `/room` route renders full-page iframe embed using token generator `/api/get-webinar-token`.
  - Metrics API: `/api/get-webinar-metrics` fetches live attendance & duration data.
  - Webhook Endpoint: `/api/public/webinar-webhook` receives live events (`user.joined`, `user.left`) and records attendance.
- **Admin Dashboard (`/admin`)**:
  - Tab A: **Webinar Analytics** (Live metrics & terminal activity feed).
  - Tab B: **Communications** (Email & WhatsApp campaign tracking).
  - Leads management, Email automation sequence editor, and deliverability tools.
- **Email Automation (Resend Only)**:
  - Exclusively powered by **Resend** (no ZeptoMail).
  - Environment flags: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (defaults to `connect@onepageplan.in`), `RESEND_FROM_NAME` (`Milan Dodhia`).
  - Sequence drips and transactional order invoices dispatched via `sendEmailViaResend` and automated scheduler.
- **WhatsApp Integration (Direct Meta Cloud API v21.0)**:
  - Connects directly to **Meta WhatsApp Cloud API** (no AiSensy / 3rd-party BSP).
  - Environment flags: `WHATSAPP_ENABLED` (`true` in production), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`.
  - Approved Meta message templates: `webinar_confirmation`, `webinar_reminder_2h`, `webinar_reminder_15m`, `webinar_live_now`, `webinar_missed`, `course_purchase_confirmat`, `3p_direct_integration_test`.
- **Contact Management & Sanitization**:
  - Full inline contact editing in `/admin` Leads tab (Full Name, Email, Phone, Status, Session Date, WhatsApp Consent).
  - Indian mobile sanitization: automatic stripping of extraneous leading zero (`+9109029...` -> `+919029...`) and country-code paste deduplication.
- **ChatGPT / OpenAI Ads Conversion Tracking**:
  - Web Pixel: Initialized in `src/routes/__root.tsx` with Pixel ID `LCLQYPUtFAeHU1BCs5buMR`.
  - Server-Side Conversion API: `src/lib/chatgpt-conversion.server.ts` and public endpoint `/api/public/chatgpt-conversion`.
  - Automatic dispatch: Fires `registration_completed` on successful attendee registration (`registerAttendee`).
  - Environment flags: `CHATGPT_CONVERSION_API_KEY` (in Vercel/production), `CHATGPT_PIXEL_ID` (defaults to `LCLQYPUtFAeHU1BCs5buMR`).

