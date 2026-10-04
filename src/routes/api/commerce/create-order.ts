import { createFileRoute } from "@tanstack/react-router";
import { computeOrderPricing, type ProductId } from "@/lib/commerce/pricing.server";
import { createRazorpayOrder, getRazorpayMode } from "@/lib/commerce/razorpay.server";
import { createPublicServerClient } from "@/lib/supabase-public.server";

// Simple in-memory rate limiting map (IP/Email -> timestamp)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(key: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const valid = timestamps.filter((t) => now - t < windowMs);
  if (valid.length >= limit) return false;
  valid.push(now);
  rateLimitMap.set(key, valid);
  return true;
}

/**
 * Creates a server-computed Razorpay Order.
 * Browser never provides the price.
 * Endpoint: POST /api/commerce/create-order
 */
export const Route = createFileRoute("/api/commerce/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const clientIp = request.headers.get("x-forwarded-for") || "client";
          if (!checkRateLimit(clientIp, 15, 60000)) {
            return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
          }

          const body = (await request.json().catch(() => ({}))) as {
            product?: ProductId;
            email?: string;
            name?: string;
            phone?: string;
            discountCode?: string;
            referralCode?: string;
            consents?: Record<string, boolean>;
            trafficSource?: Record<string, string>;
          };

          const product = body.product;
          const email = (body.email || "").trim().toLowerCase();

          if (!product || !email) {
            return Response.json(
              { error: "Missing required fields (product and email are required)." },
              { status: 400 },
            );
          }

          // 1. Server Computes Exact Price & Validates Ownership / Windows
          const pricing = await computeOrderPricing({
            product,
            email,
            discountCode: body.discountCode,
            referralCode: body.referralCode,
          });

          if (!pricing.ok) {
            return Response.json(
              {
                error: pricing.error || "Order pricing computation failed.",
                alreadyOwned: pricing.alreadyOwned,
                redirectUrl: pricing.redirectUrl,
              },
              { status: 400 },
            );
          }

          // 2. Create Order in Razorpay Standard Checkout
          const rzpResult = await createRazorpayOrder({
            amountPaise: pricing.amountPaise,
            product,
            email,
            name: body.name,
            phone: body.phone,
            receipt: `rcpt_${Date.now()}`,
            notes: {
              product,
              email,
              name: body.name || "",
              pricing_rule: pricing.pricingRule,
              discount_code: pricing.discountCodeApplied || "",
              referral_code: pricing.referralCode || "",
            },
          });

          if (!rzpResult.ok || !rzpResult.orderId) {
            return Response.json(
              { error: rzpResult.error || "Failed to initialize payment gateway order." },
              { status: 500 },
            );
          }

          // 3. Persist Order in Supabase with 30-Minute Price Lock
          const db = createPublicServerClient();
          const { data: insertedOrder, error: dbError } = await db
            .from("orders" as never)
            .insert({
              razorpay_order_id: rzpResult.orderId,
              product_id: product,
              pricing_rule_applied: pricing.pricingRule,
              base_price: pricing.basePrice,
              credit_applied: pricing.creditApplied,
              discount_code_applied: pricing.discountCodeApplied || null,
              discount_amount: pricing.discountAmount,
              referral_code_applied: pricing.referralCode || null,
              amount_charged: pricing.amountCharged,
              currency: "INR",
              buyer_name: body.name?.trim() || null,
              buyer_email: email,
              buyer_phone: body.phone?.trim() || null,
              consents_captured: body.consents || {},
              traffic_source: body.trafficSource || {},
              status: "created",
              price_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            } as never)
            .select()
            .single();

          if (dbError) {
            console.error("[Commerce] DB error creating order record:", dbError);
          }

          const { signOrderId } = await import("@/lib/commerce/completion.server");
          const orderDbId = (insertedOrder as any)?.id;
          const orderToken = orderDbId ? signOrderId(orderDbId) : "";

          return Response.json({
            ok: true,
            orderId: rzpResult.orderId,
            orderDbId,
            orderToken,
            amount: pricing.amountCharged,
            amountPaise: pricing.amountPaise,
            currency: "INR",
            keyId: rzpResult.keyId,
            mode: getRazorpayMode(),
            pricingRule: pricing.pricingRule,
            discountApplied: pricing.discountAmount > 0,
            discountAmount: pricing.discountAmount,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[Commerce] Order creation exception:", msg);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
