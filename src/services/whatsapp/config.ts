/**
 * WhatsApp Configuration Loader
 * 
 * Safely reads and validates environment variables for direct Meta Cloud API integration.
 * No hardcoded secrets.
 */

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  apiVersion: string;
  appSecret?: string | undefined;
  graphBaseUrl: string;
}

/**
 * Returns the validated WhatsApp configuration.
 * Throws a descriptive error if critical variables are missing.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  const accessToken = (process.env["WHATSAPP_ACCESS_TOKEN"] ?? "").trim();
  const phoneNumberId = (process.env["WHATSAPP_PHONE_NUMBER_ID"] ?? "").trim();
  const verifyToken = (process.env["WHATSAPP_VERIFY_TOKEN"] ?? "").trim();
  const apiVersion = (process.env["WHATSAPP_API_VERSION"] ?? "v19.0").trim();
  const appSecret = process.env["WHATSAPP_APP_SECRET"]
    ? process.env["WHATSAPP_APP_SECRET"].trim()
    : undefined;

  const missing: string[] = [];
  if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!verifyToken) missing.push("WHATSAPP_VERIFY_TOKEN");

  if (missing.length > 0) {
    console.warn(
      `[WhatsApp Config Warning] Missing environment variables: ${missing.join(", ")}. Outbound messaging or webhook verification will fail until these are configured in your .env.`,
    );
  }

  const cleanVersion = apiVersion.startsWith("v") ? apiVersion : `v${apiVersion}`;
  const graphBaseUrl = `https://graph.facebook.com/${cleanVersion}`;

  return {
    accessToken,
    phoneNumberId,
    verifyToken,
    apiVersion: cleanVersion,
    appSecret,
    graphBaseUrl,
  };
}

/**
 * Quick boolean check if WhatsApp configuration is present.
 */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env["WHATSAPP_ACCESS_TOKEN"] &&
      process.env["WHATSAPP_PHONE_NUMBER_ID"] &&
      process.env["WHATSAPP_VERIFY_TOKEN"],
  );
}
