import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

type FailedSearchParams = {
  from?: string | undefined;
};

export const Route = createFileRoute("/payment/failed")({
  validateSearch: (search: Record<string, unknown>): FailedSearchParams => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment Not Completed | The One Page Plan" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaymentFailedPage,
});

function PaymentFailedPage() {
  const search = Route.useSearch();
  const backHref = search.from && search.from.startsWith("/") ? search.from : "/checkout/silver";

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-md w-full px-4 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-xs text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900">Payment not completed</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              Nothing was charged to your account.
            </p>
          </div>

          <p className="text-xs text-gray-500">
            If this was an accident or your bank app declined the transaction, you can try again anytime. No duplicate charges will occur.
          </p>

          <div className="pt-2 flex flex-col gap-2.5">
            <a
              href={backHref}
              className="w-full py-2.5 px-4 bg-[#4A5A3A] text-white rounded-lg font-semibold text-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Try Again at Checkout
            </a>
            <Link
              to="/"
              className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
