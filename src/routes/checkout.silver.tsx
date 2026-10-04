import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export const Route = createFileRoute("/checkout/silver")({
  head: () => ({
    meta: [
      { title: "Checkout: The Calm Money System (Silver) | The One Page Plan" },
      { name: "description", content: "Lifetime access to the complete Calm Money System and cohort sprints." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutSilverPage,
});

function CheckoutSilverPage() {
  return (
    <CheckoutView
      product="silver"
      isUpgrade={false}
      pagePath="/checkout/silver"
    />
  );
}
