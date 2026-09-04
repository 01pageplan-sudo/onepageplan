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
- **WhatsApp Integration (AiSensy)**:
  - Configuration details & step-by-step setup guide: see [`WHATSAPP_SETUP_GUIDE.md`](file:///c:/Projects/One-page-plan-landing-page/plan-one-page/WHATSAPP_SETUP_GUIDE.md).
  - Environment flags: `WHATSAPP_ENABLED` (`false` by default, `true` in production), `AISENSY_API_KEY`, `AISENSY_CAMPAIGN_NAME`.

