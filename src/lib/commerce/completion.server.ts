import { createHmac } from "crypto";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import { formatRupees, type ProductId } from "@/lib/commerce/pricing.server";
import { getActiveTemplateHtml } from "@/lib/commerce/templates.server";
import { renderTemplateWithTokens, type RenderTokens } from "@/lib/commerce/token-engine.server";

const SECRET_SALT = process.env["COMMERCE_SIGNING_SECRET"] || "onepageplan_completion_token_secret_salt_2026";

/**
 * Creates an HMAC signature for an order ID to allow tamper-proof completion page access.
 */
export function signOrderId(orderId: string): string {
  return createHmac("sha256", SECRET_SALT).update(orderId).digest("hex");
}

/**
 * Verifies that the HMAC signature matches the order ID.
 */
export function verifyOrderSignature(orderId: string, signature: string): boolean {
  if (!orderId || !signature) return false;
  const expected = signOrderId(orderId);
  return expected === signature;
}

/**
 * Formats a Date object or ISO string to plain format: e.g. "2 November 2026"
 */
export function formatPlainDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export interface CompletionPageResult {
  status: "ready" | "polling" | "unauthorized" | "not_found";
  html?: string | undefined;
  orderId?: string | undefined;
  orderDbId?: string | undefined;
  amountCharged?: number | undefined;
  productName?: string | undefined;
  buyerEmail?: string | undefined;
  buyerName?: string | undefined;
  alreadyFiredPixelKey?: string | undefined;
  invoiceUrl?: string | undefined;
  memberAreaUrl?: string | undefined;
  unknownTokens?: string[] | undefined;
  missingValues?: string[] | undefined;
}

/**
 * Resolves order data, verifies access guards, constructs token values, and renders template.
 */
export async function getRenderedCompletionPage(
  slug: string,
  orderId: string | undefined,
  token: string | undefined,
  userEmail: string | undefined,
): Promise<CompletionPageResult> {
  if (!orderId) {
    return { status: "unauthorized" };
  }

  const db = createPublicServerClient();

  // 1. Fetch order
  const { data: orderRow, error: orderErr } = await db
    .from("orders" as never)
    .select("*")
    .or(`id.eq.${orderId},razorpay_order_id.eq.${orderId}` as never)
    .maybeSingle();

  if (orderErr || !orderRow) {
    return { status: "not_found" };
  }

  const order = orderRow as any;

  // 2. Validate authorization: either signature token matches OR logged in user matches buyer_email
  const isTokenValid = token && verifyOrderSignature(order.id, token);
  const isOwnerEmail = userEmail && userEmail.trim().toLowerCase() === order.buyer_email?.trim().toLowerCase();

  if (!isTokenValid && !isOwnerEmail) {
    return { status: "unauthorized" };
  }

  // 3. Check capture status: if not captured, client needs to poll
  if (order.status !== "captured") {
    return {
      status: "polling",
      orderId: order.id,
      buyerEmail: order.buyer_email,
    };
  }

  // 4. Fetch invoice record for download URL
  const { data: invoiceRow } = await db
    .from("invoices" as never)
    .select("download_token, invoice_number")
    .eq("order_id" as never, order.id)
    .maybeSingle();

  const invoiceToken = (invoiceRow as any)?.download_token;
  const invoiceUrl = invoiceToken ? `/api/invoices/${invoiceToken}` : "/course";

  // 5. Fetch member access grant for cohort and bonus info
  const { data: grantRow } = await db
    .from("member_access_grants" as never)
    .select("*, cohorts(*)")
    .eq("order_id" as never, order.id)
    .maybeSingle();

  const grant = grantRow as any;
  const cohort = grant?.cohorts;

  // 6. Fetch settings
  const { data: settingsRow } = await db
    .from("commerce_settings" as never)
    .select("*")
    .eq("id" as never, 1)
    .maybeSingle();

  const settings = settingsRow as any;

  // Extract buyer's first name
  const fullName = (order.buyer_name || "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "Member";

  // Product friendly names
  const productNames: Record<ProductId, string> = {
    money_reality_check: "Money Reality Check",
    silver: "The Calm Money System (Silver)",
    gold: "Gold Master Access",
    diamond: "Diamond Elite Access",
    diamond_renewal: "Diamond Elite Access (Renewal)",
  };

  const productName = productNames[order.product_id as ProductId] || order.product_id;

  // 7. Assemble all token variables
  const tokens: RenderTokens = {
    first_name: firstName,
    product_name: productName,
    amount_paid: formatRupees(order.amount_charged),
    credit_applied: order.credit_applied > 0 ? formatRupees(order.credit_applied) : "",
    invoice_url: invoiceUrl,
    member_area_url: `/course?email=${encodeURIComponent(order.buyer_email)}`,
    cohort_name: cohort?.name || (grant?.cohort_id ? "Cohort" : ""),
    cohort_start_date: formatPlainDate(cohort?.start_date),
    bonus_booking_url: grant?.has_one_on_one_bonus
      ? (settings?.bonus_booking_url || "https://calendly.com/milan-dodhia/30min")
      : "",
    bonus: Boolean(grant?.has_one_on_one_bonus),
    upgrade_price: grant?.locked_silver_upgrade_price
      ? formatRupees(grant.locked_silver_upgrade_price)
      : "",
    upgrade_end_date: formatPlainDate(grant?.silver_upgrade_deadline),
    thursday_booking_url: settings?.thursday_guest_booking_url || "",
    community_url: settings?.community_url || "",
    community: Boolean(settings?.community_url && settings.community_url.trim().length > 0),
    gold_price: settings?.gold_completer_price ? formatRupees(settings.gold_completer_price) : "₹18,001",
    gold_deadline: formatPlainDate(grant?.gold_upgrade_deadline),
    access_end_date: formatPlainDate(grant?.expires_at),
    new_silver: Boolean(order.product_id === "silver" || (order.product_id === "gold" && !grant?.parent_product)),
  };

  // 8. Fetch active HTML template & render
  const { html: rawHtml } = await getActiveTemplateHtml(slug);
  const { html, unknownTokens, missingValues } = await renderTemplateWithTokens(rawHtml, tokens, slug);

  return {
    status: "ready",
    html,
    orderId: order.id,
    orderDbId: order.id,
    amountCharged: order.amount_charged,
    productName,
    buyerEmail: order.buyer_email,
    buyerName: fullName,
    alreadyFiredPixelKey: `opp_purchase_fired_${order.id}`,
    invoiceUrl,
    memberAreaUrl: tokens.member_area_url,
    unknownTokens,
    missingValues,
  };
}
