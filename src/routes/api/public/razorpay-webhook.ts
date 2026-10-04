import { createFileRoute } from "@tanstack/react-router";
import { verifyRazorpayWebhookSignature } from "@/lib/commerce/razorpay.server";
import { createPublicServerClient } from "@/lib/supabase-public.server";

/**
 * Razorpay Asynchronous Webhook Endpoint (Single Source of Truth for Access)
 * Ingests payment.captured, payment.failed, and refund.processed events.
 * Guarantees idempotent execution.
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
            service: "One Page Plan Commerce Webhook Listener",
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        // 1. Verify HMAC-SHA256 Signature
        if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
          console.warn("[Razorpay Webhook] Invalid signature rejected");
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const payload = JSON.parse(rawBody) as Record<string, unknown>;
          const event = (payload["event"] as string) || "";
          console.log(`[Razorpay Webhook] Event received: ${event}`);

          const db = createPublicServerClient();

          // 2. Handle Payment Captured / Order Paid
          if (event === "payment.captured" || event === "order.paid") {
            const paymentObj = (
              (payload["payload"] as Record<string, unknown>)?.[
                event === "payment.captured" ? "payment" : "order"
              ] as Record<string, unknown>
            )?.["entity"] as Record<string, unknown> | undefined;

            if (paymentObj) {
              const paymentId = (paymentObj["id"] as string) || "";
              const orderId = (paymentObj["order_id"] as string) || "";
              const amountPaise = (paymentObj["amount"] as number) || 0;
              const email = (
                (paymentObj["email"] as string) ||
                (paymentObj["notes"] as Record<string, string>)?.[ "email"] ||
                ""
              ).toLowerCase();

              // Lookup matching order in database
              const { data: orderRow } = await db
                .from("orders" as never)
                .select("*")
                .or(`razorpay_order_id.eq.${orderId},razorpay_payment_id.eq.${paymentId}` as never)
                .maybeSingle();

              if (orderRow) {
                const ord = orderRow as any;

                // Idempotency: If order is already captured, do not re-process
                if (ord.status === "captured") {
                  console.log(`[Razorpay Webhook] Order ${ord.id} already captured. Skipping.`);
                  return new Response("ok", { status: 200 });
                }

                // Verify amount matches server computation
                if (ord.amount_charged * 100 !== amountPaise) {
                  console.error(
                    `[Razorpay Webhook] Amount mismatch: DB expects ${ord.amount_charged * 100} paise, got ${amountPaise} paise`,
                  );
                  await db.from("reconciliation_flags" as never).insert({
                    razorpay_payment_id: paymentId,
                    razorpay_order_id: orderId,
                    email,
                    amount: amountPaise / 100,
                    issue_type: "amount_mismatch",
                    details: { db_order: ord, webhook_payment: paymentObj },
                  } as never);
                  return new Response("ok", { status: 200 });
                }

                // Grant access, create invoice, and emit events atomically
                const { data: grantResult, error: grantError } = await (db.rpc as any)(
                  "grant_entitlement_on_capture",
                  {
                    p_order_id: ord.id,
                    p_razorpay_payment_id: paymentId,
                  },
                );

                if (grantError) {
                  console.error("[Razorpay Webhook] Error granting entitlement:", grantError);
                } else {
                  console.log(`[Razorpay Webhook] Access granted successfully for order ${ord.id}`);
                  // Prompt 4: Trigger automated purchase messaging & scheduling
                  try {
                    const { handlePurchaseCompletedEvent } = await import("@/lib/messaging/scheduler.server");
                    const consents = ord.consents_captured || {};
                    await handlePurchaseCompletedEvent({
                      orderId: ord.id,
                      email: ord.buyer_email,
                      phone: ord.buyer_phone,
                      name: ord.buyer_name,
                      product: ord.product_id,
                      amount: ord.amount_charged,
                      invoiceUrl: `https://onepageplan.in/course?email=${encodeURIComponent(ord.buyer_email)}`,
                      whatsappConsent: Boolean(consents["whatsapp_consent"]),
                    });
                  } catch (msgErr) {
                    console.warn("[Razorpay Webhook] Error triggering purchase messaging:", msgErr);
                  }
                }
              } else {
                console.warn(
                  `[Razorpay Webhook] Order not found for Razorpay Order ${orderId} / Payment ${paymentId}`,
                );
                await db.from("reconciliation_flags" as never).insert({
                  razorpay_payment_id: paymentId,
                  razorpay_order_id: orderId,
                  email,
                  amount: amountPaise / 100,
                  issue_type: "orphan_razorpay_payment",
                  details: { webhook_payment: paymentObj },
                } as never);
              }
            }
          }

          // 3. Handle Payment Failed
          else if (event === "payment.failed") {
            const paymentObj = (
              (payload["payload"] as Record<string, unknown>)?.[ "payment"] as Record<string, unknown>
            )?.["entity"] as Record<string, unknown> | undefined;

            if (paymentObj) {
              const paymentId = (paymentObj["id"] as string) || "";
              const orderId = (paymentObj["order_id"] as string) || "";
              const email = (
                (paymentObj["email"] as string) ||
                (paymentObj["notes"] as Record<string, string>)?.[ "email"] ||
                ""
              ).toLowerCase();

              // Mark order as failed in database
              await db
                .from("orders" as never)
                .update({ status: "failed" } as never)
                .eq("razorpay_order_id" as never, orderId as never);

              // Record payment_failed event
              await db.from("commerce_events" as never).insert({
                event_name: "payment_failed",
                email,
                payload: {
                  razorpay_payment_id: paymentId,
                  razorpay_order_id: orderId,
                  error_code: paymentObj["error_code"],
                  error_description: paymentObj["error_description"],
                },
              } as never);

              // Prompt 4: Send exactly 1 helpful intimation message
              if (email) {
                try {
                  const { handlePaymentFailedOrAbandoned } = await import("@/lib/messaging/scheduler.server");
                  const notes = (paymentObj["notes"] as Record<string, string>) || {};
                  const prod = notes["product"] || "silver";
                  await handlePaymentFailedOrAbandoned({
                    email,
                    name: notes["name"] || undefined,
                    phone: paymentObj["contact"] as string | undefined,
                    product: prod,
                    checkoutUrl: `https://onepageplan.in/checkout/${prod.replace(/_/g, "-")}?email=${encodeURIComponent(email)}`,
                  });
                } catch (failMsgErr) {
                  console.warn("[Razorpay Webhook] Error sending payment failure intimation:", failMsgErr);
                }
              }
            }
          }

          // 4. Handle Refund Processed
          else if (event === "refund.processed" || event === "payment.refunded") {
            const refundObj = (
              (payload["payload"] as Record<string, unknown>)?.[ "refund"] as Record<string, unknown>
            )?.["entity"] as Record<string, unknown> | undefined;

            const paymentId =
              (refundObj?.["payment_id"] as string) ||
              (((payload["payload"] as Record<string, unknown>)?.[ "payment"] as Record<string, unknown>)?.[ "entity"] as Record<string, unknown>)?.["id"] as string ||
              "";

            if (paymentId) {
              const { data: orderRow } = await db
                .from("orders" as never)
                .select("id")
                .eq("razorpay_payment_id" as never, paymentId as never)
                .maybeSingle();

              if (orderRow) {
                await (db.rpc as any)("revoke_entitlement_on_refund", {
                  p_order_id: (orderRow as any).id,
                });
                console.log(`[Razorpay Webhook] Order ${(orderRow as any).id} refunded and revoked.`);

                // Prompt 4: Cancel all scheduled messages for this product & recipient
                try {
                  const { cancelPendingMessagesForRecipient } = await import("@/lib/messaging/scheduler.server");
                  const { data: ordInfo } = await db.from("orders" as never).select("buyer_email, product_id").eq("id" as never, (orderRow as any).id).maybeSingle();
                  if (ordInfo && (ordInfo as any).buyer_email) {
                    await cancelPendingMessagesForRecipient((ordInfo as any).buyer_email, {
                      productId: (ordInfo as any).product_id,
                    });
                  }
                } catch (cancelErr) {
                  console.warn("[Razorpay Webhook] Error cancelling messages on refund:", cancelErr);
                }
              }
            }
          }
        } catch (err) {
          console.error("[Razorpay Webhook] Payload processing exception:", err);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
