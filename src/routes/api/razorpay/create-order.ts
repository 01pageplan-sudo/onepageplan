import { createFileRoute } from "@tanstack/react-router";
import { createRazorpayOrder } from "@/lib/razorpay.server";

/**
 * Creates a Razorpay order for The Calm Money System (₹6,000 / 600000 paise).
 * Endpoint: POST /api/razorpay/create-order
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
            amountPaise?: number;
          };

          const amount = typeof body.amountPaise === "number" && body.amountPaise > 0
            ? body.amountPaise
            : 600000; // 6,000 INR default

          const result = await createRazorpayOrder({
            amountPaise: amount,
            currency: "INR",
            notes: {
              product: "The Calm Money System",
              email: body.email?.slice(0, 100) || "",
              name: body.name?.slice(0, 100) || "",
              phone: body.phone?.slice(0, 20) || "",
            },
          });

          if (!result.ok) {
            return Response.json({ error: result.error || "order_creation_failed" }, { status: 500 });
          }

          return Response.json({
            ok: true,
            orderId: result.orderId,
            amount: result.amount,
            currency: result.currency,
            keyId: result.keyId,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
