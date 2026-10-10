import { createFileRoute } from "@tanstack/react-router";
import { getRenderedCompletionPage } from "@/lib/commerce/completion.server";
import { CompletionView } from "@/components/commerce/CompletionView";

type SearchParams = {
  order_id?: string;
  token?: string;
};

export const Route = createFileRoute("/complete/money-reality-check")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    order_id: typeof search["order_id"] === "string" ? search["order_id"] : undefined,
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
  loaderDeps: ({ search }) => ({
    orderId: search.order_id,
    token: search.token,
  }),
  loader: async ({ deps }) => {
    return await getRenderedCompletionPage(
      "money-reality-check",
      deps.orderId,
      deps.token,
    );
  },
  head: () => ({
    meta: [
      { title: "Order Confirmed | Money Reality Check" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CompletionMoneyRealityCheckPage,
});

function CompletionMoneyRealityCheckPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <CompletionView
      slug="money-reality-check"
      orderId={search.order_id}
      token={search.token}
      initialStatus={data.status}
      initialHtml={data.html}
      amountCharged={data.amountCharged}
      productName={data.productName}
      orderDbId={data.orderDbId}
    />
  );
}
