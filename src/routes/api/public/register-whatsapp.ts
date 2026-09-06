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
        const customId = (
          url.searchParams.get("id") ||
          url.searchParams.get("phoneNumberId") ||
          ""
        ).trim();
        const customToken = (
          url.searchParams.get("token") ||
          url.searchParams.get("accessToken") ||
          ""
        ).trim();

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
        const apiVersion = (url.searchParams.get("v") || "v21.0").trim();
        const targetAccessToken = customToken || config.accessToken;
        const targetPhoneNumberId = customId || config.phoneNumberId;

        if (url.searchParams.has("discover")) {
          const endpointsToTest = [
            `https://graph.facebook.com/${apiVersion}/me`,
            `https://graph.facebook.com/${apiVersion}/1056179313949979`,
            `https://graph.facebook.com/${apiVersion}/1056179313949979/phone_numbers`,
            `https://graph.facebook.com/${apiVersion}/1307461289115560?fields=verified_name,display_phone_number,quality_rating,code_verification_status,status,account_mode,is_pin_enabled,name_status`,
            `https://graph.facebook.com/${apiVersion}/122100077451469010/assigned_whatsapp_business_accounts`,
          ];

          const discoveryResults: Record<string, unknown> = {};
          for (const ep of endpointsToTest) {
            try {
              const res = await fetch(ep, {
                headers: { Authorization: `Bearer ${targetAccessToken}` },
              });
              discoveryResults[ep] = await res.json();
            } catch (err) {
              discoveryResults[ep] = { error: String(err) };
            }
          }

          return Response.json({
            status: "discovery",
            apiVersion,
            configuredEnvId: config.phoneNumberId,
            usedTokenOverride: Boolean(customToken),
            discoveryResults,
          });
        }

        if (!targetAccessToken || !targetPhoneNumberId) {
          return Response.json(
            {
              error: "missing_credentials",
              message:
                "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured in Vercel, and no ?token= or ?id= was provided in the URL.",
            },
            { status: 500 },
          );
        }

        const endpoint = `https://graph.facebook.com/${apiVersion}/${targetPhoneNumberId}/register`;

        try {
          const upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${targetAccessToken}`,
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
            // Check debug_token to inspect token metadata and permissions
            let tokenDebug: unknown = null;
            try {
              const dbgRes = await fetch(
                `${config.graphBaseUrl}/debug_token?input_token=${targetAccessToken}&access_token=${targetAccessToken}`,
              );
              tokenDebug = await dbgRes.json();
            } catch {
              // ignore
            }

            // Check if this ID is a WABA ID by querying its phone_numbers
            let phoneNumbersList: unknown = null;
            try {
              const pnRes = await fetch(
                `${config.graphBaseUrl}/${targetPhoneNumberId}/phone_numbers`,
                {
                  headers: { Authorization: `Bearer ${targetAccessToken}` },
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
                attemptedPhoneNumberId: targetPhoneNumberId,
                currentConfiguredEnvId: config.phoneNumberId,
                wasOverriddenByQuery: Boolean(customId),
                metaResponse: parsed,
                availablePhoneNumbers: phoneNumbersList,
                tokenDebug,
                tip: "Make sure you are using the Phone Number ID (from WhatsApp > API Setup), NOT the WhatsApp Business Account ID.",
              },
              { status: upstream.status },
            );
          }

          return Response.json({
            status: "success",
            message: "Phone number registered successfully with Meta WhatsApp Cloud API!",
            registeredPhoneNumberId: targetPhoneNumberId,
            currentConfiguredEnvId: config.phoneNumberId,
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
