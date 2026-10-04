import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

type PendingSearchParams = {
  order_id?: string | undefined;
};

export const Route = createFileRoute("/payment/pending")({
  validateSearch: (search: Record<string, unknown>): PendingSearchParams => ({
    order_id: typeof search["order_id"] === "string" ? search["order_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment Pending | The One Page Plan" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaymentPendingPage,
});

function PaymentPendingPage() {
  const search = Route.useSearch();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-md w-full px-4 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-xs text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Clock className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900">Payment in Progress</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              We have received your payment and are confirming it with the bank. This usually takes under a minute.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-xs text-gray-500 space-y-2 text-left">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Mail className="h-4 w-4 text-[#4A5A3A]" />
              <span>Next Steps</span>
            </div>
            <p>
              Your official access details and invoice will reach your email shortly once the bank settlement confirms.
            </p>
            {search.order_id ? (
              <p className="text-[11px] text-gray-400 font-mono">
                Order reference: {search.order_id}
              </p>
            ) : null}
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              to="/course"
              className="w-full py-2.5 px-4 bg-[#4A5A3A] text-white rounded-lg font-semibold text-sm hover:opacity-95 transition-opacity"
            >
              Go to Member Area →
            </Link>
            <Link
              to="/"
              className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
