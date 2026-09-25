import { createFileRoute } from "@tanstack/react-router";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay.server";

/**
 * Razorpay Asynchronous Webhook Endpoint
 * Ingests payment.captured and order.paid events as a safety net.
 * Endpoint: /api/public/razorpay-webhook
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "active",
            endpoint: "/api/public/razorpay-webhook",
            service: "Razorpay Webhook Listener",
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
          console.warn("[Razorpay Webhook] Invalid signature rejected");
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const payload = JSON.parse(rawBody) as Record<string, unknown>;
          const event = (payload["event"] as string) || "";
          console.log(`[Razorpay Webhook] Event received: ${event}`);

          if (event === "payment.captured" || event === "order.paid") {
            const paymentObj = (
              (payload["payload"] as Record<string, unknown>)?.[
                event === "payment.captured" ? "payment" : "order"
              ] as Record<string, unknown>
            )?.["entity"] as Record<string, unknown> | undefined;

            if (paymentObj) {
              const email = (
                (paymentObj["email"] as string) ||
                (paymentObj["notes"] as Record<string, string>)?.[ "email"] ||
                ""
              ).toLowerCase();
              const paymentId = (paymentObj["id"] as string) || "";
              const orderId = (paymentObj["order_id"] as string) || "";
              const amountPaise = (paymentObj["amount"] as number) || 600000;
              const amountInr = amountPaise / 100;

              if (email && paymentId) {
                const { createPublicServerClient } = await import("@/lib/supabase-public.server");
                await (createPublicServerClient().rpc as any)("record_successful_payment", {
                  p_email: email,
                  p_amount: amountInr,
                  p_order_id: orderId,
                  p_payment_id: paymentId,
                  p_signature: signature || "webhook_captured",
                  p_notes: paymentObj["notes"] as never,
                });
                console.log(`[Razorpay Webhook] Payment recorded for ${email}`);
              }
            }
          }
        } catch (err) {
          console.error("[Razorpay Webhook] Error processing payload:", err);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
