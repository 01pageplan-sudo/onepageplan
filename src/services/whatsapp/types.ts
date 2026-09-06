/**
 * WhatsApp Cloud API v19.0 Type Definitions
 * 
 * Direct integration with Meta Graph API for WhatsApp Business Platform.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

// ============================================================================
// Outbound Messaging Types
// ============================================================================

export type WhatsAppLanguage = {
  code: string; // e.g., "en_US", "en", "hi"
  policy?: "deterministic";
};

export type WhatsAppParameter =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "currency";
      currency: {
        fallback_value: string;
        code: string;
        amount_1000: number;
      };
    }
  | {
      type: "date_time";
      date_time: {
        fallback_value: string;
      };
    }
  | {
      type: "image";
      image: { id?: string; link?: string };
    }
  | {
      type: "document";
      document: { id?: string; link?: string; filename?: string };
    }
  | {
      type: "video";
      video: { id?: string; link?: string };
    }
  | {
      type: "payload";
      payload: string;
    };

export type WhatsAppTemplateComponent = {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string | number;
  parameters: WhatsAppParameter[];
};

export type WhatsAppTemplatePayload = {
  name: string;
  language: WhatsAppLanguage;
  components?: WhatsAppTemplateComponent[];
};

export type WhatsAppTextPayload = {
  preview_url?: boolean;
  body: string;
};

export type WhatsAppInteractiveReplyButton = {
  type: "reply";
  reply: {
    id: string;
    title: string; // Maximum 20 characters
  };
};

export type WhatsAppInteractiveSectionRow = {
  id: string;
  title: string; // Maximum 24 characters
  description?: string; // Maximum 72 characters
};

export type WhatsAppInteractiveSection = {
  title?: string;
  rows: WhatsAppInteractiveSectionRow[];
};

export type WhatsAppInteractiveAction = {
  button?: string;
  buttons?: WhatsAppInteractiveReplyButton[];
  sections?: WhatsAppInteractiveSection[];
};

export type WhatsAppInteractivePayload = {
  type: "button" | "list";
  header?: {
    type: "text" | "image" | "document" | "video";
    text?: string;
    image?: { link: string };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: WhatsAppInteractiveAction;
};

export type WhatsAppMediaPayload = {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
};

export type WhatsAppOutgoingMessage = {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string; // Recipient's phone number in E.164 format without '+' (e.g. "919876543210")
  type: "text" | "template" | "interactive" | "image" | "document" | "audio" | "video" | "reaction";
  text?: WhatsAppTextPayload;
  template?: WhatsAppTemplatePayload;
  interactive?: WhatsAppInteractivePayload;
  image?: WhatsAppMediaPayload;
  document?: WhatsAppMediaPayload;
  audio?: WhatsAppMediaPayload;
  video?: WhatsAppMediaPayload;
  reaction?: {
    message_id: string;
    emoji: string;
  };
};

export type WhatsAppReadReceiptPayload = {
  messaging_product: "whatsapp";
  status: "read";
  message_id: string;
};

// ============================================================================
// Meta Graph API Response Types
// ============================================================================

export type WhatsAppSuccessContact = {
  input: string;
  wa_id: string;
};

export type WhatsAppSuccessMessage = {
  id: string; // WhatsApp Message ID, e.g. "wamid.HBgLM..."
  message_status?: string;
};

export type WhatsAppSendResponse = {
  messaging_product: "whatsapp";
  contacts: WhatsAppSuccessContact[];
  messages: WhatsAppSuccessMessage[];
};

export type WhatsAppApiErrorResponse = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
    fbtrace_id?: string;
  };
};

// ============================================================================
// Webhook Verification (GET) Types
// ============================================================================

export type WebhookVerificationParams = {
  "hub.mode"?: string | undefined;
  "hub.verify_token"?: string | undefined;
  "hub.challenge"?: string | undefined;
};

// ============================================================================
// Inbound Webhook Event (POST) Types
// ============================================================================

export type WhatsAppInboundText = {
  body: string;
};

export type WhatsAppInboundInteractive = {
  type: "button_reply" | "list_reply";
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
};

export type WhatsAppInboundButton = {
  text: string;
  payload: string;
};

export type WhatsAppInboundMedia = {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
};

export type WhatsAppInboundMessage = {
  from: string; // Sender's phone number
  id: string; // Message ID (wamid.xxx)
  timestamp: string; // Unix timestamp
  type:
    | "text"
    | "interactive"
    | "button"
    | "image"
    | "document"
    | "audio"
    | "video"
    | "location"
    | "unknown";
  text?: WhatsAppInboundText;
  interactive?: WhatsAppInboundInteractive;
  button?: WhatsAppInboundButton;
  image?: WhatsAppInboundMedia;
  document?: WhatsAppInboundMedia;
  audio?: WhatsAppInboundMedia;
  video?: WhatsAppInboundMedia;
  context?: {
    from?: string;
    id?: string;
    referred_product?: unknown;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
};

export type WhatsAppStatusType = "sent" | "delivered" | "read" | "failed";

export type WhatsAppStatusError = {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
};

export type WhatsAppStatusUpdate = {
  id: string; // Message ID
  status: WhatsAppStatusType;
  timestamp: string;
  recipient_id: string;
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
  };
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: string;
    };
  };
  errors?: WhatsAppStatusError[];
};

export type WhatsAppProfile = {
  name: string;
};

export type WhatsAppContact = {
  profile: WhatsAppProfile;
  wa_id: string;
};

export type WhatsAppMetadata = {
  display_phone_number: string;
  phone_number_id: string;
};

export type WhatsAppChangeValue = {
  messaging_product: "whatsapp";
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppStatusUpdate[];
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
  }>;
};

export type WhatsAppChange = {
  field: "messages";
  value: WhatsAppChangeValue;
};

export type WhatsAppEntry = {
  id: string; // WhatsApp Business Account ID
  changes: WhatsAppChange[];
};

export type WhatsAppWebhookPayload = {
  object: "whatsapp_business_account";
  entry: WhatsAppEntry[];
};

// ============================================================================
// Webhook Event Callback Handlers
// ============================================================================

export type WhatsAppWebhookHandlers = {
  /**
   * Called when a new inbound message arrives from a user.
   */
  onMessage?: (
    message: WhatsAppInboundMessage,
    contact: WhatsAppContact | undefined,
    metadata: WhatsAppMetadata,
  ) => Promise<void> | void;

  /**
   * Called when the status of an outbound message changes (sent, delivered, read, failed).
   */
  onStatusUpdate?: (
    status: WhatsAppStatusUpdate,
    metadata: WhatsAppMetadata,
  ) => Promise<void> | void;

  /**
   * Called if any error occurs while processing the webhook.
   */
  onError?: (error: unknown) => Promise<void> | void;
};
