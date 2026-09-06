/**
 * Express.js Adapter for Meta WhatsApp Cloud API Webhooks
 * 
 * Use this adapter if your application or backend microservice is built using
 * standard Node.js with Express.
 * 
 * ==============================================================================
 * USAGE EXAMPLE (Standard Node.js / Express):
 * ==============================================================================
 * ```ts
 * import express from "express";
 * import { createWhatsAppExpressRouter } from "@/services/whatsapp/express-adapter";
 * 
 * const app = express();
 * 
 * // Note: To support HMAC signature verification, capture rawBody:
 * app.use(express.json({
 *   verify: (req: any, _res, buf) => {
 *     req.rawBody = buf.toString();
 *   }
 * }));
 * 
 * app.use("/api/whatsapp", createWhatsAppExpressRouter({
 *   onMessage: async (message, contact) => {
 *     console.log("Inbound WhatsApp message:", message.from, message.text?.body);
 *   },
 *   onStatusUpdate: async (status) => {
 *     console.log("WhatsApp message status:", status.id, status.status);
 *   }
 * }));
 * 
 * app.listen(3000, () => console.log("Server running on port 3000"));
 * ```
 */

import { verifyWhatsAppWebhook, verifyMetaSignature, processWhatsAppWebhook } from "./webhook.js";
import type { WhatsAppWebhookHandlers } from "./types.js";

// Generic Express request/response interfaces so we don't force '@types/express' as a hard dependency
export interface ExpressLikeRequest {
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: string | undefined;
  headers: Record<string, string | string[] | undefined>;
}

export interface ExpressLikeResponse {
  status: (code: number) => ExpressLikeResponse;
  send: (body: unknown) => ExpressLikeResponse;
  sendStatus: (code: number) => ExpressLikeResponse;
  setHeader: (name: string, value: string) => ExpressLikeResponse;
}

/**
 * Handles the Express GET verification route.
 */
export function handleExpressVerification(
  req: ExpressLikeRequest,
  res: ExpressLikeResponse,
): void {
  const mode = Array.isArray(req.query["hub.mode"]) ? req.query["hub.mode"][0] : req.query["hub.mode"];
  const verifyToken = Array.isArray(req.query["hub.verify_token"]) ? req.query["hub.verify_token"][0] : req.query["hub.verify_token"];
  const challenge = Array.isArray(req.query["hub.challenge"]) ? req.query["hub.challenge"][0] : req.query["hub.challenge"];

  const result = verifyWhatsAppWebhook({
    "hub.mode": mode,
    "hub.verify_token": verifyToken,
    "hub.challenge": challenge,
  });

  if (result.success) {
    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(result.challenge);
    return;
  }

  res.setHeader("Content-Type", "text/plain");
  res.status(result.status).send(result.error);
}

/**
 * Handles the Express POST incoming webhook route.
 */
export async function handleExpressWebhook(
  req: ExpressLikeRequest,
  res: ExpressLikeResponse,
  handlers?: WhatsAppWebhookHandlers,
): Promise<void> {
  try {
    // Optional HMAC signature check if rawBody is available
    const rawSignature = req.headers["x-hub-signature-256"];
    const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;

    if (req.rawBody && signature && !verifyMetaSignature(req.rawBody, signature)) {
      console.warn("[Express WhatsApp Webhook] Invalid X-Hub-Signature-256");
      res.status(401).send("Invalid signature");
      return;
    }

    // Immediately respond to Meta with 200 OK
    res.status(200).send("EVENT_RECEIVED");

    // Process event asynchronously
    await processWhatsAppWebhook(req.body, handlers);
  } catch (error) {
    console.error("[Express WhatsApp Webhook Error]", error);
    try {
      res.status(200).send("EVENT_RECEIVED");
    } catch {
      // Ignore if response was already sent
    }
  }
}
