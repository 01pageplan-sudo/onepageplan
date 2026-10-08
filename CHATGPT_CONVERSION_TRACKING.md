# OpenAI / ChatGPT Ads Conversion Tracking Verification Report

## 1. Architecture Overview
- **Deployment Platform:** Web application hosted on Vercel (`https://www.onepageplan.in`).
- **Implementation Type:** Dual Tracking (Browser Pixel SDK + Server-Side Conversions API) with event deduplication.
- **Pixel ID:** `LCLQYPUtFAeHU1BCs5buMR`
- **Conversion Event:** `registration_completed`
- **Data Shape:** `customer_action`
- **Deduplication Strategy:** Shared `event_id` (Registration UUID) between browser and server calls.

---

## 2. Browser Pixel (Client-Side) Implementation

### A. Base Pixel Initialization (`<head>`)
**File:** `src/routes/__root.tsx`
```html
<script>
  !function(w,d,s,u){
    if(w.oaiq) return;
    var q = function(){ q.q.push(arguments) };
    q.q = [];
    w.oaiq = q;
    var j = d.createElement(s);
    j.async = 1;
    j.src = u;
    var f = d.getElementsByTagName(s)[0];
    f.parentNode.insertBefore(j,f);
  }(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");

  oaiq("init", { pixelId: "LCLQYPUtFAeHU1BCs5buMR", debug: true });
</script>
```

### B. Conversion Event on Registration Success (`/confirmed`)
**File:** `src/routes/confirmed.tsx`
Executed once per registration upon landing on the confirmation page:
```javascript
if (typeof window !== "undefined" && window.oaiq) {
  window.oaiq(
    "measure",
    "registration_completed",
    { type: "customer_action" }, // Required by oaiq SDK schema validator
    { event_id: registrationId }  // Shared with server for deduplication
  );
}
```

---

## 3. Server-Side Conversions API (CAPI) Implementation

### A. Backend Trigger on Lead Creation
**File:** `src/lib/registration.functions.ts`
When an attendee registers, the server handler persists the lead to the database and dispatches the conversion event:
```typescript
const siteUrl = (process.env["VITE_SITE_URL"] || "https://onepageplan.in").replace(/\/+$/, "");
const sourceUrl = `${siteUrl}${row.landing_path && row.landing_path.startsWith("/") ? row.landing_path : "/confirmed"}`;

await sendChatGPTRegistrationEvent({
  id: saved.id, // Registration UUID (matches browser event_id)
  source_url: sourceUrl,
  oppref: data.oppref, // Captured OpenAI click reference
});
```

### B. Attribution (`oppref`) Capture
**File:** `src/components/site/RegistrationModal.tsx`
Extracted from either the `oppref` URL parameter or the first-party `__oppref` cookie set by `oaiq.min.js`:
```typescript
let oppref = new URLSearchParams(window.location.search).get("oppref");
if (!oppref && typeof document !== "undefined" && document.cookie) {
  const match = document.cookie.match(/(?:^|;\s*)__oppref=([^;]+)/);
  if (match) oppref = decodeURIComponent(match[1]);
}
```

### C. Upstream OpenAI CAPI Payload & Endpoint
**File:** `src/lib/chatgpt-conversion.server.ts`
- **Endpoint:** `POST https://bzr.openai.com/v1/events?pid=LCLQYPUtFAeHU1BCs5buMR`
- **Headers:**
  - `Authorization: Bearer <CONFIGURED_API_KEY>` (Scope: `ads.third_party_events.write`)
  - `Content-Type: application/json`
- **Payload Schema:**
```json
{
  "validate_only": false,
  "events": [
    {
      "id": "<REGISTRATION_UUID>",
      "type": "registration_completed",
      "timestamp_ms": 1791471863000,
      "source_url": "https://www.onepageplan.in/confirmed",
      "action_source": "web",
      "oppref": "<OPPREF_CLICK_REFERENCE>",
      "data": {
        "type": "customer_action"
      }
    }
  ]
}
```

---

## 4. Live Verification & API Ingestion Evidence

### A. Live Schema Validation Test with OpenAI Gateway
A test request using `"validate_only": true` was executed against OpenAI's Conversions API via the production environment to verify credential permissions and schema compliance:

- **Upstream Target:** `POST https://bzr.openai.com/v1/events?pid=LCLQYPUtFAeHU1BCs5buMR`
- **HTTP Response Status:** `200 OK`
- **OpenAI Upstream Response Body:**
```json
{
  "ok": true,
  "status": 200,
  "message": "Events submitted successfully",
  "details": {
    "accepted_events": 1
  }
}
```

### B. Summary of Verification Checks

| Check | Result | Evidence / Details |
| :--- | :--- | :--- |
| **Authentication & Scope** | **Passed** | API key contains `ads.third_party_events.write`; returns HTTP 200 |
| **Payload Schema** | **Passed** | `type: "registration_completed"`, `data: {"type": "customer_action"}` accepted |
| **Timestamp** | **Passed** | Dynamic Unix milliseconds (`Date.now()`) within valid range |
| **Deduplication** | **Passed** | Browser SDK `event_id` and server `id` share the exact registration UUID |
| **Attribution** | **Passed** | `oppref` captured from URL / `__oppref` cookie and forwarded to server payload |
| **Browser SDK Validation** | **Passed** | `oaiq("measure", ...)` passed `{ type: "customer_action" }` to prevent client-side drop |
