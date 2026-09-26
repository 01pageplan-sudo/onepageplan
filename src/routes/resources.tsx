import { createFileRoute } from "@tanstack/react-router";
import { Download, ExternalLink, FileSpreadsheet, FileText, CheckCircle2, Calendar, Sparkles, Shield, ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";

const TITLE = "Your Masterclass Toolkits & Templates | The One Page Plan";
const DESCRIPTION = "Download your One Page Plan template, the Real Return Google Sheet calculator, and the Family Protection checklist from The Money Reality Masterclass.";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const googleSheetUrl =
    (import.meta.env["VITE_GOOGLE_SHEET_CALCULATOR_URL"] as string | undefined) ||
    "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/copy";

  const onePagePdfUrl =
    (import.meta.env["VITE_ONE_PAGE_PLAN_PDF_URL"] as string | undefined) ||
    "/downloads/one-page-plan-template.pdf";

  const mwpChecklistPdfUrl =
    (import.meta.env["VITE_MWP_CHECKLIST_PDF_URL"] as string | undefined) ||
    "/downloads/family-nomination-mwp-checklist.pdf";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-20">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <Wordmark />
            <a
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              ← Back to Overview
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-12 space-y-12">
          {/* Hero Heading */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Masterclass Attendee Resources</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Your 3 Masterclass Toolkits
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Everything promised during Saturday’s session. Built for you to print, fill out with your family, and keep forever.
            </p>
          </div>

          {/* 3 Free Toolkits Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Tool 1: One Page Plan Template */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-xs hover:border-primary/40 transition-all">
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brass)]">
                    1-Page Printable PDF
                  </span>
                  <h3 className="text-base font-bold text-foreground mt-1">
                    The One Page Plan Template
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    A clean, single A4 sheet to consolidate every asset, debt, policy, and your single money priority in one place.
                  </p>
                </div>
              </div>
              <div className="pt-6">
                <Button asChild className="w-full text-xs" variant="default">
                  <a href={onePagePdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download PDF (A4)
                  </a>
                </Button>
              </div>
            </div>

            {/* Tool 2: Real Return Calculator (Google Sheet) */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-xs hover:border-emerald-500/40 transition-all">
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Google Sheet (With Formulas)
                  </span>
                  <h3 className="text-base font-bold text-foreground mt-1">
                    Real Return & Tax Drag Calculator
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Input your holdings to calculate real purchasing power after 30% tax drag and 6% inflation. Pre-formatted with locked formulas.
                  </p>
                </div>
              </div>
              <div className="pt-6">
                <Button asChild className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a href={googleSheetUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Make a Copy (Google Sheet)
                  </a>
                </Button>
              </div>
            </div>

            {/* Tool 3: Family Protection Checklist */}
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-xs hover:border-primary/40 transition-all">
              <div className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brass)]">
                    1-Page Printable PDF
                  </span>
                  <h3 className="text-base font-bold text-foreground mt-1">
                    Nomination & MWP Act Checklist
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Audit single vs joint accounts, resolve legal heir mismatches, and learn how to invoke Section 6 of the MWP Act.
                  </p>
                </div>
              </div>
              <div className="pt-6">
                <Button asChild className="w-full text-xs" variant="outline">
                  <a href={mwpChecklistPdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download Checklist (PDF)
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* UPCOMING LIVE COHORT CARD */}
          <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Calendar className="h-3.5 w-3.5" />
                  Upcoming Live Cohort · Late October / November
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground">
                  The Calm Money System
                </h2>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl font-bold text-primary">₹6,000</span>
                <span className="text-xs text-muted-foreground block">Lifetime Membership · Live Cohort Included</span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              The 3 tools above give you the clarity. The Calm Money System gives you the execution: three live deep-dive cohort sessions with Milan Dodhia, followed by 90-day missions, full community support, and VIP legal/insurance toolkits.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 text-xs text-foreground/90">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>3 Live Interactive Cohort Days</strong> with Milan (Live Q&A + personal reviews)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>VIP Bonus 1:</strong> Simple Indian Will & Estate Planning Masterclass</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>90-Day Execution Missions:</strong> 14-Day Pruning Sprint & Automated Cash Flow</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>VIP Bonus 2:</strong> High-Net-Worth Health Insurance Audit</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto font-semibold">
                <a href="/course">
                  Explore Curriculum & Reserve Your Seat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Limited cohort size to allow personal walkthroughs.
              </span>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
