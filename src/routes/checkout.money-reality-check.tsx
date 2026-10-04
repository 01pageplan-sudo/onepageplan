import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export const Route = createFileRoute("/checkout/money-reality-check")({
  head: () => ({
    meta: [
      { title: "Checkout: Money Reality Check | The One Page Plan" },
      { name: "description", content: "Instant access to 12 diagnostic sessions and financial calculators." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutMrcPage,
});

function CheckoutMrcPage() {
  return (
    <CheckoutView
      product="money_reality_check"
      isUpgrade={false}
      pagePath="/checkout/money-reality-check"
    />
  );
}
