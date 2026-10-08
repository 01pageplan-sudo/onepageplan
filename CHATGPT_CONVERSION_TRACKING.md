# OpenAI / ChatGPT Ads Conversion Tracking — End-to-End Verification Report

## Executive Summary
An end-to-end live test was conducted on production (`https://www.onepageplan.in`) with a genuine attendee registration. Both the **Browser Pixel SDK** and the **Server-Side Conversions API (CAPI)** successfully transmitted the `registration_completed` conversion event to OpenAI's ingestion servers. Both channels transmitted identical event IDs for deduplication.

---

## 1. Test Environment & Deployment
- **Deployment Platform:** Vercel Production Environment
- **Domain:** `https://www.onepageplan.in`
- **Active Git Commit:** `aa8af4a` (branch `main`)
- **Pixel ID:** `LCLQYPUtFAeHU1BCs5buMR`
- **Event Name:** `registration_completed`
- **Data Shape:** `customer_action`

---

## 2. Lead Registration Confirmation
- **Status:** Saved to database (`yes`)
- **Generated Registration ID (UUID):** `3c81a3a3-d2f8-4e8a-88a3-f00a0014337d`
- **Confirmation Page:** Successfully reached `/confirmed` ("Your seat is saved")

---

## 3. Browser Pixel (Client-Side) Execution Evidence
Captured via Chrome DevTools Network Inspector on `https://www.onepageplan.in/confirmed`:

- **Request URL:** `https://bzr.openai.com/v1/sdk/events?pid=LCLQYPUtFAeHU1BCs5buMR&st=oaiq-web&sv=0.1.41&t=1791474276310&ec=1`
- **Request Method:** `POST`
- **Remote Gateway:** `[2606:4700:8d70:d8c2:ac39:7a37:5e9c:63]:443` (Cloudflare / OpenAI Edge)
- **HTTP Status Code:** **`202 Accepted`**
- **Browser Payload (Sanitized):**
  - **Event Name:** `registration_completed`
  - **Event ID:** `3c81a3a3-d2f8-4e8a-88a3-f00a0014337d`
  - **Metadata (`eventProps`):** `{"type": "customer_action"}`
  - **Browser Timestamp:** `1791474276310` (`2026-10-08T15:44:36.310Z`)

---

## 4. Server-Side Conversions API (CAPI) Execution Evidence
Captured via backend server function immediately upon lead insertion:

- **Endpoint:** `POST https://bzr.openai.com/v1/events?pid=LCLQYPUtFAeHU1BCs5buMR`
- **Authentication:** `Authorization: Bearer <REDACTED_API_KEY>` (Verified with `ads.third_party_events.write` scope)
- **Actual Server POST Payload:**
```json
{
  "validate_only": false,
  "events": [
    {
      "id": "3c81a3a3-d2f8-4e8a-88a3-f00a0014337d",
      "type": "registration_completed",
      "timestamp_ms": 1791474271919,
      "source_url": "https://onepageplan.in/",
      "action_source": "web",
      "data": {
        "type": "customer_action"
      }
    }
  ]
}
```
- **Server Timestamp:** `1791474271919` (`2026-10-08T15:44:31.919Z`) — fired 4.4 seconds before confirmation page load.

---

## 5. Raw Upstream OpenAI Ingestion Response
Captured directly from the upstream fetch response body (raw, untransformed):

- **HTTP Status:** **`200 OK`**
- **Response Body:**
```json
{
  "accepted_events": 1
}
```
- **Event-Level Errors:** None (0 rejected events).

---

## 6. Event ID Alignment & Deduplication Verification
- **Browser Event ID:** `3c81a3a3-d2f8-4e8a-88a3-f00a0014337d`
- **Server Event ID:** `3c81a3a3-d2f8-4e8a-88a3-f00a0014337d`
- **Match Status:** **Exact Match (`yes`)**
- **Deduplication:** Both the browser pixel (`202 Accepted`) and server Conversions API (`200 OK`, `accepted_events: 1`) shared the exact database UUID, allowing OpenAI Ads to deduplicate them into a single unique conversion.

---

## 7. Attribution (`oppref`) Status
- **Status:** Not applicable / unverified (Direct visit)
- **Observation:** Because this was a manual direct visit to the website rather than an OpenAI sponsored ad click, no `oppref` parameter was present in the URL or cookies. The system correctly omitted `oppref` without fabricating any synthetic click reference (`oppref_present: false`).

---

## 8. Verification Summary Table

| Metric / Check | Value / Result | Status |
| :--- | :--- | :--- |
| **Pixel ID** | `LCLQYPUtFAeHU1BCs5buMR` | Verified |
| **Event Name** | `registration_completed` | Verified |
| **Data Shape** | `{"type": "customer_action"}` | Verified |
| **Browser SDK Status** | HTTP `202 Accepted` | Ingested |
| **Server CAPI Status** | HTTP `200 OK` (`accepted_events: 1`) | Ingested |
| **Deduplication** | `3c81a3a3-d2f8-4e8a-88a3-f00a0014337d` | Aligned (1:1 match) |
| **API Key Scope** | `ads.third_party_events.write` | Validated |
| **Attribution Handling** | `oppref` auto-capture enabled; omitted on direct visit | Verified |
