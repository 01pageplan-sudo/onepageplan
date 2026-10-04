import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export const Route = createFileRoute("/upgrade/gold")({
  head: () => ({
    meta: [
      { title: "Special Upgrade to Gold | The One Page Plan" },
      { name: "description", content: "Exclusive special upgrade price to Gold for Silver completers." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UpgradeGoldPage,
});

function UpgradeGoldPage() {
  return (
    <CheckoutView
      product="gold"
      isUpgrade={true}
      pagePath="/upgrade/gold"
    />
  );
}
