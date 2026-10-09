import { createFileRoute } from "@tanstack/react-router";
import { computeOrderPricing } from "@/lib/commerce/pricing.server";
import { createRazorpayOrder, getRazorpayMode } from "@/lib/commerce/razorpay.server";
import { createPublicServerClient } from "@/lib/supabase-public.server";

/**
 * Legacy endpoint adapter: POST /api/razorpay/create-order
 * Routes through the new unified commerce pricing and order engine.
 */
export const Route = createFileRoute("/api/razorpay/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            email?: string;
            name?: string;
            phone?: string;
            product?: string;
            discountCode?: string;
          };

          const email = (body.email || "").trim().toLowerCase();
          if (!email) {
            return Response.json({ error: "Email is required." }, { status: 400 });
          }

          const product = (body.product === "money_reality_check" ? "money_reality_check" : "silver");

          const pricing = await computeOrderPricing({
            product,
            email,
            discountCode: body.discountCode,
          });

          if (!pricing.ok) {
            return Response.json({ error: pricing.error || "Pricing calculation failed" }, { status: 400 });
          }

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
            },
          });

          if (!rzpResult.ok || !rzpResult.orderId) {
            return Response.json({ error: rzpResult.error || "Order creation failed" }, { status: 500 });
          }

          const db = createPublicServerClient();
          await db.from("orders" as never).insert({
            razorpay_order_id: rzpResult.orderId,
            product_id: product,
            pricing_rule_applied: pricing.pricingRule,
            base_price: pricing.basePrice,
            credit_applied: pricing.creditApplied,
            discount_code_applied: pricing.discountCodeApplied || null,
            discount_amount: pricing.discountAmount || 0,
            amount_charged: pricing.amountCharged,
            currency: "INR",
            buyer_name: body.name?.trim() || null,
            buyer_email: email,
            buyer_phone: body.phone?.trim() || null,
            status: "created",
            price_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          } as never);

          return Response.json({
            ok: true,
            orderId: rzpResult.orderId,
            amount: pricing.amountCharged,
            amountPaise: pricing.amountPaise,
            currency: "INR",
            keyId: rzpResult.keyId,
            mode: getRazorpayMode(),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
