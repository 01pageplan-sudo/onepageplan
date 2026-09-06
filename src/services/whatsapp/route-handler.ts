/**
 * Universal Web Standard Route Handlers for Meta WhatsApp Webhook
 * 
 * Works natively with any framework supporting standard Request / Response objects:
 * - TanStack Start (this project's router)
 * - Next.js App Router (app/api/whatsapp/route.ts)
 * - Supabase Edge Functions (Deno.serve)
 * - Cloudflare Workers / Nitro / Hono / Remix
 * 
 * ==============================================================================
 * HOW TO PLUG THIS INTO TANSTACK START ROUTING (When you are ready):
 * ==============================================================================
 * Create a new file `src/routes/api/public/whatsapp.ts`:
 * 
 * ```ts
 * import { createFileRoute } from "@tanstack/react-router";
 * import {
 *   handleWhatsAppGet,
 *   handleWhatsAppPost,
 * } from "@/services/whatsapp/route-handler";
 * 
 * export const Route = createFileRoute("/api/public/whatsapp")({
 *   server: {
 *     handlers: {
 *       GET: ({ request }) => handleWhatsAppGet(request),
 *       POST: ({ request }) =>
 *         handleWhatsAppPost(request, {
 *           onMessage: async (message, contact) => {
 *             console.log("Inbound WhatsApp message:", message.from, message.text?.body);
 *             // TODO: Save into Supabase or reply to the user
 *           },
 *           onStatusUpdate: async (status) => {
 *             console.log("WhatsApp message delivery update:", status.id, status.status);
 *             // TODO: Update delivery status in your database
 *           },
 *         }),
 *     },
 *   },
 * });
 * ```
 * 
 * ==============================================================================
 * HOW TO PLUG THIS INTO NEXT.JS APP ROUTER:
 * ==============================================================================
 * In `app/api/whatsapp/route.ts`:
 * 
 * ```ts
 * import { handleWhatsAppGet, handleWhatsAppPost } from "@/services/whatsapp";
 * 
 * export async function GET(request: Request) {
 *   return handleWhatsAppGet(request);
 * }
 * 
 * export async function POST(request: Request) {
 *   return handleWhatsAppPost(request, {
 *     onMessage: async (msg) => { ... },
 *   });
 * }
 * ```
 */

import { verifyWhatsAppWebhook, verifyMetaSignature, processWhatsAppWebhook } from "./webhook.js";
import type { WhatsAppWebhookHandlers } from "./types.js";

/**
 * Universal GET Handler for Meta Webhook Verification.
 * Accepts hub.mode, hub.verify_token, and hub.challenge and returns the challenge.
 */
export async function handleWhatsAppGet(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const verification = verifyWhatsAppWebhook({
    "hub.mode": url.searchParams.get("hub.mode") ?? undefined,
    "hub.verify_token": url.searchParams.get("hub.verify_token") ?? undefined,
    "hub.challenge": url.searchParams.get("hub.challenge") ?? undefined,
  });

  if (verification.success) {
    return new Response(verification.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response(verification.error, {
    status: verification.status,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Universal POST Handler for Meta Inbound Events (Messages & Delivery Statuses).
 * 
 * Immediately returns 200 OK to prevent Meta webhook retries, while safely
 * processing the payload and invoking registered handlers in the background.
 */
export async function handleWhatsAppPost(
  request: Request,
  handlers?: WhatsAppWebhookHandlers,
): Promise<Response> {
  try {
    const rawBody = await request.text();

    // 1. Optional Signature Verification if WHATSAPP_APP_SECRET is set
    const signatureHeader = request.headers.get("x-hub-signature-256");
    if (signatureHeader && !verifyMetaSignature(rawBody, signatureHeader)) {
      console.warn("[WhatsApp Webhook] Invalid X-Hub-Signature-256 signature.");
      return new Response("Invalid signature", { status: 401 });
    }

    // 2. Parse JSON payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("[WhatsApp Webhook] Received unparseable non-JSON body");
      // Return 200 to prevent Meta from spamming malformed retries
      return new Response("Bad payload received", { status: 200 });
    }

    // 3. Process payload asynchronously (safe from throwing)
    // We intentionally do not await if we want sub-millisecond response,
    // or we await safe execution so logs are synchronous in serverless runtimes.
    await processWhatsAppWebhook(payload, handlers);

    // 4. Always return HTTP 200 OK to Meta
    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("[WhatsApp Webhook POST error]", error);
    // Meta requires 200 OK within 5 seconds to avoid retries and disabling the webhook.
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}
