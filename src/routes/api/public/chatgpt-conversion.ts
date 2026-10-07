import { createFileRoute } from "@tanstack/react-router";
import {
  sendChatGPTConversionEvents,
  getChatGPTConversionApiKey,
  getChatGPTPixelId,
  type ChatGPTConversionEventItem,
} from "@/lib/chatgpt-conversion.server";

/**
 * ChatGPT / OpenAI Ads Conversion API Endpoint
 * Accepts incoming conversion event payloads and relays them to OpenAI's Events API.
 * Endpoint: /api/public/chatgpt-conversion
 */
export const Route = createFileRoute("/api/public/chatgpt-conversion")({
  server: {
    handlers: {
      GET: async () => {
        const hasKey = getChatGPTConversionApiKey().length > 0;
        const pixelId = getChatGPTPixelId();

        return new Response(
          JSON.stringify({
            status: "active",
            endpoint: "/api/public/chatgpt-conversion",
            service: "ChatGPT / OpenAI Ads Conversion API Relay",
            configured: hasKey,
            pixel_id: pixelId,
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },

      POST: async ({ request }) => {
        try {
          const rawText = await request.text();
          let body: Record<string, unknown> = {};
          if (rawText.trim().length > 0) {
            try {
              body = JSON.parse(rawText) as Record<string, unknown>;
            } catch {
              return new Response(
                JSON.stringify({ error: "Invalid JSON body" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }
          }

          const validateOnly = Boolean(body["validate_only"]);
          let events: ChatGPTConversionEventItem[] = [];

          if (Array.isArray(body["events"])) {
            events = body["events"] as ChatGPTConversionEventItem[];
          } else {
            // Support single event object payload
            events = [
              {
                id: (body["id"] as string) || undefined,
                type: (body["type"] as string) || "registration_completed",
                timestamp_ms: typeof body["timestamp_ms"] === "number" ? body["timestamp_ms"] : undefined,
                source_url: (body["source_url"] as string) || undefined,
                action_source: (body["action_source"] as string) || "web",
                data: (body["data"] as Record<string, unknown>) || undefined,
              },
            ];
          }

          const result = await sendChatGPTConversionEvents(events, {
            validate_only: validateOnly,
          });

          return new Response(JSON.stringify(result), {
            status: result.ok ? 200 : result.status || 500,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[ChatGPT Conversion Endpoint] Error:", message);
          return new Response(
            JSON.stringify({ ok: false, error: message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
