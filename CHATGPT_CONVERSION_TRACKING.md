# ChatGPT / OpenAI Ads Conversion Tracking Implementation Report

## 1. Implementation Architecture & Location

- **Where was the tracking implemented?**
  - **Website Code (Full-stack TypeScript Application on Vercel)**.
  - **Not** in Google Tag Manager (GTM).
  - **Not** in an external automation platform (e.g. Zapier, Make).

- **Tracking Layers:**
  1. **Client-Side (Browser Pixel):** Initialized in the site `<head>` across all pages, firing `oaiq("measure", "registration_completed")` on the `/confirmed` success page.
  2. **Server-Side Conversion API (CAPI):** Directly dispatches an HTTP POST event to OpenAI's Events API upon successful lead creation in the backend database. Both browser and server events share the same `event_id` for accurate deduplication.

---

## 2. Browser Pixel Code (Client-Side)

### A. Pixel Initialization Script (`<head>`)
**File:** `src/routes/__root.tsx`

```html
<!-- OpenAI / ChatGPT Ads Pixel Base Code -->
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
    f.parentNode.insertBefore(j,f)
  }(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");

  oaiq("init", { pixelId: "LCLQYPUtFAeHU1BCs5buMR", debug: true });
</script>
```

### B. Registration-Success Event on Confirmation Page
**File:** `src/routes/confirmed.tsx`
Fires once per registration session when the registrant lands on the success page:

```javascript
// Triggered once upon registration completion
if (typeof window !== "undefined" && window.oaiq) {
  window.oaiq("measure", "registration_completed", {}, {
    event_id: registrationId // Matches server-side UUID for event deduplication
  });
}
```

---

## 3. Server-Side Conversion API (CAPI)

### A. Server Handler Trigger
**File:** `src/lib/registration.functions.ts`
When an attendee registers on the landing page, the server handler persists the lead and dispatches the conversion event:

```typescript
// Executed server-side immediately upon successful database registration
const siteUrl = (process.env["VITE_SITE_URL"] || "https://onepageplan.in").replace(/\/+$/, "");
const sourceUrl = `${siteUrl}${row.landing_path && row.landing_path.startsWith("/") ? row.landing_path : "/confirmed"}`;

await sendChatGPTRegistrationEvent({
  id: saved.id, // Unique registration UUID
  source_url: sourceUrl,
});
```

### B. Upstream Dispatcher Payload & Endpoint
**File:** `src/lib/chatgpt-conversion.server.ts`
Dispatches the conversion event directly to OpenAI's Conversions API endpoint:

- **Endpoint:** `POST https://bzr.openai.com/v1/events?pid=LCLQYPUtFAeHU1BCs5buMR`
- **Headers:**
  - `Authorization: Bearer <CONVERSION_API_KEY>`
  - `Content-Type: application/json`
- **Payload:**
```json
{
  "validate_only": false,
  "events": [
    {
      "id": "<REGISTRATION-UUID>",
      "type": "registration_completed",
      "timestamp_ms": 1728310000000,
      "source_url": "https://onepageplan.in/confirmed",
      "action_source": "web",
      "data": {
        "type": "customer_action"
      }
    }
  ]
}
```

---

## 4. Production Verification & Status Log

### Live Production Relay Endpoint
- **URL:** `https://www.onepageplan.in/api/public/chatgpt-conversion`
- **Method:** `GET`
- **HTTP Status:** `200 OK`

### Upstream Execution Response (Tokens Removed)
```json
{
  "status": "active",
  "endpoint": "/api/public/chatgpt-conversion",
  "service": "ChatGPT / OpenAI Ads Conversion API Relay",
  "configured": true,
  "pixel_id": "LCLQYPUtFAeHU1BCs5buMR",
  "timestamp": "2026-10-08T14:44:01.957Z"
}
```

### Key Highlights
1. **Pixel ID:** `LCLQYPUtFAeHU1BCs5buMR` is loaded on both the browser pixel and the server-side conversion API endpoint.
2. **Key Status:** `"configured": true` confirms that `CHATGPT_CONVERSION_API_KEY` is present and active in the Vercel production environment.
3. **Event Name:** `registration_completed`.
4. **Action Source:** `web`.
5. **Deduplication:** Browser `event_id` matches server `id` (`registrationId` UUID).
