# Direct Meta WhatsApp Cloud API Service (v19.0)

A self-contained, enterprise-grade integration for Meta's direct **WhatsApp Cloud API**. This module allows you to send outbound messages and ingest inbound webhooks directly through Meta without relying on third-party intermediaries (e.g., AiSensy, Twilio, Gupshup).

---

## Directory Structure

```
src/services/whatsapp/
├── types.ts              # Strict TypeScript definitions for Meta Cloud API payloads & webhooks
├── config.ts             # Configuration loader & validator for Meta credentials
├── sender.ts             # Reusable service to send WhatsApp messages (text, template, interactive)
├── webhook.ts            # Webhook verification (GET) and payload parsing/processing (POST)
├── route-handler.ts      # Web Standards (Request/Response) handler for TanStack Start / Next.js / Edge Functions
├── express-adapter.ts    # Express.js (req, res) adapter for standard Node.js Express apps
├── index.ts              # Single barrel export
├── .env.example          # Environment variables template
└── README.md             # Integration guide and documentation
```

---

## 1. Prerequisites & Meta Developer Setup

### Step 1: Create a Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com/) and log in.
2. Click **My Apps** > **Create App**.
3. Select **Other** as the use case, then choose **Business**.
4. Give your app a name and associate it with your **Meta Business Portfolio** (e.g. *Mannrs Wellness LLP*).

### Step 2: Add WhatsApp to Your App
1. In the App Dashboard, locate **WhatsApp** and click **Set up**.
2. Navigate to **WhatsApp** > **API Setup** in the left sidebar:
   - Copy your **Phone number ID** (e.g. `104829104812345`).
   - Copy your **WhatsApp Business Account ID**.

### Step 3: Generate a Permanent System User Token
> [!IMPORTANT]
> The "Temporary Access Token" shown in the dashboard expires in 24 hours. For production, you **must** generate a permanent System User Token.

1. Go to [Meta Business Settings](https://business.facebook.com/settings/).
2. Under **Users** > **System Users**, click **Add** (Admin system user).
3. Under **Assets**, assign your WhatsApp Business Account to the system user with full control.
4. Click **Generate New Token**, select your App, and enable the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the generated token and save it as `WHATSAPP_ACCESS_TOKEN`.

### Step 4: Configure Webhook in Meta Dashboard
1. In the Meta App Dashboard, go to **WhatsApp** > **Configuration**.
2. Click **Edit** next to **Webhook**:
   - **Callback URL**: `https://yourdomain.com/api/public/whatsapp` (or your staging/ngrok URL).
   - **Verify Token**: Enter any secret string you choose (e.g. `my_secret_token_12345`).
3. Set that exact string as `WHATSAPP_VERIFY_TOKEN` in your environment.
4. Click **Verify and Save**.
5. Under **Webhook fields**, click **Manage** and subscribe to **`messages`**.

---

## 2. Environment Variables

Add the following to your root `.env` file (see `.env.example` in this directory):

```env
# Meta Permanent System User Token
WHATSAPP_ACCESS_TOKEN="EAAG..."

# WhatsApp Phone Number ID (From API Setup screen)
WHATSAPP_PHONE_NUMBER_ID="104829104812345"

# Webhook verification secret token
WHATSAPP_VERIFY_TOKEN="your_custom_secure_verify_token_here"

# API Version (Defaults to v19.0)
WHATSAPP_API_VERSION="v19.0"

# Optional: Meta App Secret for HMAC-SHA256 signature verification
WHATSAPP_APP_SECRET=""
```

---

## 3. How to Plug Into Your Application

### Option A: TanStack Start (This Project's Router)

When you are ready to enable the webhook endpoint in this application, simply create a new file at `src/routes/api/public/whatsapp.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import {
  handleWhatsAppGet,
  handleWhatsAppPost,
} from "@/services/whatsapp";

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      // 1. Handles Meta's GET verification handshake
      GET: ({ request }) => handleWhatsAppGet(request),

      // 2. Handles Meta's POST incoming messages and delivery status updates
      POST: ({ request }) =>
        handleWhatsAppPost(request, {
          onMessage: async (message, contact) => {
            console.log("Inbound WhatsApp message from:", message.from);
            console.log("Message text:", message.text?.body);
            // Example: Respond to "STOP" or persist into your Supabase database
          },
          onStatusUpdate: async (status) => {
            console.log("Delivery status for", status.id, status.status);
            // Example: Mark message as delivered/read in database
          },
        }),
    },
  },
});
```

---

### Option B: Next.js App Router

Create `app/api/whatsapp/route.ts`:

```typescript
import { handleWhatsAppGet, handleWhatsAppPost } from "@/services/whatsapp";

export async function GET(request: Request) {
  return handleWhatsAppGet(request);
}

export async function POST(request: Request) {
  return handleWhatsAppPost(request, {
    onMessage: async (message) => {
      // Handle inbound message
    },
    onStatusUpdate: async (status) => {
      // Handle status update
    },
  });
}
```

---

### Option C: Standard Node.js with Express

```typescript
import express from "express";
import {
  handleExpressVerification,
  handleExpressWebhook,
} from "@/services/whatsapp";

const app = express();
app.use(express.json());

// Webhook Verification (GET)
app.get("/api/whatsapp", (req, res) => handleExpressVerification(req, res));

// Webhook Event Receiver (POST)
app.post("/api/whatsapp", (req, res) =>
  handleExpressWebhook(req, res, {
    onMessage: async (message, contact) => {
      console.log("Received message:", message);
    },
  })
);

app.listen(3000, () => console.log("Server listening on port 3000"));
```

---

### Option D: Supabase Edge Functions

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleWhatsAppGet, handleWhatsAppPost } from "./services/whatsapp/route-handler.ts";

serve(async (req) => {
  if (req.method === "GET") {
    return handleWhatsAppGet(req);
  }
  if (req.method === "POST") {
    return handleWhatsAppPost(req, {
      onMessage: async (msg) => { ... },
    });
  }
  return new Response("Method not allowed", { status: 405 });
});
```

---

## 4. Sending Messages

### Sending an Approved Template Message (Business-Initiated)
WhatsApp requires pre-approved templates for business-initiated conversations (e.g. webinar confirmations).

```typescript
import { sendTemplateMessage } from "@/services/whatsapp";

await sendTemplateMessage("+919876543210", {
  name: "masterclass_confirmation",
  languageCode: "en",
  components: [
    {
      type: "body",
      parameters: [
        { type: "text", text: "Milan" },
        { type: "text", text: "https://onepageplan.in/room" },
      ],
    },
  ],
});
```

### Sending a Plain Text Message (Customer Service Window)
Within 24 hours of a user messaging you, you can reply with free-form text:

```typescript
import { sendTextMessage } from "@/services/whatsapp";

await sendTextMessage("+919876543210", "Hello! How can I help you today?");
```

---

## 5. Replacing AiSensy in `registration.server.ts`

When you are ready to switch from AiSensy to direct Meta API in your registration flow, replace the fetch block in `src/lib/registration.server.ts` (`sendWhatsApp` function) with:

```typescript
import { sendTemplateMessage } from "@/services/whatsapp";

// Inside sendWhatsApp:
await sendTemplateMessage(args.phone_e164, {
  name: "masterclass_confirmation",
  languageCode: "en",
  components: [
    {
      type: "body",
      parameters: [
        { type: "text", text: firstName },
        { type: "text", text: webinarUrl },
      ],
    },
  ],
});
```

---

## 6. Testing & Troubleshooting

### Local Testing of Webhook Verification (GET)
```bash
curl "http://localhost:3000/api/public/whatsapp?hub.mode=subscribe&hub.verify_token=your_custom_secure_verify_token_here&hub.challenge=test_challenge_123"
```
**Expected Response:** `test_challenge_123` with HTTP `200 OK`.

### Testing Inbound Webhook (POST)
```bash
curl -X POST "http://localhost:3000/api/public/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "display_phone_number": "1234567890", "phone_number_id": "104829104812345" },
          "contacts": [{ "profile": { "name": "John Doe" }, "wa_id": "919876543210" }],
          "messages": [{ "from": "919876543210", "id": "wamid.test", "timestamp": "1710000000", "type": "text", "text": { "body": "Hi" } }]
        },
        "field": "messages"
      }]
    }]
  }'
```
**Expected Response:** `EVENT_RECEIVED` with HTTP `200 OK`.
