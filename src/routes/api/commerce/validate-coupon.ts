import { createFileRoute } from "@tanstack/react-router";
import { createPublicServerClient } from "@/lib/supabase-public.server";

function formatTierName(tier: string): string {
  switch (tier.toLowerCase()) {
    case "silver":
      return "Silver (The Calm Money System)";
    case "gold":
      return "Gold Tier";
    case "diamond":
      return "Diamond Tier";
    case "money_reality_check":
      return "Money Reality Check";
    case "all":
      return "All Products";
    default:
      return tier.charAt(0).toUpperCase() + tier.slice(1);
  }
}

/**
 * Validates a discount coupon code against active rules in database.
 * Endpoint: POST /api/commerce/validate-coupon
 */
export const Route = createFileRoute("/api/commerce/validate-coupon")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            code?: string;
            product?: string;
            baseAmount?: number;
          };

          const rawCode = (body.code || "").trim();
          if (!rawCode) {
            return Response.json(
              { valid: false, error: "Please enter a coupon code." },
              { status: 400 },
            );
          }

          const cleanCode = rawCode.toUpperCase();
          const targetProduct = ((body.product || "silver").toLowerCase() === "course" ? "silver" : (body.product || "silver")).toLowerCase();
          const baseAmount = Number(body.baseAmount) > 0 ? Number(body.baseAmount) : 6000;

          const db = createPublicServerClient();

          // 1. Fetch coupon definition from database
          const { data: coupon, error } = await db
            .from("discount_codes" as never)
            .select("*")
            .ilike("code" as never, cleanCode as never)
            .maybeSingle();

          if (error || !coupon) {
            return Response.json(
              { valid: false, error: `Coupon code "${cleanCode}" is not valid.` },
              { status: 404 },
            );
          }

          const c = coupon as {
            id: string;
            code: string;
            discount_type: "fixed" | "percentage" | string;
            discount_value: number;
            applies_to_products: string[];
            max_uses: number | null;
            used_count: number;
            expires_at: string | null;
            is_active: boolean;
          };

          // 2. Validate Active status
          if (!c.is_active) {
            return Response.json(
              { valid: false, error: `Coupon "${cleanCode}" is no longer active.` },
              { status: 400 },
            );
          }

          // 3. Validate Expiration date
          if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
            return Response.json(
              { valid: false, error: `Coupon "${cleanCode}" has expired.` },
              { status: 400 },
            );
          }

          // 4. Validate Max Uses
          if (c.max_uses !== null && c.max_uses !== undefined && c.used_count >= c.max_uses) {
            return Response.json(
              { valid: false, error: `Coupon "${cleanCode}" has reached its maximum usage limit.` },
              { status: 400 },
            );
          }

          // 5. Validate Product Applicability
          const appliesTo = Array.isArray(c.applies_to_products)
            ? c.applies_to_products.map((p) => String(p).toLowerCase().trim())
            : ["all"];

          const appliesToAll = appliesTo.includes("all");
          const appliesToTarget =
            appliesTo.includes(targetProduct) ||
            (targetProduct === "silver" && appliesTo.includes("course"));

          if (!appliesToAll && !appliesToTarget) {
            const applicableList = appliesTo.map(formatTierName).join(" or ");
            return Response.json(
              {
                valid: false,
                error: `Coupon "${cleanCode}" is only applicable to ${applicableList}.`,
              },
              { status: 400 },
            );
          }

          // 6. Compute exact discount amount
          let discountAmount = 0;
          if (c.discount_type === "percentage") {
            discountAmount = Math.round((baseAmount * c.discount_value) / 100);
          } else {
            discountAmount = Number(c.discount_value) || 0;
          }

          // Ensure amount payable doesn't fall below ₹1
          if (discountAmount >= baseAmount) {
            discountAmount = Math.max(0, baseAmount - 1);
          }

          const finalAmount = Math.max(1, baseAmount - discountAmount);

          return Response.json({
            valid: true,
            code: c.code,
            discountType: c.discount_type,
            discountValue: c.discount_value,
            discountAmount,
            finalAmount,
            message: `Coupon "${c.code}" applied! You save ₹${discountAmount.toLocaleString("en-IN")}.`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ valid: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
