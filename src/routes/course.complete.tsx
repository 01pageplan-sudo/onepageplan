import { createFileRoute, Link } from "@tanstack/react-router";
import { getActiveTemplateHtml } from "@/lib/commerce/templates.server";
import { renderTemplateWithTokens } from "@/lib/commerce/token-engine.server";
import { formatRupees } from "@/lib/commerce/pricing.server";
import { formatPlainDate } from "@/lib/commerce/completion.server";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import { CourseRewardForm } from "@/components/commerce/CourseRewardForm";
import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Sparkles, Trophy, ArrowRight, ShieldAlert } from "lucide-react";

type SearchParams = {
  email?: string;
};

export const Route = createFileRoute("/course/complete")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ email: search.email }),
  loader: async ({ deps }) => {
    const cleanEmail = (deps.email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return { authorized: false, isCompleter: false };
    }

    const db = createPublicServerClient();

    // Verify member has silver access
    const { data: grant } = await db
      .from("member_access_grants" as never)
      .select("*, cohorts(*)")
      .eq("email" as never, cleanEmail)
      .eq("access_tier" as never, "silver")
      .eq("status" as never, "active")
      .maybeSingle();

    if (!grant) {
      return { authorized: false, isCompleter: false };
    }

    // Check completion record
    const { data: completion } = await db
      .from("course_completions" as never)
      .select("*")
      .eq("email" as never, cleanEmail)
      .maybeSingle();

    // Check settings for Gold price
    const { data: settings } = await db
      .from("commerce_settings" as never)
      .select("*")
      .eq("id" as never, 1)
      .maybeSingle();

    const gRow = grant as any;
    const cRow = completion as any;
    const sRow = settings as any;

    const goldPrice = sRow?.gold_completer_price ? formatRupees(sRow.gold_completer_price) : "₹18,001";
    const goldDeadline = formatPlainDate(cRow?.gold_upgrade_deadline);

    // Fetch custom template if any
    const { html: rawHtml, isCustom } = await getActiveTemplateHtml("course-complete");

    let renderedHtml = "";
    if (isCustom) {
      // If custom template uploaded, render it with token replacements
      const rendered = await renderTemplateWithTokens(
        rawHtml,
        {
          first_name: cleanEmail.split("@")[0],
          cohort_name: gRow.cohorts?.name || "Cohort",
          gold_price: goldPrice,
          gold_deadline: goldDeadline,
          certificate_form: `<div id="opp-reward-form-anchor"></div>`,
        },
        "course-complete"
      );
      renderedHtml = rendered.html;
    }

    return {
      authorized: true,
      email: cleanEmail,
      isCustomTemplate: isCustom,
      customHtml: renderedHtml,
      cohortName: gRow.cohorts?.name || "Cohort",
      goldPrice,
      goldDeadline,
      rewardSubmitted: Boolean(cRow?.reward_submitted_at),
      certificateName: cRow?.certificate_name || "",
    };
  },
  head: () => ({
    meta: [
      { title: "Course Completed | The Calm Money System" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CourseCompletePage,
});

function CourseCompletePage() {
  const data = Route.useLoaderData();

  if (!data.authorized || !data.email) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Wordmark />
          </div>
        </header>

        <main className="mx-auto max-w-md w-full px-4 py-16 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-amber-600 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Member Verification Required</h1>
          <p className="text-xs text-gray-600">
            Please log into your member account at The Calm Money System to access your completion status and rewards.
          </p>
          <div className="pt-2">
            <Link
              to="/course"
              className="inline-block py-2.5 px-6 bg-[#4A5A3A] text-white rounded-lg font-semibold text-xs"
            >
              Go to Member Login →
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If custom HTML is present and contains the anchor
  if (data.isCustomTemplate && data.customHtml) {
    return (
      <div className="opp-completion-container w-full min-h-screen">
        <div dangerouslySetInnerHTML={{ __html: data.customHtml }} />
        {/* Render reward form */}
        <div className="max-w-md mx-auto px-4 pb-16">
          <CourseRewardForm
            email={data.email}
            defaultName={data.certificateName}
            isAlreadySubmitted={data.rewardSubmitted}
          />
        </div>
      </div>
    );
  }

  // Native site style completion view with Reward form and Gold offer
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Wordmark />
          <Link
            to="/course"
            className="text-xs font-semibold text-[#4A5A3A] hover:underline"
          >
            ← Back to Lessons
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl w-full px-4 py-10 space-y-8">
        {/* Celebration header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-xs">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Congratulations on Completing the Course!
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            You have executed all required core modules in The Calm Money System. Your one-page financial plan is now structured and actionable.
          </p>
        </div>

        {/* Reward Form Widget */}
        <CourseRewardForm
          email={data.email}
          defaultName={data.certificateName}
          isAlreadySubmitted={data.rewardSubmitted}
        />

        {/* Gold Completer Special Upgrade Offer Card */}
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Gold Completer Opportunity
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900">
              Upgrade to Gold Master Access
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Silver completers qualify for the special upgrade price of{" "}
              <strong className="text-gray-900 font-bold">{data.goldPrice}</strong> (standard ₹24,000).
              {data.goldDeadline ? ` Available until ${data.goldDeadline}.` : ""}
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/upgrade/gold"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              View Your Special Upgrade Price →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
