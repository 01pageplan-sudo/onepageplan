import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark, BackToHome } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getLegalPolicyFn } from "@/lib/commerce/checkout.server";
import { Mail, MapPin, Building2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | The One Page Plan" },
      { name: "description", content: "Contact information and registered office details for The One Page Plan." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [data, setData] = useState<{
    businessName: string;
    registeredAddress: string;
    supportEmail: string;
    customMarkdown: string | null;
  } | null>(null);

  useEffect(() => {
    void getLegalPolicyFn({ data: { policy: "contact" } }).then((res) => {
      setData({
        businessName: res.businessName,
        registeredAddress: res.registeredAddress,
        supportEmail: res.supportEmail,
        customMarkdown: res.customMarkdown,
      });
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
            Contact Us
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Have questions about the masterclass, course materials, or your enrollment?
          </p>

          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Operating Entity
                  </p>
                  <p className="text-base font-semibold text-foreground mt-0.5">
                    {data?.businessName || "The One Page Plan by Milanaire (Mannrs Wellness LLP)"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Registered Address
                  </p>
                  <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed">
                    {data?.registeredAddress || "Bandra West, Mumbai 400050, Maharashtra, India"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Electronic Support
                  </p>
                  <p className="text-sm font-medium mt-0.5">
                    <a
                      href="mailto:connect@onepageplan.in"
                      className="text-primary underline underline-offset-4 hover:text-primary/90"
                    >
                      connect@onepageplan.in
                    </a>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Response turnaround within 1-2 business days.
                  </p>
                </div>
              </div>
            </div>

            {data?.customMarkdown ? (
              <div className="mt-6 text-sm text-foreground/90 whitespace-pre-wrap">
                {data.customMarkdown}
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
