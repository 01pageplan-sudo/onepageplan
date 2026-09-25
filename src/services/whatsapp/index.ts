/**
 * Direct Meta WhatsApp Cloud API Service Module
 * 
 * Modular, zero-dependency integration with Meta Graph API (v19.0)
 * for sending messages and receiving webhooks directly without intermediaries.
 */

// Configuration
export { getWhatsAppConfig, isWhatsAppConfigured } from "./config.js";
export type { WhatsAppConfig } from "./config.js";

// Message Sending
export {
  sendWhatsAppMessage,
  sendTextMessage,
  sendTemplateMessage,
  markMessageAsRead,
  normalizeWhatsAppPhoneNumber,
  WhatsAppApiError,
} from "./sender.js";
export type { SendWhatsAppMessageParams } from "./sender.js";

// Webhook Processing & Security
export {
  verifyWhatsAppWebhook,
  verifyMetaSignature,
  processWhatsAppWebhook,
} from "./webhook.js";
export type { VerificationResult } from "./webhook.js";

// Route Handlers (Web Standards: TanStack Start / Next.js / Edge Functions)
export { handleWhatsAppGet, handleWhatsAppPost } from "./route-handler.js";

// Express Adapter (Node.js / Express microservices)
export {
  handleExpressVerification,
  handleExpressWebhook,
} from "./express-adapter.js";
export type { ExpressLikeRequest, ExpressLikeResponse } from "./express-adapter.js";

// Types
export type * from "./types.js";
