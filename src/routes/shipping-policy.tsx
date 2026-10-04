import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark, BackToHome } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getLegalPolicyFn } from "@/lib/commerce/checkout.server";

export const Route = createFileRoute("/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping & Delivery Policy | The One Page Plan" },
      { name: "description", content: "Digital access delivery and physical shipment terms for course completers." },
    ],
  }),
  component: ShippingPolicyPage,
});

function ShippingPolicyPage() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getLegalPolicyFn({ data: { policy: "shipping" } }).then((res) => {
      setContent(res.customMarkdown);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
            <Wordmark />
            <BackToHome />
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="text-[clamp(1.75rem,4.5vw,2.5rem)] font-bold leading-tight">
            Shipping & Delivery Policy
          </h1>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {loading ? (
              <p className="animate-pulse">Loading policy details...</p>
            ) : content ? (
              <div className="text-foreground/90">{content}</div>
            ) : (
              <p className="text-base font-medium text-foreground">This policy is being updated.</p>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
