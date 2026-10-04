import { createFileRoute } from "@tanstack/react-router";
import { runCommerceReconciliation } from "@/lib/commerce/reconciliation.server";

/**
 * Daily Commerce Reconciliation Endpoint
 * Compares Razorpay captured payments against database orders and entitlements.
 * Endpoint: POST /api/commerce/reconcile
 */
export const Route = createFileRoute("/api/commerce/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = request.headers.get("x-cron-secret");
        const expectedSecret = process.env["CRON_SHARED_SECRET"] || process.env["ADMIN_PASSWORD"];

        // Allow if matching cron secret or internal call
        if (expectedSecret && cronSecret !== expectedSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const report = await runCommerceReconciliation();
        return Response.json(report);
      },
    },
  },
});
