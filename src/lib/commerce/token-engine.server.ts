import { createPublicServerClient } from "@/lib/supabase-public.server";

/**
 * Escapes characters for safe server-side HTML rendering.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface RenderTokens {
  first_name?: string | undefined;
  product_name?: string | undefined;
  amount_paid?: string | undefined;
  credit_applied?: string | undefined;
  invoice_url?: string | undefined;
  member_area_url?: string | undefined;
  cohort_name?: string | undefined;
  cohort_start_date?: string | undefined;
  bonus_booking_url?: string | undefined;
  bonus?: boolean | undefined;
  upgrade_price?: string | undefined;
  upgrade_end_date?: string | undefined;
  thursday_booking_url?: string | undefined;
  community_url?: string | undefined;
  community?: boolean | undefined;
  gold_price?: string | undefined;
  gold_deadline?: string | undefined;
  access_end_date?: string | undefined;
  new_silver?: boolean | undefined;
  certificate_form?: string | undefined;
  [key: string]: unknown;
}

/**
 * Replaces tokens in HTML templates:
 * - Block conditionals: {{#if key}} content {{/if}}
 * - Token placeholders: {{key}}
 * HTML-escapes all value insertions.
 * Unknown tokens or missing values render as empty and are logged for admin inspection.
 */
export async function renderTemplateWithTokens(
  templateHtml: string,
  tokens: RenderTokens,
  slug: string,
): Promise<{ html: string; unknownTokens: string[]; missingValues: string[] }> {
  let output = templateHtml;
  const unknownTokens: string[] = [];
  const missingValues: string[] = [];

  // 1. Process conditional blocks: {{#if token_name}}...{{/if}}
  // Non-greedy across newlines
  const blockRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  output = output.replace(blockRegex, (_match, key: string, content: string) => {
    const val = tokens[key];
    const isTruthy = Boolean(val) && val !== "false" && val !== "0";
    return isTruthy ? content : "";
  });

  // 2. Process variable placeholders: {{token_name}}
  const varRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  output = output.replace(varRegex, (_match, key: string) => {
    if (!(key in tokens)) {
      if (!unknownTokens.includes(key)) unknownTokens.push(key);
      return "";
    }
    const rawVal = tokens[key];
    if (rawVal === undefined || rawVal === null || rawVal === "") {
      if (!missingValues.includes(key)) missingValues.push(key);
      return "";
    }
    // If the token is raw html widget (like certificate_form), do not double escape
    if (key === "certificate_form") {
      return String(rawVal);
    }
    return escapeHtml(rawVal);
  });

  // 3. Log any warnings asynchronously to database if unknown tokens or missing values detected
  if (unknownTokens.length > 0 || missingValues.length > 0) {
    try {
      const db = createPublicServerClient();
      await db.from("token_render_warnings" as never).insert({
        slug,
        unknown_tokens: unknownTokens,
        missing_values: missingValues,
        context: {
          tokenKeysProvided: Object.keys(tokens),
          timestamp: new Date().toISOString(),
        },
      } as never);
    } catch (logErr) {
      console.warn("[Token Engine] Failed to record token render warning:", logErr);
    }
  }

  return { html: output, unknownTokens, missingValues };
}
