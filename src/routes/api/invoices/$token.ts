import { createFileRoute } from "@tanstack/react-router";
import { getInvoiceByToken, renderInvoiceHtml } from "@/lib/commerce/invoicing.server";

/**
 * Publicly accessible printable invoice / receipt view secured by random download token.
 * Endpoint: GET /api/invoices/$token
 */
export const Route = createFileRoute("/api/invoices/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params as any).token;
        if (!token) {
          return new Response("Missing invoice token", { status: 400 });
        }

        const invoice = await getInvoiceByToken(token);
        if (!invoice) {
          return new Response("Invoice not found or expired.", { status: 404 });
        }

        const html = renderInvoiceHtml(invoice);
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
