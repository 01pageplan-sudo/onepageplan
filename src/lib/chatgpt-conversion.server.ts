import crypto from "node:crypto";

/**
 * ChatGPT / OpenAI Ads Conversion API Client
 * Server-side event dispatcher for conversion tracking.
 */

export interface ChatGPTConversionEventItem {
  id?: string;
  type?: string;
  timestamp_ms?: number;
  source_url?: string;
  action_source?: "web" | "app" | "system" | string;
  data?: Record<string, unknown>;
  oppref?: string | undefined;
}

export interface SendChatGPTConversionOptions {
  validate_only?: boolean;
  pixelId?: string;
  apiKey?: string;
}

export interface ChatGPTConversionResult {
  ok: boolean;
  status?: number;
  message?: string;
  error?: string;
  details?: unknown;
}

export const DEFAULT_CHATGPT_PIXEL_ID = "LCLQYPUtFAeHU1BCs5buMR";

export function getChatGPTConversionApiKey(): string {
  return (
    process.env["CHATGPT_CONVERSION_API_KEY"] ||
    process.env["CHATGPT_CONVERSION_KEY"] ||
    process.env["OPENAI_CONVERSION_API_KEY"] ||
    process.env["OPENAI_CONVERSION_KEY"] ||
    process.env["CHATGPT_API_KEY"] ||
    process.env["OPENAI_ADS_API_KEY"] ||
    process.env["OPENAI_ADS_TOKEN"] ||
    ""
  ).trim();
}

export function getChatGPTPixelId(): string {
  return (
    process.env["CHATGPT_PIXEL_ID"] ||
    process.env["OPENAI_PIXEL_ID"] ||
    DEFAULT_CHATGPT_PIXEL_ID
  ).trim();
}

/**
 * Dispatches one or more conversion events to OpenAI / ChatGPT Conversion API.
 * Endpoint: POST https://bzr.openai.com/v1/events?pid=<PIXEL_ID>
 */
export async function sendChatGPTConversionEvents(
  rawEvents: ChatGPTConversionEventItem | ChatGPTConversionEventItem[],
  options?: SendChatGPTConversionOptions,
): Promise<ChatGPTConversionResult> {
  const apiKey = (options?.apiKey || getChatGPTConversionApiKey()).trim();
  const pixelId = (options?.pixelId || getChatGPTPixelId()).trim();

  if (!apiKey) {
    console.warn(
      "[ChatGPT CAPI] Skipped event dispatch: Conversion key is not set in environment (set CHATGPT_CONVERSION_API_KEY in Vercel).",
    );
    return {
      ok: false,
      error: "Conversion API key is not configured in environment.",
    };
  }

  const items = Array.isArray(rawEvents) ? rawEvents : [rawEvents];
  if (items.length === 0) {
    return { ok: false, error: "No events provided." };
  }

  const siteUrl = (process.env["VITE_SITE_URL"] || "https://onepageplan.in").replace(/\/+$/, "");

  const formattedEvents = items.map((item) => {
    const eventId =
      item.id && item.id.trim() !== ""
        ? item.id.trim()
        : typeof crypto?.randomUUID === "function"
          ? crypto.randomUUID()
          : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const sourceUrl =
      item.source_url && item.source_url.trim() !== ""
        ? item.source_url.trim()
        : `${siteUrl}/confirmed`;

    return {
      id: eventId,
      type: item.type || "registration_completed",
      timestamp_ms:
        typeof item.timestamp_ms === "number" && item.timestamp_ms > 0
          ? Math.round(item.timestamp_ms)
          : Date.now(),
      source_url: sourceUrl,
      action_source: item.action_source || "web",
      ...(item.oppref && item.oppref.trim() !== "" ? { oppref: item.oppref.trim() } : {}),
      data: item.data || {
        type: "customer_action",
      },
    };
  });

  const payload = {
    validate_only: options?.validate_only ?? false,
    events: formattedEvents,
  };

  const endpoint = `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }

    if (!response.ok) {
      console.error(
        `[ChatGPT CAPI] Upstream responded ${response.status}:`,
        typeof parsed === "string" ? parsed.slice(0, 300) : parsed,
      );
      return {
        ok: false,
        status: response.status,
        error: `ChatGPT CAPI HTTP ${response.status}`,
        details: parsed,
      };
    }

    console.log(`[ChatGPT CAPI] Upstream response (${response.status}):`, typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed));
    console.log(`[ChatGPT CAPI] Successfully sent ${formattedEvents.length} event(s)`);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("app_config").upsert(
        {
          key: "chatgpt_last_dispatch",
          value: JSON.stringify({
            event_id: formattedEvents[0]?.id,
            timestamp_ms: formattedEvents[0]?.timestamp_ms,
            source_url: formattedEvents[0]?.source_url,
            action_source: formattedEvents[0]?.action_source,
            oppref_present: Boolean(formattedEvents[0]?.oppref),
            validate_only: options?.validate_only ?? false,
            upstream_status: response.status,
            upstream_response: parsed,
            recorded_at: new Date().toISOString(),
          }),
        },
        { onConflict: "key" },
      );
    } catch {
      /* audit persistence ignored if unavailable */
    }

    return {
      ok: true,
      status: response.status,
      message: "Events submitted successfully",
      details: parsed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ChatGPT CAPI] Request failed:", msg);
    return {
      ok: false,
      error: msg,
    };
  }
}

/**
 * Convenience helper to dispatch a registration_completed event.
 */
export async function sendChatGPTRegistrationEvent(args?: {
  id?: string;
  source_url?: string;
  timestamp_ms?: number;
  oppref?: string;
  data?: Record<string, unknown>;
}): Promise<ChatGPTConversionResult> {
  return sendChatGPTConversionEvents({
    id: args?.id,
    type: "registration_completed",
    timestamp_ms: args?.timestamp_ms,
    source_url: args?.source_url,
    action_source: "web",
    oppref: args?.oppref,
    data: args?.data || { type: "customer_action" },
  });
}
