import { createFileRoute } from "@tanstack/react-router";
import { verifyRazorpayWebhookSignature } from "@/lib/commerce/razorpay.server";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import { createHmac, timingSafeEqual } from "crypto";
import { getRazorpayKeySecret } from "@/lib/commerce/razorpay.server";

function verifyPaymentHmac(orderId: string, paymentId: string, signature: string): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  try {
    const text = `${orderId}|${paymentId}`;
    const expected = createHmac("sha256", secret).update(text).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Browser Payment Callback Endpoint: POST /api/razorpay/verify-payment
 * Verifies Razorpay checkout signature.
 * NOTE: Per core architecture, ACCESS IS GRANTED ONLY BY THE WEBHOOK.
 * This endpoint checks if the webhook has completed processing, but does NOT grant access itself.
 */
export const Route = createFileRoute("/api/razorpay/verify-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            orderId?: string;
            paymentId?: string;
            signature?: string;
            email?: string;
          };

          const orderId = body.orderId?.trim();
          const paymentId = body.paymentId?.trim();
          const signature = body.signature?.trim();
          const email = body.email?.trim().toLowerCase();

          if (!orderId || !paymentId || !signature || !email) {
            return Response.json({ error: "missing_required_fields" }, { status: 400 });
          }

          // 1. Verify HMAC-SHA256 signature
          const isValid = verifyPaymentHmac(orderId, paymentId, signature);
          if (!isValid) {
            return Response.json({ error: "invalid_signature" }, { status: 400 });
          }

          // 2. Check if webhook has processed access
          const db = createPublicServerClient();
          const { data: order } = await db
            .from("orders" as never)
            .select("status")
            .eq("razorpay_order_id" as never, orderId as never)
            .maybeSingle();

          const isCaptured = (order as any)?.status === "captured";

          return Response.json({
            ok: true,
            verified: true,
            accessGranted: isCaptured,
            pendingWebhook: !isCaptured,
            redirectUrl: "/course",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
