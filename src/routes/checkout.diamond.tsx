import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export const Route = createFileRoute("/checkout/diamond")({
  head: () => ({
    meta: [
      { title: "Checkout: The Calm Money System (Diamond) | The One Page Plan" },
      { name: "description", content: "Diamond 12-month private office advisory and lifetime Silver + Gold access." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutDiamondPage,
});

function CheckoutDiamondPage() {
  return (
    <CheckoutView
      product="diamond"
      isUpgrade={false}
      pagePath="/checkout/diamond"
    />
  );
}
