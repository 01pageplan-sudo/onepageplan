import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export const Route = createFileRoute("/checkout/gold")({
  head: () => ({
    meta: [
      { title: "Checkout: The Calm Money System (Gold) | The One Page Plan" },
      { name: "description", content: "Lifetime Gold and Silver access with private advisory sessions." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutGoldPage,
});

function CheckoutGoldPage() {
  return (
    <CheckoutView
      product="gold"
      isUpgrade={false}
      pagePath="/checkout/gold"
    />
  );
}
