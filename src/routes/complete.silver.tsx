import { createFileRoute } from "@tanstack/react-router";
import { getRenderedCompletionPage } from "@/lib/commerce/completion.server";
import { CompletionView } from "@/components/commerce/CompletionView";

type SearchParams = {
  order_id?: string;
  token?: string;
  email?: string;
};

export const Route = createFileRoute("/complete/silver")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    order_id: typeof search["order_id"] === "string" ? search["order_id"] : undefined,
    token: typeof search["token"] === "string" ? search["token"] : undefined,
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  loaderDeps: ({ search }) => ({
    orderId: search.order_id,
    token: search.token,
    email: search.email,
  }),
  loader: async ({ deps }) => {
    return await getRenderedCompletionPage("silver", deps.orderId, deps.token, deps.email);
  },
  head: () => ({
    meta: [
      { title: "Welcome to The Calm Money System | One Page Plan" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CompletionSilverPage,
});

function CompletionSilverPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <CompletionView
      slug="silver"
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
