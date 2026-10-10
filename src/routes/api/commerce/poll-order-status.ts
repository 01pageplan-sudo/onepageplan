import { createFileRoute } from "@tanstack/react-router";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import { verifyOrderSignature } from "@/lib/commerce/completion.server";

/**
 * Checks order status for completion page polling.
 * Endpoint: GET /api/commerce/poll-order-status?order_id=...&token=...
 */
export const Route = createFileRoute("/api/commerce/poll-order-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("order_id") || "";
        const token = url.searchParams.get("token") || "";

        if (!orderId) {
          return Response.json({ ok: false, error: "Missing order_id" }, { status: 400 });
        }

        if (!token) {
          return Response.json(
            { ok: false, authorized: false, error: "Missing order verification token" },
            { status: 401 },
          );
        }

        const db = createPublicServerClient();
        const { data: order, error } = await db
          .from("orders" as never)
          .select("id, razorpay_order_id, status, buyer_email, product_id")
          .or(`id.eq.${orderId},razorpay_order_id.eq.${orderId}` as never)
          .maybeSingle();

        if (error || !order) {
          return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
        }

        const ord = order as any;
        const isValid = Boolean(
          verifyOrderSignature(ord.id, token) ||
            (ord.razorpay_order_id && verifyOrderSignature(ord.razorpay_order_id, token)),
        );

        if (!isValid) {
          return Response.json(
            { ok: false, authorized: false, error: "Invalid order verification token" },
            { status: 403 },
          );
        }

        return Response.json({
          ok: true,
          orderId: ord.id,
          status: ord.status,
          captured: ord.status === "captured",
          authorized: true,
          token,
        });
      },
    },
  },
});

