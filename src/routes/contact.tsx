import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark, BackToHome } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getLegalPolicyFn } from "@/lib/commerce/checkout.server";
import { Mail, MapPin, Building2, Phone } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | The One Page Plan" },
      { name: "description", content: "Contact information and registered office details for The One Page Plan." },
      { property: "og:title", content: "Contact Us | The One Page Plan" },
      { property: "og:description", content: "Contact information and registered office details for The One Page Plan." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.onepageplan.in/contact" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.onepageplan.in/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [data, setData] = useState<{
    businessName: string;
    registeredAddress: string;
    supportEmail: string;
    supportPhone?: string;
    customMarkdown: string | null;
  } | null>(null);

  useEffect(() => {
    void getLegalPolicyFn({ data: { policy: "contact" } }).then((res) => {
      setData({
        businessName: res.businessName,
        registeredAddress: res.registeredAddress,
        supportEmail: res.supportEmail,
        supportPhone: res.supportPhone || "+91 816 966 0060",
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
                    {data?.businessName || "Manrrs Wellness LLP"}
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

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Phone / Mobile Support
                  </p>
                  <p className="text-sm font-medium mt-0.5">
                    <a
                      href="tel:+918169660060"
                      className="text-primary underline underline-offset-4 hover:text-primary/90"
                    >
                      {data?.supportPhone || "+91 816 966 0060"}
                    </a>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Direct phone and WhatsApp assistance.
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
