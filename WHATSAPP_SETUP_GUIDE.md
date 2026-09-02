# Complete WhatsApp Alerts Setup Guide (AiSensy Integration)

This guide provides step-by-step instructions for activating live WhatsApp registration confirmations and reminder alerts on **onepageplan.in** via **AiSensy** (WhatsApp Business API).

---

## Table of Contents
1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step 1: AiSensy & Meta Business Setup](#step-1-aisensy--meta-business-setup)
4. [Step 2: Message Template Approval](#step-2-message-template-approval)
5. [Step 3: Creating the AiSensy Campaign](#step-3-creating-the-aisensy-campaign)
6. [Step 4: Environment Variables Configuration](#step-4-environment-variables-configuration)
7. [Step 5: How the Code Handles Delivery](#step-5-how-the-code-handles-delivery)
8. [Step 6: Testing & Verification](#step-6-testing--verification)
9. [Step 7: Monitoring in Admin Dashboard](#step-7-monitoring-in-admin-dashboard)
10. [Troubleshooting & Common Pitfalls](#troubleshooting--common-pitfalls)

---

## 1. Overview

When attendees fill in the registration popup on **onepageplan.in** and leave the **"Send reminder on WhatsApp"** checkbox checked, the backend automatically dispatches a WhatsApp message containing their name and join link.

- **Current State**: `WHATSAPP_ENABLED` is set to `false` by default. When disabled, the server safely logs what would have been sent without throwing errors or delaying registration.
- **Active State**: Once your AiSensy account and templates are approved by Meta, changing `WHATSAPP_ENABLED` to `true` instantly starts sending real WhatsApp messages.

---

## 2. Prerequisites

Before starting, ensure you have:
- An active **AiSensy** account (<https://backend.aisensy.com>).
- Access to your **Meta Business Manager** (to complete Facebook Business Verification).
- A dedicated phone number (mobile or landline) that is **not** currently active on any personal or business WhatsApp app.
- Admin access to your Vercel deployment for **onepageplan.in**.

---

## 3. Step 1: AiSensy & Meta Business Setup

1. **Sign Up on AiSensy**:
   - Go to [AiSensy Signup](https://backend.aisensy.com/signup) and create an account.
2. **Connect Meta Business Manager**:
   - In the AiSensy dashboard, navigate to **Manage** -> **Facebook Business Manager**.
   - Click **Connect Facebook Account** and log in with your Meta Admin credentials.
3. **Verify Phone Number**:
   - Enter your dedicated phone number. You will receive an OTP via SMS or Voice Call to verify ownership.
4. **Complete Business Verification**:
   - Submit your business legal documents (e.g. GST Registration or Partnership Deed for **Mannrs Wellness LLP**).
   - Approval by Meta typically takes between 1 and 24 hours.

---

## 4. Step 2: Message Template Approval

WhatsApp requires all business-initiated messages (API messages) to use pre-approved templates.

1. Navigate to **Manage** -> **Template Messages** in AiSensy.
2. Click **+ New Template**.
3. Fill in the Template Details:
   - **Template Name**: `masterclass_confirmation` (or your preferred name, matching your campaign).
   - **Category**: `UTILITY`
   - **Language**: `English`
   - **Header**: None or Text (e.g., "The One Page Plan")
   - **Body Text**:
     ```text
     Hello {{1}},

     Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST.

     Here is your link to join the live session:
     {{2}}

     Before Saturday, please sit somewhere quiet with a pen and paper.

     See you in the room!
     Milan Dodhia
     Financial Educator, Milanaire
     ```
   - **Sample Values**:
     - `{{1}}`: `Milan`
     - `{{2}}`: `https://www.onepageplan.in/room`
4. Click **Submit for Approval**. Approval usually takes 5 to 30 minutes.

---

## 5. Step 3: Creating the AiSensy Campaign

Once your template status changes to **Approved**:

1. Go to **Campaigns** -> **Create Campaign**.
2. Select **API Campaign**.
3. Set **Campaign Name**: `masterclass_confirmation` (or your chosen campaign identifier).
4. Select the approved Template (`masterclass_confirmation`).
5. Map the template variables:
   - `Param 1` -> First Name (`firstName`)
   - `Param 2` -> Room / Webinar URL (`webinarUrl`)
6. Click **Save Campaign**.
7. Navigate to **Manage** -> **API Key** in the left sidebar and copy your **AiSensy API Key**.

---

## 6. Step 4: Environment Variables Configuration

Log in to your **Vercel Dashboard** (<https://vercel.com>), select the `onepageplan` project, and navigate to **Settings** -> **Environment Variables**.

Add or update the following environment variables:

| Variable Name | Production Value | Description |
| :--- | :--- | :--- |
| `WHATSAPP_ENABLED` | `true` | Enables real HTTP requests to AiSensy. Change from `false` to `true`. |
| `AISENSY_API_KEY` | `your_aisensy_api_key_here` | Your secret API Key from AiSensy Dashboard. |
| `AISENSY_CAMPAIGN_NAME` | `masterclass_confirmation` | The exact API Campaign Name created in AiSensy. |
| `VITE_WEBINAR_URL` | `https://www.onepageplan.in/room` | The link passed as `Param 2` to the WhatsApp template. |

> [!IMPORTANT]
> After updating environment variables in Vercel, you **must trigger a new deployment** (Go to **Deployments** -> **Redeploy**) for Vercel serverless functions to pick up the new variables.

For local development (`.env` file):
```env
WHATSAPP_ENABLED=true
AISENSY_API_KEY=your_aisensy_api_key_here
AISENSY_CAMPAIGN_NAME=masterclass_confirmation
VITE_WEBINAR_URL=https://www.onepageplan.in/room
```

---

## 7. Step 5: How the Code Handles Delivery

The backend logic in [`src/lib/registration.server.ts`](file:///c:/Projects/One-page-plan-landing-page/plan-one-page/src/lib/registration.server.ts#L208) performs the following steps:

1. Checks if `whatsapp_consent` is `true` and phone number has 10 valid digits.
2. Converts the 10-digit number to E.164 format: `+91XXXXXXXXXX`.
3. Checks `process.env.WHATSAPP_ENABLED`.
   - If `false`: Logs `"whatsapp disabled, would have sent: ..."` to server console.
   - If `true`: Performs `POST https://backend.aisensy.com/campaign/t1/api/v2` with payload:
     ```json
     {
       "apiKey": "AISENSY_API_KEY",
       "campaignName": "AISENSY_CAMPAIGN_NAME",
       "destination": "+919820411223",
       "userName": "Attendee Full Name",
       "templateParams": ["Firstname", "https://www.onepageplan.in/room"]
     }
     ```
4. Records the delivery outcome (`true` or `false` with error reason) in the database using the `mark_registration_delivery` RPC.

---

## 8. Step 6: Testing & Verification

1. Open `https://www.onepageplan.in` in your browser.
2. Click **Save my seat for this Saturday**.
3. Fill in the form:
   - Full Name: `Test User`
   - Email: your test email address
   - Phone: valid 10-digit Indian mobile number (e.g. `9820411223`)
   - Ensure **"Send reminder on WhatsApp"** is checked.
4. Submit the form.
5. Check your phone — you should receive the WhatsApp message within 5-10 seconds.

---

## 9. Step 7: Monitoring in Admin Dashboard

Log in to your Admin Dashboard at `https://www.onepageplan.in/admin`:

1. Select **Communications** tab.
2. Switch to **WhatsApp (AiSensy)** view.
3. You will see live delivery statistics:
   - **Total Messages**
   - **Delivered Rate**
   - **Read Rate**
4. Check the data table for real-time recipient delivery status badges (`Sent`, `Delivered`, `Read`, `Failed`).

---

## Troubleshooting & Common Pitfalls

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **No message received** | `WHATSAPP_ENABLED` is set to `false` in Vercel | Set `WHATSAPP_ENABLED=true` in Vercel Environment Variables and redeploy. |
| **HTTP 400 from AiSensy** | `AISENSY_CAMPAIGN_NAME` or `AISENSY_API_KEY` mismatch | Double-check campaign name casing and API key in AiSensy Dashboard. |
| **Template Error** | Number of `templateParams` does not match template | Ensure your AiSensy template has exactly 2 variables (`{{1}}` and `{{2}}`). |
| **Phone Failed** | Number missing `+91` prefix | The server automatically adds `+91`. Ensure attendees enter 10 digits without leading 0. |
| **Consent Skipped** | User unchecked WhatsApp opt-in | The system respects visitor choices; messages are only sent when opt-in is checked. |
