import { createFileRoute } from "@tanstack/react-router";
import { getWhatsAppConfig } from "@/services/whatsapp";

/**
 * One-click registration endpoint for Meta WhatsApp Cloud API.
 * Registers the Phone Number ID with Meta using a 6-digit PIN to activate messaging.
 * 
 * Usage:
 * Open in browser: https://onepageplan.in/api/public/register-whatsapp?pin=123456
 */
export const Route = createFileRoute("/api/public/register-whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const pin = (url.searchParams.get("pin") || "123456").trim();

        if (!/^\d{6}$/.test(pin)) {
          return Response.json(
            {
              error: "invalid_pin",
              message: "PIN must be exactly 6 digits (e.g. ?pin=123456)",
            },
            { status: 400 },
          );
        }

        const config = getWhatsAppConfig();
        if (!config.accessToken || !config.phoneNumberId) {
          return Response.json(
            {
              error: "missing_credentials",
              message:
                "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured in Vercel.",
            },
            { status: 500 },
          );
        }

        const endpoint = `${config.graphBaseUrl}/${config.phoneNumberId}/register`;

        try {
          const upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              pin,
            }),
          });

          const rawText = await upstream.text();
          let parsed: unknown;
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = { raw: rawText };
          }

          if (!upstream.ok) {
            // Check if this ID is actually a WABA ID by querying its phone_numbers
            let phoneNumbersList: unknown = null;
            try {
              const pnRes = await fetch(
                `${config.graphBaseUrl}/${config.phoneNumberId}/phone_numbers`,
                {
                  headers: { Authorization: `Bearer ${config.accessToken}` },
                },
              );
              phoneNumbersList = await pnRes.json();
            } catch {
              // ignore
            }

            return Response.json(
              {
                status: "failed",
                httpStatus: upstream.status,
                endpoint,
                currentConfiguredId: config.phoneNumberId,
                note: "If currentConfiguredId is your WhatsApp Business Account ID, see phoneNumbers below for your real Phone Number ID.",
                metaResponse: parsed,
                availablePhoneNumbers: phoneNumbersList,
              },
              { status: upstream.status },
            );
          }

          return Response.json({
            status: "success",
            message: "Phone number registered successfully with Meta WhatsApp Cloud API!",
            phoneNumberId: config.phoneNumberId,
            pinUsed: pin,
            metaResponse: parsed,
          });
        } catch (networkError) {
          return Response.json(
            {
              status: "error",
              message:
                networkError instanceof Error ? networkError.message : String(networkError),
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
