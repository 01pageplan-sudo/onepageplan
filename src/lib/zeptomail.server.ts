/**
 * Zoho ZeptoMail REST API v1.1 Client
 * Official transactional email dispatcher for onepageplan.in.
 */

export interface ZeptoSendOptions {
  to: string;
  toName?: string | undefined;
  subject: string;
  htmlBody: string;
  textBody?: string | undefined;
  fromAddress?: string | undefined;
  fromName?: string | undefined;
  clientReference?: string | undefined;
}

export interface ZeptoSendResult {
  ok: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
}

export async function sendZeptoEmail(options: ZeptoSendOptions): Promise<ZeptoSendResult> {
  const apiKey = (
    process.env["ZEPTOMAIL_API_KEY"] ||
    process.env["ZEPTOMAIL_SEND_MAIL_TOKEN"] ||
    process.env["ZEPTOMAIL_TOKEN"] ||
    ""
  ).trim();

  if (!apiKey) {
    console.warn("[ZeptoMail] ZEPTOMAIL_API_KEY is not configured on the server.");
    return {
      ok: false,
      error: "ZEPTOMAIL_API_KEY is not configured on the server.",
    };
  }

  const endpoint = (
    process.env["ZEPTOMAIL_URL"] ||
    process.env["ZEPTOMAIL_ENDPOINT"] ||
    "https://api.zeptomail.in/v1.1/email"
  ).trim();

  const fromAddress = (
    options.fromAddress ||
    process.env["FROM_EMAIL"] ||
    process.env["ZEPTOMAIL_FROM_EMAIL"] ||
    "connect@onepageplan.in"
  ).trim();

  const fromName = (
    options.fromName ||
    process.env["FROM_NAME"] ||
    process.env["ZEPTOMAIL_FROM_NAME"] ||
    "Milan Dodhia"
  ).trim();

  const payload: Record<string, unknown> = {
    from: {
      address: fromAddress,
      name: fromName,
    },
    to: [
      {
        email_address: {
          address: options.to.trim().toLowerCase(),
          name: options.toName ? options.toName.trim() : options.to.split("@")[0],
        },
      },
    ],
    subject: options.subject,
    htmlbody: options.htmlBody,
  };

  if (options.textBody) {
    payload["textbody"] = options.textBody;
  }

  if (options.clientReference) {
    payload["client_reference"] = options.clientReference;
  }

  try {
    const authHeader = apiKey.startsWith("Zoho-enczapikey ")
      ? apiKey
      : `Zoho-enczapikey ${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const errorMsg =
        (data["message"] as string) ||
        (data["error"] as string) ||
        `HTTP ${response.status}: ${text.slice(0, 300)}`;
      console.error("[ZeptoMail] Send failed:", response.status, errorMsg);
      return { ok: false, error: errorMsg };
    }

    // Extract request/message ID
    // ZeptoMail returns data in { data: [ { code: "...", message: "...", details: [ { id: "..." } ] } ], request_id: "..." }
    const responseData = Array.isArray(data["data"]) ? data["data"][0] : data["data"];
    const details = responseData?.["details"]?.[0] || responseData?.["details"] || {};
    const messageId =
      (details["id"] as string) ||
      (data["request_id"] as string) ||
      (data["id"] as string) ||
      "zeptomail_sent";

    return { ok: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ZeptoMail] Network / execution error:", message);
    return { ok: false, error: message };
  }
}
