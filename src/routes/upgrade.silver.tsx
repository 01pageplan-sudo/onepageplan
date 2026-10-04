import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export const Route = createFileRoute("/upgrade/silver")({
  head: () => ({
    meta: [
      { title: "Upgrade to Silver | The One Page Plan" },
      { name: "description", content: "Apply your ₹601 Money Reality Check credit towards The Calm Money System (Silver)." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UpgradeSilverPage,
});

function UpgradeSilverPage() {
  return (
    <CheckoutView
      product="silver"
      isUpgrade={true}
      pagePath="/upgrade/silver"
    />
  );
}
