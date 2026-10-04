import { EMAIL_COMPLIANCE_FOOTER } from "./template-registry.server";

export interface ResendSendOptions {
  to: string;
  subject: string;
  bodyText: string;
  category: "transactional" | "marketing";
  unsubscribeUrl?: string;
  testMode?: boolean;
}

export interface ResendSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends an email via Resend from connect@onepageplan.in
 */
export async function sendEmailViaResend(options: ResendSendOptions): Promise<ResendSendResult> {
  const apiKey = process.env["RESEND_API_KEY"];

  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY is not configured in server environment.");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const fromEmail = process.env["RESEND_FROM_EMAIL"] || "connect@onepageplan.in";
  const fromName = process.env["RESEND_FROM_NAME"] || "Milan Dodhia";

  // Build clean HTML with compliance footer
  const unsubscribeUrl = options.unsubscribeUrl || `https://onepageplan.in/api/public/unsubscribe?email=${encodeURIComponent(options.to)}`;
  const footerHtml = EMAIL_COMPLIANCE_FOOTER.replace("{{unsubscribe_url}}", unsubscribeUrl);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F0; color: #2B2B28; line-height: 1.6; margin: 0; padding: 24px 12px; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5DFD3; border-radius: 10px; padding: 32px 28px; }
    p { margin: 0 0 16px 0; font-size: 15px; }
    a { color: #4A5A3A; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #B8873B; font-weight: 700; margin-bottom: 20px;">
      The One Page Plan
    </div>
    ${options.bodyText.split("\n\n").map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`).join("")}
    ${options.category === "marketing" ? footerHtml : ""}
  </div>
</body>
</html>`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };

  const payload: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to: [options.to],
    subject: options.subject,
    html: htmlContent,
    text: options.bodyText,
  };

  if (options.category === "marketing") {
    payload["headers"] = {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok || !data?.id) {
      const err = data?.message || `Resend returned HTTP ${res.status}`;
      return { ok: false, error: err };
    }

    return { ok: true, messageId: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
