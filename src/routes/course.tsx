import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Lock,
  Play,
  ShieldAlert,
  Sparkles,
  BookOpen,
  Download,
  MessageSquare,
  Send,
  FileText,
  Gift,
  Award,
  Zap,
  HelpCircle,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  LockKeyhole,
  PlayCircle,
  Eye,
  AlertCircle,
  Tag,
  Loader2,
} from "lucide-react";

import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ProtectedVideoPlayer } from "@/components/site/ProtectedVideoPlayer";
import { RazorpayButton } from "@/components/site/RazorpayButton";
import { CourseLoginView } from "@/components/course/CourseLoginView";
import { supabase } from "@/integrations/supabase/client";

type CourseSearchParams = {
  email?: string | undefined;
};

export const Route = createFileRoute("/course")({
  validateSearch: (search: Record<string, unknown>): CourseSearchParams => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "The Calm Money System | Member Portal" },
      { name: "description", content: "Recorded video curriculum and implementation framework." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CoursePortalPage,
});

export const checkAccessFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getAuthenticatedUser, syncUserEntitlements } = await import("@/lib/auth/server-auth");
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return {
        ok: false,
        authenticated: false,
        hasAccess: false,
        email: null,
        userId: null,
        isAdmin: false,
        tiers: null,
        error: error || "unauthenticated",
      };
    }

    // Associate existing historical purchases and grants with user ID
    await syncUserEntitlements(user.id, user.email);

    if (user.isAdmin) {
      return {
        ok: true,
        authenticated: true,
        hasAccess: true,
        email: user.email,
        userId: user.id,
        isAdmin: true,
        tiers: { canViewMrc: true, canViewSilver: true, canViewGold: true, canViewDiamond: true },
      };
    }

    const { getMemberEntitledTiers } = await import("@/lib/commerce/video-access.server");
    const tiers = await getMemberEntitledTiers(user.email, user.id);
    const hasAnyTier = tiers.canViewMrc || tiers.canViewSilver || tiers.canViewGold || tiers.canViewDiamond;

    return {
      ok: true,
      authenticated: true,
      hasAccess: hasAnyTier,
      email: user.email,
      userId: user.id,
      isAdmin: false,
      tiers: hasAnyTier ? tiers : null,
    };
  });

export const getLessonVideoFn = createServerFn({ method: "POST" })
  .validator((data: { lessonId: string }) => data)
  .handler(async ({ data }) => {
    const { getAuthenticatedUser } = await import("@/lib/auth/server-auth");
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return { ok: false, error: "unauthenticated" };
    }

    const { getEntitledLessonVideo } = await import("@/lib/commerce/video-access.server");
    return await getEntitledLessonVideo({
      email: user.email,
      userId: user.id,
      lessonId: data.lessonId,
    });
  });

export const recordLessonCompletionFn = createServerFn({ method: "POST" })
  .validator((data: { lessonId: string }) => data)
  .handler(async ({ data }) => {
    const lessonId = (data.lessonId || "").trim();
    if (!lessonId) {
      return { ok: false, error: "invalid_lesson" };
    }

    const { getAuthenticatedUser } = await import("@/lib/auth/server-auth");
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return { ok: false, error: "unauthenticated" };
    }

    const { getMemberEntitledTiers } = await import("@/lib/commerce/video-access.server");
    const tiers = await getMemberEntitledTiers(user.email, user.id);
    if (!tiers.canViewSilver && !user.isAdmin) {
      return { ok: false, error: "forbidden" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { REQUIRED_SILVER_CORE_LESSONS } = await import("@/lib/commerce/completion.server");

    // 1. Prefer atomic PostgreSQL RPC
    const { data: rpcData, error: rpcError } = await (supabaseAdmin.rpc as any)(
      "record_course_lesson_completion",
      {
        p_user_id: user.id,
        p_email: user.email,
        p_lesson_id: lessonId,
      },
    );

    if (!rpcError && rpcData) {
      return { ok: true, ...(rpcData as Record<string, unknown>) };
    }

    // 2. Fallback table persistence if RPC is not yet loaded in schema cache
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("course_completions" as never)
      .select("*")
      .eq("email" as never, user.email as never)
      .maybeSingle();

    if (fetchErr) {
      return { ok: false, error: fetchErr.message };
    }

    const row = existing as {
      id?: string;
      user_id?: string | null;
      completed_lessons?: unknown;
      is_completed?: boolean | null;
      completed_at?: string | null;
    } | null;

    if (row?.user_id && row.user_id !== user.id) {
      return { ok: false, error: "unauthorized" };
    }

    const currentLessons = Array.isArray(row?.completed_lessons)
      ? row!.completed_lessons.filter((x): x is string => typeof x === "string")
      : [];

    const nextLessons = currentLessons.includes(lessonId)
      ? currentLessons
      : [...currentLessons, lessonId];

    const allCoreDone = REQUIRED_SILVER_CORE_LESSONS.every((reqId) =>
      nextLessons.includes(reqId),
    );
    const isCompleted = Boolean(row?.is_completed === true || allCoreDone);
    const completedAt = isCompleted
      ? row?.completed_at || new Date().toISOString()
      : null;

    if (row?.id) {
      const { error: updateErr } = await supabaseAdmin
        .from("course_completions" as never)
        .update({
          user_id: user.id,
          completed_lessons: nextLessons,
          is_completed: isCompleted,
          completed_at: completedAt,
        } as never)
        .eq("id" as never, row.id as never);

      if (updateErr) {
        return { ok: false, error: updateErr.message };
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from("course_completions" as never)
        .insert({
          email: user.email,
          user_id: user.id,
          completed_lessons: nextLessons,
          is_completed: isCompleted,
          completed_at: completedAt,
        } as never);

      if (insertErr) {
        return { ok: false, error: insertErr.message };
      }
    }

    return {
      ok: true,
      completed_lessons: nextLessons,
      is_completed: isCompleted,
      completed_at: completedAt,
    };
  });

export type CourseMaterial = {
  title: string;
  type: "pdf" | "excel" | "template" | "link";
  url: string;
  size?: string;
};

export type CourseLesson = {
  id: string;
  title: string;
  duration: string;
  durationSeconds: number; // Duration in seconds for tracking
  minWatchSeconds: number; // Minimum play time required to automatically complete
  desc: string;
  provider?: "bigvu" | "youtube" | "custom";
  videoUrl?: string;
  videoId?: string;
  materials?: CourseMaterial[];
  takeaways?: string[];
};

export type CourseSection = {
  id: string;
  category: "mrc" | "core" | "implementation" | "bonuses";
  categoryLabel: string;
  sectionTitle: string;
  lessons: CourseLesson[];
};

export const COURSE_SECTIONS: CourseSection[] = [
  {
    id: "sec-mrc",
    category: "mrc",
    categoryLabel: "Money Reality Check",
    sectionTitle: "Money Reality Check: 12 Diagnostic Sessions",
    lessons: [
      {
        id: "mrc-01",
        title: "Session 1: Unearthing Scattered Bank Accounts & Folios",
        duration: "15 mins",
        durationSeconds: 900,
        minWatchSeconds: 60,
        desc: "Systematically tracking every bank account, FD, and folio.",
        provider: "bigvu",
        materials: [{ title: "Bank & Folio Diagnostic Sheet (PDF)", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf" }],
        takeaways: ["Identify idle savings accounts", "Locate lost MF folios"],
      },
      {
        id: "mrc-02",
        title: "Session 2: Real Asset vs Nominal Asset Clarity",
        duration: "18 mins",
        durationSeconds: 1080,
        minWatchSeconds: 60,
        desc: "Separating wealth that beats inflation from wealth that depreciates.",
        provider: "bigvu",
        materials: [{ title: "Asset Categorization Matrix (XLSX)", type: "excel", url: "/assets/Real-Return-Calculator.xlsx" }],
        takeaways: ["Understand asset drag", "Calculate real inflation"],
      },
      {
        id: "mrc-03",
        title: "Session 3: The 30% Tax Leak in Traditional Fixed Deposits",
        duration: "20 mins",
        durationSeconds: 1200,
        minWatchSeconds: 60,
        desc: "Why FD returns after highest slab tax yield negative purchasing power.",
        provider: "bigvu",
        takeaways: ["Tax slab impact on debt", "Alternative tax-efficient instruments"],
      },
      {
        id: "mrc-04",
        title: "Session 4: The 4 Core Financial Diagnostic Tools",
        duration: "22 mins",
        durationSeconds: 1320,
        minWatchSeconds: 60,
        desc: "Introduction to the 4 shared diagnostic frameworks.",
        provider: "bigvu",
        takeaways: ["Master the audit sheet", "Run your first debt sanity check"],
      },
      {
        id: "mrc-05",
        title: "Session 5: Emergency Fund Math vs Emotional Buffers",
        duration: "16 mins",
        durationSeconds: 960,
        minWatchSeconds: 60,
        desc: "How many months of runway you actually need in high-liquidity assets.",
        provider: "bigvu",
        takeaways: ["Define 6-month runway", "Eliminate panic-driven cash piles"],
      },
      {
        id: "mrc-06",
        title: "Session 6: High-Interest Debt Triage & Rapid Elimination",
        duration: "19 mins",
        durationSeconds: 1140,
        minWatchSeconds: 60,
        desc: "Prioritizing personal loans, credit card balances, and auto debt.",
        provider: "bigvu",
        takeaways: ["Avalanche vs Snowball method", "Refinancing high APR obligations"],
      },
      {
        id: "mrc-07",
        title: "Session 7: Insurance Check: Term vs Investment Traps",
        duration: "25 mins",
        durationSeconds: 1500,
        minWatchSeconds: 60,
        desc: "Separating pure risk protection from low-yield endowment policies.",
        provider: "bigvu",
        takeaways: ["Calculating pure term cover", "Exiting toxic ULIPs"],
      },
      {
        id: "mrc-08",
        title: "Session 8: Medical Coverage Gaps & Super Top-Up Setup",
        duration: "21 mins",
        durationSeconds: 1260,
        minWatchSeconds: 60,
        desc: "Why base corporate coverage fails during catastrophic illness.",
        provider: "bigvu",
        takeaways: ["Deductible optimization", "Restoration and room rent limits"],
      },
      {
        id: "mrc-09",
        title: "Session 9: Single-Source Risk: Salary vs Sinking Funds",
        duration: "17 mins",
        durationSeconds: 1020,
        minWatchSeconds: 60,
        desc: "Decoupling household expenses from day 1 paycheck arrival.",
        provider: "bigvu",
        takeaways: ["Sinking fund segregation", "Smoothing lumpy yearly costs"],
      },
      {
        id: "mrc-10",
        title: "Session 10: Nomination vs Legal Heir Clarity",
        duration: "23 mins",
        durationSeconds: 1380,
        minWatchSeconds: 60,
        desc: "Why nominees are only caretakers and how to avoid estate disputes.",
        provider: "bigvu",
        takeaways: ["Nominee rights vs succession", "Joint account holding types"],
      },
      {
        id: "mrc-11",
        title: "Session 11: The Thursday Live Clarity Session Preparation",
        duration: "15 mins",
        durationSeconds: 900,
        minWatchSeconds: 60,
        desc: "How to bring your diagnostic worksheet questions to the live session.",
        provider: "bigvu",
        takeaways: ["Formulating high-impact questions", "Guest seat guidelines"],
      },
      {
        id: "mrc-12",
        title: "Session 12: Transitioning from Diagnostic to Execution",
        duration: "24 mins",
        durationSeconds: 1440,
        minWatchSeconds: 60,
        desc: "How the 30-day Silver upgrade path integrates full portfolio pruning.",
        provider: "bigvu",
        takeaways: ["The 30-day upgrade advantage", "Next steps for execution"],
      },
    ],
  },
  {
    id: "sec-core",
    category: "core",
    categoryLabel: "Core Curriculum",
    sectionTitle: "Phase 1: The Core Masterclass (Foundations)",
    lessons: [
      {
        id: "core-1",
        title: "Module 1: The Consolidated Money Picture",
        duration: "45 mins",
        durationSeconds: 2700,
        minWatchSeconds: 120,
        desc: "Unearth the accounts you forgot existed. Calculate your real asset-to-liability ratio on one single sheet without financial jargon.",
        provider: "bigvu",
        materials: [
          { title: "Consolidated Money Audit Sheet (PDF)", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf", size: "1.4 MB" },
          { title: "Net Worth & Account Aggregator (XLSX)", type: "excel", url: "/assets/Real-Return-Calculator.xlsx", size: "320 KB" },
        ],
        takeaways: [
          "List all scattered EPF, mutual funds, insurance policies, and forgotten bank accounts.",
          "Identify uninvested 'lazy cash' dragging down overall family purchasing power.",
          "Establish your current Baseline Net Worth number before moving to asset growth.",
        ],
      },
      {
        id: "core-2",
        title: "Module 2: Real Return & The 30% Tax Reality",
        duration: "50 mins",
        durationSeconds: 3000,
        minWatchSeconds: 120,
        desc: "Why doubling your money in 10 years is actually a negative 1% real return. Calculating the true after-tax, after-inflation numbers.",
        provider: "bigvu",
        materials: [
          { title: "Inflation & Tax Drag Interactive Model (XLSX)", type: "excel", url: "/assets/Real-Return-Calculator.xlsx", size: "410 KB" },
          { title: "Tax Slabs & Real Return Benchmark Guide (PDF)", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf", size: "850 KB" },
        ],
        takeaways: [
          "Break down how a 7.2% traditional FD turns into negative return under 30% slab + 6% inflation.",
          "Separating wealth-creation vehicles from wealth-preservation vehicles.",
          "Setting realistic hurdle rates for long-term equity and debt allocations.",
        ],
      },
      {
        id: "core-3",
        title: "Module 3: Protection, MWP Act & Nomination Architecture",
        duration: "40 mins",
        durationSeconds: 2400,
        minWatchSeconds: 120,
        desc: "The single legal clause that decides whether insurance payouts land in your family's hands or creditors' hands.",
        provider: "bigvu",
        materials: [
          { title: "MWP Act Endorsement Template (PDF)", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf", size: "520 KB" },
          { title: "Family Nomination & Transmission Checklist", type: "template", url: "/assets/Money-Audit-Worksheet.pdf", size: "640 KB" },
        ],
        takeaways: [
          "Invoke Section 6 of Married Women's Property Act (MWP) on term policies.",
          "Clean up single vs joint holders vs nominee mismatches across mutual fund folios.",
          "How to document demat and bank credentials securely for spouse and dependents.",
        ],
      },
      {
        id: "core-4",
        title: "Module 4: Writing The One Page Your Family Can Act On",
        duration: "35 mins",
        durationSeconds: 2100,
        minWatchSeconds: 120,
        desc: "Synthesizing everything into a single, unambiguous document that removes money anxiety permanently.",
        provider: "bigvu",
        materials: [
          { title: "The Master One Page Plan Template (Word / Docx)", type: "template", url: "/assets/Money-Audit-Worksheet.pdf", size: "290 KB" },
          { title: "Emergency Family Playbook & Contact Hierarchy", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf", size: "480 KB" },
        ],
        takeaways: [
          "Format your complete financial life onto 1 physical A4 sheet.",
          "Store copies in physical fireproof safe and verified digital vault.",
          "Hold the 30-minute family clarity walkthrough with spouse / adult children.",
        ],
      },
    ],
  },
  {
    id: "sec-implementation",
    category: "implementation",
    categoryLabel: "Implementation Sprints",
    sectionTitle: "Phase 2: 90-Day Execution Missions",
    lessons: [
      {
        id: "imp-1",
        title: "Mission 1: The 14-Day Portfolio Pruning Sprint",
        duration: "25 mins",
        durationSeconds: 1500,
        minWatchSeconds: 90,
        desc: "Step-by-step guidance on closing redundant bank accounts, consolidating 14 mutual fund schemes into 3-4 clean index funds, and pruning toxic policies.",
        provider: "bigvu",
        materials: [
          { title: "Portfolio Pruning & Capital Gains Offset Plan (XLSX)", type: "excel", url: "/assets/Real-Return-Calculator.xlsx", size: "380 KB" },
        ],
        takeaways: [
          "Exit underperforming endowment & ULIP policies safely.",
          "Consolidate multiple Demat and bank accounts into primary operations hub.",
        ],
      },
      {
        id: "imp-2",
        title: "Mission 2: Automated Cashflow & Sinking Fund Architecture",
        duration: "30 mins",
        durationSeconds: 1800,
        minWatchSeconds: 90,
        desc: "Automating savings on day 1 of every month so you never have to think about budgeting or restricting everyday lifestyle expenses.",
        provider: "bigvu",
        materials: [
          { title: "3-Account Automated Flowchart (PDF)", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf", size: "620 KB" },
        ],
        takeaways: [
          "Configure the Salary -> Sinking Fund -> Investment Sweep pipeline.",
          "Separate annual buffer expenses (school fees, term insurance) into high-yield liquid buckets.",
        ],
      },
    ],
  },
  {
    id: "sec-bonuses",
    category: "bonuses",
    categoryLabel: "VIP Bonuses & Tools",
    sectionTitle: "Phase 3: Exclusive Bonuses & VIP Toolkits",
    lessons: [
      {
        id: "bonus-1",
        title: "Bonus 1: The Will & Estate Planning Masterclass",
        duration: "55 mins",
        durationSeconds: 3300,
        minWatchSeconds: 120,
        desc: "Drafting a legally binding Will in India without expensive lawyer retainers. Witnessing, executor appointments, and digital asset succession.",
        provider: "bigvu",
        materials: [
          { title: "Simple Indian Will Standard Draft (Word / Docx)", type: "template", url: "/assets/Money-Audit-Worksheet.pdf", size: "340 KB" },
          { title: "Estate Planning Dos & Don'ts Checklist (PDF)", type: "pdf", url: "/assets/Money-Audit-Worksheet.pdf", size: "510 KB" },
        ],
        takeaways: [
          "How to legally draft and register a simple Indian will.",
          "Choosing trustworthy executors and guardian designations for minors.",
        ],
      },
      {
        id: "bonus-2",
        title: "Bonus 2: The High-Net-Worth Health Insurance Audit",
        duration: "40 mins",
        durationSeconds: 2400,
        minWatchSeconds: 120,
        desc: "Navigating super-top-ups, room-rent capping sub-limits, modern treatments, and restoring family health reserves without overpaying premiums.",
        provider: "bigvu",
        materials: [
          { title: "Health Policy Evaluation Scorecard (XLSX)", type: "excel", url: "/assets/Real-Return-Calculator.xlsx", size: "290 KB" },
        ],
        takeaways: [
          "Evaluate existing employer policy vs independent family floater.",
          "Eliminate room rent limits and copay clauses permanently.",
        ],
      },
    ],
  },
];

export type LessonComment = {
  id: string;
  lessonId: string;
  authorEmail: string;
  authorName: string;
  content: string;
  createdAt: string;
  isAdmin?: boolean;
};

export const getLessonCommentsFn = createServerFn({ method: "POST" })
  .validator((data: { lessonId: string }) => data)
  .handler(async ({ data }) => {
    const { getAuthenticatedUser } = await import("@/lib/auth/server-auth");
    const { user, error: authErr } = await getAuthenticatedUser();
    if (authErr || !user) {
      return { ok: false, comments: [] as LessonComment[], error: "unauthenticated" };
    }

    const { getMemberEntitledTiers } = await import("@/lib/commerce/video-access.server");
    const tiers = await getMemberEntitledTiers(user.email, user.id);
    const hasCourseEntitlement =
      tiers.canViewMrc || tiers.canViewSilver || tiers.canViewGold || tiers.canViewDiamond || user.isAdmin;

    if (!hasCourseEntitlement) {
      return { ok: false, comments: [] as LessonComment[], error: "forbidden_unentitled" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const { data: rows, error } = await supabaseAdmin
        .from("course_comments" as never)
        .select("*")
        .eq("lesson_id" as never, data.lessonId as never)
        .order("created_at" as never, { ascending: true } as never);

      if (error) {
        return { ok: false, comments: [] as LessonComment[], error: error.message };
      }

      return {
        ok: true,
        comments: ((rows ?? []) as any[]).map((r) => ({
          id: String(r.id),
          lessonId: String(r.lesson_id),
          authorEmail: String(r.author_email || ""),
          authorName: String(r.author_name || "Member"),
          content: String(r.content || ""),
          createdAt: String(r.created_at),
          isAdmin: Boolean(r.is_admin),
        })) as LessonComment[],
      };
    } catch {
      return { ok: false, comments: [] as LessonComment[], error: "query_failed" };
    }
  });

export const postLessonCommentFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      lessonId: string;
      name?: string | undefined;
      content: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getAuthenticatedUser } = await import("@/lib/auth/server-auth");
    const { user, error: authErr } = await getAuthenticatedUser();
    if (authErr || !user) {
      return { ok: false, error: "Authentication required to post comments. Please log in." };
    }

    const { getMemberEntitledTiers } = await import("@/lib/commerce/video-access.server");
    const tiers = await getMemberEntitledTiers(user.email, user.id);
    const hasCourseEntitlement =
      tiers.canViewMrc || tiers.canViewSilver || tiers.canViewGold || tiers.canViewDiamond || user.isAdmin;

    if (!hasCourseEntitlement) {
      return { ok: false, error: "Only enrolled course members can post comments." };
    }

    const cleanContent = (data.content || "").trim();
    if (!cleanContent) {
      return { ok: false, error: "Comment content cannot be empty." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const displayName =
      (data.name || "").trim() ||
      (user.isAdmin ? "Milan Dodhia (Mentor)" : user.email.split("@")[0] || "Member");

    try {
      const { data: inserted, error } = await supabaseAdmin
        .from("course_comments" as never)
        .insert({
          lesson_id: data.lessonId,
          author_email: user.email,
          user_id: user.id,
          author_name: displayName,
          content: cleanContent,
          is_admin: user.isAdmin,
        } as never)
        .select()
        .single();

      if (error || !inserted) {
        console.error("[Course Comments] Insert error:", error?.message || "No row returned");
        return {
          ok: false,
          error: "Failed to save comment to database. Please try again.",
        };
      }

      const row = inserted as any;
      return {
        ok: true,
        comment: {
          id: String(row.id),
          lessonId: String(row.lesson_id || data.lessonId),
          authorEmail: user.email,
          authorName: displayName,
          content: cleanContent,
          createdAt: String(row.created_at || new Date().toISOString()),
          isAdmin: user.isAdmin,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Failed to save comment: ${msg}`,
      };
    }
  });

function CoursePortalPage() {
  const search = Route.useSearch();
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPurchaseView, setShowPurchaseView] = useState(false);
  const [emailInput, setEmailInput] = useState(() => search.email || "");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  // Coupon code checkout state
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/commerce/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          product: "silver",
          baseAmount: 6000,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.error || `Coupon "${code}" is invalid or expired.`);
        setAppliedDiscount(null);
      } else {
        setAppliedDiscount({
          code: data.code,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountAmount: Number(data.discountAmount) || 0,
          finalAmount: Number(data.finalAmount) || 6000,
        });
        setCouponError(null);
      }
    } catch {
      setCouponError("Could not validate coupon. Please check connection.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(null);
    setCouponInput("");
    setCouponError(null);
  };

  const [memberTiers, setMemberTiers] = useState<{
    canViewMrc?: boolean;
    canViewSilver?: boolean;
    canViewGold?: boolean;
    canViewDiamond?: boolean;
  } | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Navigation state: selected section & lesson
  const [activeSectionId, setActiveSectionId] = useState<string>("sec-core");
  const [activeLessonId, setActiveLessonId] = useState<string>("core-1");

  // Sequential progression & watch time tracking state
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("opp_completed_lessons");
        if (saved) return JSON.parse(saved) as string[];
      } catch {
        /* ignore */
      }
    }
    return [];
  });

  const [watchSeconds, setWatchSeconds] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("opp_watch_seconds");
        if (saved) return JSON.parse(saved) as Record<string, number>;
      } catch {
        /* ignore */
      }
    }
    return {};
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(true); // default active when viewing
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Comments state for current active lesson
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [authorNameInput, setAuthorNameInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);

  // Filter sections by entitled tiers: MRC only sees sec-mrc; Silver sees Silver + MRC; etc.
  const displayedSections = useMemo(() => {
    if (!memberTiers) return COURSE_SECTIONS;
    if (memberTiers.canViewMrc && !memberTiers.canViewSilver) {
      return COURSE_SECTIONS.filter((s) => s.category === "mrc");
    }
    return COURSE_SECTIONS;
  }, [memberTiers]);

  // Compute active lesson, all ordered lessons, and unlock status
  const allLessons = displayedSections.flatMap((s) => s.lessons);
  const activeSection =
    displayedSections.find((s) => s.id === activeSectionId) ?? displayedSections[0] ?? COURSE_SECTIONS[0]!;
  const activeLesson =
    allLessons.find((l) => l.id === activeLessonId) ?? activeSection?.lessons[0] ?? COURSE_SECTIONS[0]!.lessons[0]!;

  const currentLessonIndex = allLessons.findIndex((l) => l.id === activeLesson.id);
  const nextLesson = allLessons[currentLessonIndex + 1];

  // Creator bypass: verified admin can toggle between Student View (locked) and Mentor View (all unlocked)
  const isCreatorAdmin = isAdminUser;
  const [studentPreviewMode, setStudentPreviewMode] = useState<boolean>(true); // default to student locked view to test

  // Check if a specific lesson is unlocked
  const isLessonUnlocked = (lessonId: string): boolean => {
    if (isCreatorAdmin && !studentPreviewMode) return true;
    const index = allLessons.findIndex((l) => l.id === lessonId);
    if (index <= 0) return true; // First lesson is always unlocked
    // A lesson is unlocked if the immediate previous lesson is completed
    const prevLesson = allLessons[index - 1];
    return prevLesson ? completedLessonIds.includes(prevLesson.id) : false;
  };

  const isCurrentCompleted = completedLessonIds.includes(activeLesson.id);
  const currentWatchSec = watchSeconds[activeLesson.id] || 0;
  const currentMinSec = activeLesson.minWatchSeconds || 120;
  const watchProgressPct = Math.min(100, Math.round((currentWatchSec / currentMinSec) * 100));

  const getSupabaseAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Mark lesson as complete and unlock next module
  const markLessonComplete = (lessonId: string) => {
    if (!completedLessonIds.includes(lessonId)) {
      const updated = [...completedLessonIds, lessonId];
      setCompletedLessonIds(updated);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("opp_completed_lessons", JSON.stringify(updated));
        } catch {
          /* ignore */
        }
      }
      void getSupabaseAuthHeaders()
        .then((headers) => recordLessonCompletionFn({ data: { lessonId }, headers }))
        .catch(() => {
          /* non-blocking server sync */
        });
    }
  };

  // Play-time tracker: ticks every second when viewing video
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setWatchSeconds((prev) => {
        const updatedSec = (prev[activeLesson.id] || 0) + 1;
        const newRecord = { ...prev, [activeLesson.id]: updatedSec };
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem("opp_watch_seconds", JSON.stringify(newRecord));
          } catch {
            /* ignore */
          }
        }
        // Auto-unlock when user completes minimum watch requirement
        if (updatedSec >= (activeLesson.minWatchSeconds || 120)) {
          markLessonComplete(activeLesson.id);
        }
        return newRecord;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeLesson.id]);

  // Session verification on mount
  useEffect(() => {
    let isMounted = true;
    async function initSession() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          if (isMounted) setIsCheckingAuth(false);
          return;
        }

        const res = await checkAccessFn({
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        if (!isMounted) return;

        if (res.ok && res.authenticated) {
          setActiveEmail(res.email);
          setActiveUserId(res.userId);
          setIsAdminUser(Boolean(res.isAdmin));
          setHasAccess(res.hasAccess);
          if (res.tiers) {
            setMemberTiers(res.tiers);
            if (res.tiers.canViewMrc && !res.tiers.canViewSilver) {
              setActiveSectionId("sec-mrc");
              setActiveLessonId("mrc-01");
            }
          }
        } else {
          // Token invalid or expired on server
          await supabase.auth.signOut().catch(() => {});
          setActiveEmail(null);
          setActiveUserId(null);
          setHasAccess(null);
        }
      } catch {
        /* ignore */
      } finally {
        if (isMounted) setIsCheckingAuth(false);
      }
    }

    void initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setActiveEmail(null);
        setActiveUserId(null);
        setHasAccess(null);
        setMemberTiers(null);
        setIsAdminUser(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Dynamically resolve protected BIGVU embed URL for active lesson
  useEffect(() => {
    let isMounted = true;
    if (!activeEmail || !hasAccess) {
      setCurrentVideoUrl(null);
      setVideoError(null);
      return;
    }

    void getSupabaseAuthHeaders()
      .then((headers) => getLessonVideoFn({ data: { lessonId: activeLesson.id }, headers }))
      .then((res) => {
        if (isMounted) {
          if (res.ok && res.lesson?.embedUrl) {
            setCurrentVideoUrl(res.lesson.embedUrl);
            setVideoError(null);
          } else {
            setCurrentVideoUrl(null);
            setVideoError(
              res.error === "forbidden_unentitled"
                ? "This lesson is exclusive to a higher membership tier. Upgrade to unlock."
                : "Unable to load video stream.",
            );
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentVideoUrl(null);
          setVideoError("Network error loading video stream.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeLesson.id, activeEmail, hasAccess]);

  // Load comments whenever active lesson changes (only for authenticated entitled members)
  useEffect(() => {
    let isMounted = true;
    if (!activeEmail || !hasAccess) {
      setComments([]);
      return;
    }
    async function loadComments() {
      try {
        const headers = await getSupabaseAuthHeaders();
        const res = await getLessonCommentsFn({ data: { lessonId: activeLesson.id }, headers });
        if (isMounted && res.ok) {
          setComments(res.comments);
        }
      } catch {
        /* ignore */
      }
    }
    void loadComments();
    return () => {
      isMounted = false;
    };
  }, [activeLesson.id, activeEmail, hasAccess]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    setCommentSuccess(false);

    const name = authorNameInput.trim() || undefined;

    try {
      const headers = await getSupabaseAuthHeaders();
      const res = await postLessonCommentFn({
        data: {
          lessonId: activeLesson.id,
          name,
          content: commentText.trim(),
        },
        headers,
      });

      if (res.ok && res.comment) {
        setComments((prev) => [...prev, res.comment]);
        setCommentText("");
        setCommentSuccess(true);
        setTimeout(() => setCommentSuccess(false), 3000);
      }
    } catch {
      // Fallback
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    setActiveEmail(null);
    setActiveUserId(null);
    setHasAccess(null);
    setMemberTiers(null);
    setIsAdminUser(false);
    setShowPurchaseView(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <header className="border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Wordmark />
            <div className="flex items-center gap-3 text-xs">
              {hasAccess ? (
                <div className="flex items-center gap-2">
                  {isCreatorAdmin ? (
                    <button
                      type="button"
                      onClick={() => setStudentPreviewMode((prev) => !prev)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        studentPreviewMode
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                          : "bg-purple-500/10 text-purple-700 border-purple-500/30"
                      }`}
                      title="Toggle between Student View (Sequential Locking) and Mentor View (Full Access)"
                    >
                      {studentPreviewMode ? "🔒 Student View (Locked Progression)" : "🔓 Mentor View (All Unlocked)"}
                    </button>
                  ) : null}
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <Check className="h-3.5 w-3.5" />
                    Access Verified ({activeEmail})
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <span className="text-muted-foreground">Member Portal</span>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          {isCheckingAuth ? (
            <div className="mx-auto max-w-md text-center py-24 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Checking authenticated session...</p>
            </div>
          ) : hasAccess === true ? (
            /* STEP 2: Access verified -> Full Structure (Modules, Sprints, Bonuses, Materials, Comments) */
            <div className="space-y-6">
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                {displayedSections.map((sec) => {
                  const isSecActive = sec.id === activeSectionId;
                  const Icon =
                    sec.category === "mrc"
                      ? Award
                      : sec.category === "core"
                      ? BookOpen
                      : sec.category === "implementation"
                      ? Zap
                      : Gift;

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setActiveSectionId(sec.id);
                        if (sec.lessons[0]) {
                          setActiveLessonId(sec.lessons[0].id);
                        }
                      }}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        isSecActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {sec.categoryLabel}
                      <span className="text-[10px] opacity-75 font-normal">
                        ({sec.lessons.length})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Money Reality Check to Silver Upgrade Banner */}
              {activeSection.id === "sec-mrc" || (memberTiers?.canViewMrc && !memberTiers?.canViewSilver) ? (
                <div className="rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[var(--brass)] uppercase tracking-wider">
                      Money Reality Check Upgrade Window
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      Upgrade to The Calm Money System (Silver)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your ₹601 payment counts fully towards Silver. Lock in your cohort seat today.
                    </p>
                  </div>
                  <Link
                    to="/upgrade/silver"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
                  >
                    Upgrade to Silver (Credit Applied) →
                  </Link>
                </div>
              ) : null}

              {/* Silver Completer Gold Offer Banner */}
              {memberTiers?.canViewSilver && !memberTiers?.canViewGold ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">
                      Gold Completer Upgrade Path
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      Ready for Advanced Wealth Transmission & Private Office?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Silver completers who submit on time qualify for the special upgrade price of ₹18,001.
                    </p>
                  </div>
                  <Link
                    to="/upgrade/gold"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
                  >
                    View Special Upgrade Price →
                  </Link>
                </div>
              ) : null}

              {/* Main Content Grid: Video + Details on Left, Curriculum Sidebar on Right */}
              <div className="grid gap-8 lg:grid-cols-[68fr_32fr]">
                {/* LEFT COLUMN: Player, Materials, Notes, Discussion */}
                <div className="space-y-6">
                  {/* Video Player */}
                  <div className="space-y-3">
                    {videoError ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
                        <Lock className="h-8 w-8 text-amber-600 mx-auto opacity-80" />
                        <p className="text-sm font-semibold text-amber-900">{videoError}</p>
                        <p className="text-xs text-amber-700">
                          Upgrade to Silver or Gold to unlock the full execution curriculum.
                        </p>
                      </div>
                    ) : (
                      <ProtectedVideoPlayer
                        videoId={activeLesson.videoId}
                        url={currentVideoUrl || undefined}
                        provider={activeLesson.provider}
                        title={activeLesson.title}
                      />
                    )}

                    {/* Interactive Watch-Time Tracker & Progression Unlock Bar */}
                    <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground">Play-Time Tracked:</span>
                          <span className="text-muted-foreground font-mono">
                            {Math.floor(currentWatchSec / 60)}m {currentWatchSec % 60}s
                          </span>
                          {!isCurrentCompleted ? (
                            <span className="text-[11px] text-muted-foreground">
                              ({Math.floor(currentMinSec / 60)}m required to unlock next)
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {isCurrentCompleted ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Video Completed & Next Unlocked
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => markLessonComplete(activeLesson.id)}
                              className="text-[11px] font-semibold text-primary hover:underline underline-offset-4"
                              title="Click if finished watching or re-watching"
                            >
                              Mark Finished & Unlock Next →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isCurrentCompleted ? "bg-emerald-500" : "bg-primary"
                          }`}
                          style={{ width: `${isCurrentCompleted ? 100 : watchProgressPct}%` }}
                        />
                      </div>

                      {/* Quick Next Module jump button if unlocked */}
                      {isCurrentCompleted && nextLesson ? (
                        <div className="pt-1 flex items-center justify-between border-t border-border/50 text-xs">
                          <span className="text-muted-foreground">
                            Ready for next step: <strong className="text-foreground">{nextLesson.title}</strong>
                          </span>
                          <Button
                            size="sm"
                            onClick={() => {
                              const nextSec = COURSE_SECTIONS.find((s) =>
                                s.lessons.some((l) => l.id === nextLesson.id),
                              );
                              if (nextSec) setActiveSectionId(nextSec.id);
                              setActiveLessonId(nextLesson.id);
                            }}
                            className="h-7 text-xs px-3"
                          >
                            Proceed to Next Video →
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs text-[var(--brass)] font-semibold uppercase tracking-wider">
                        <span>{activeSection.categoryLabel}</span>
                        <span>•</span>
                        <span>{activeLesson.duration}</span>
                      </div>
                      <h1 className="mt-1 text-2xl font-bold text-foreground">{activeLesson.title}</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                        {activeLesson.desc}
                      </p>
                    </div>
                  </div>

                  {/* Lesson Materials & Downloadables */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Download className="h-4 w-4 text-[var(--brass)]" />
                        Session Worksheets & Materials
                      </h3>
                      <span className="text-xs text-muted-foreground font-normal">
                        {activeLesson.materials?.length || 0} resources included
                      </span>
                    </div>

                    {activeLesson.materials && activeLesson.materials.length > 0 ? (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {activeLesson.materials.map((mat, i) => (
                          <a
                            key={i}
                            href={mat.url}
                            download
                            className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-muted/30 transition-all text-xs group"
                          >
                            <div className="flex items-center gap-2.5 truncate mr-2">
                              {mat.type === "excel" ? (
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                              )}
                              <span className="font-medium text-foreground truncate group-hover:text-primary">
                                {mat.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 uppercase">
                              {mat.size || "Download"} ↓
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No downloadable worksheets for this orientation session.
                      </p>
                    )}
                  </div>

                  {/* Key Takeaways & Checklist */}
                  {activeLesson.takeaways && activeLesson.takeaways.length > 0 ? (
                    <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Award className="h-4 w-4 text-emerald-500" />
                        Core Takeaways & Implementation Checklist
                      </h3>
                      <ul className="space-y-2 text-xs text-foreground/90">
                        {activeLesson.takeaways.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* COMMENTS & DISCUSSION SECTION */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Discussion & Mentor Q&A ({comments.length})
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        Ask a question about {activeLesson.title}
                      </span>
                    </div>

                    {/* New Comment Input Form */}
                    <form onSubmit={handlePostComment} className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Your Name (optional)"
                          value={authorNameInput}
                          onChange={(e) => setAuthorNameInput(e.target.value)}
                          className="text-xs h-8"
                        />
                        <div className="text-[11px] text-muted-foreground flex items-center px-1">
                          Posting as: <strong className="ml-1 text-foreground">{activeEmail}</strong>
                        </div>
                      </div>

                      <Textarea
                        placeholder={`Share a key takeaway, question, or implementation roadblock from this session...`}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                        required
                        className="text-xs"
                      />

                      <div className="flex items-center justify-between">
                        {commentSuccess ? (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Comment posted successfully!
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Comments are visible to all enrolled members & mentor.
                          </span>
                        )}
                        <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()}>
                          {submittingComment ? "Posting..." : "Post Comment"}
                          <Send className="h-3 w-3 ml-1.5" />
                        </Button>
                      </div>
                    </form>

                    {/* Comments Feed */}
                    <div className="space-y-3 pt-2">
                      {comments.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-border rounded-lg">
                          <HelpCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-muted-foreground">
                            No comments yet for this lesson. Be the first to share your takeaways or question!
                          </p>
                        </div>
                      ) : (
                        comments.map((c) => (
                          <div
                            key={c.id}
                            className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                              c.isAdmin
                                ? "bg-[var(--brass)]/5 border-[var(--brass)]/30"
                                : "bg-background border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{c.authorName}</span>
                                {c.isAdmin ? (
                                  <span className="bg-[var(--brass)]/20 text-[var(--brass)] px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    Mentor / Host
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                              {c.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Curriculum Navigator */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-4 sticky top-20">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Curriculum Structure
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {allLessons.length} Total Lessons
                      </span>
                    </div>

                    {/* Accordion / List of all sections and lessons */}
                    <div className="space-y-4">
                      {displayedSections.map((sec) => (
                        <div key={sec.id} className="space-y-1.5">
                          <p className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider px-1">
                            {sec.sectionTitle}
                          </p>
                          <div className="space-y-1.5">
                            {sec.lessons.map((lesson, idx) => {
                              const isCurrent = lesson.id === activeLesson.id;
                              const isCompleted = completedLessonIds.includes(lesson.id);
                              const isUnlocked = isLessonUnlocked(lesson.id);

                              return (
                                <button
                                  key={lesson.id}
                                  type="button"
                                  disabled={!isUnlocked}
                                  onClick={() => {
                                    if (isUnlocked) {
                                      setActiveSectionId(sec.id);
                                      setActiveLessonId(lesson.id);
                                    }
                                  }}
                                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2.5 ${
                                    isCurrent
                                      ? "bg-primary/10 border-primary font-medium text-foreground shadow-2xs"
                                      : !isUnlocked
                                      ? "bg-muted/30 border-border/50 text-muted-foreground/60 cursor-not-allowed opacity-60"
                                      : "bg-background border-border/80 hover:bg-muted/50 text-muted-foreground"
                                  }`}
                                >
                                  <div
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] mt-0.5 ${
                                      isCurrent
                                        ? "bg-primary text-primary-foreground font-bold"
                                        : isCompleted
                                        ? "bg-emerald-500/20 text-emerald-600 font-bold border border-emerald-500/30"
                                        : !isUnlocked
                                        ? "bg-muted text-muted-foreground/50"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : !isUnlocked ? (
                                      <LockKeyhole className="h-3 w-3 text-muted-foreground/60" />
                                    ) : (
                                      idx + 1
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 truncate">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className={`font-semibold truncate ${!isUnlocked ? "text-muted-foreground/70" : "text-foreground"}`}>
                                        {lesson.title}
                                      </p>
                                      {!isUnlocked ? (
                                        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded shrink-0">
                                          Locked
                                        </span>
                                      ) : isCompleted ? (
                                        <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                                          Done
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                      <span>{lesson.duration}</span>
                                      {lesson.materials?.length ? (
                                        <span>• {lesson.materials.length} files</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : showPurchaseView ? (
            /* STEP 3: Direct Razorpay ₹6,000 Purchase */
            <div className="mx-auto max-w-2xl py-8 space-y-8">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brass)]/15 text-[var(--brass)]">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h1 className="text-3xl font-bold">The Calm Money System</h1>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  Lifetime access to the complete 3-day recorded masterclass, 90-day implementation missions, full template pack, and direct Q&A.
                </p>
              </div>

              {/* Offer Card */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold">Lifetime System Access</h2>
                    <p className="text-xs text-muted-foreground">One-time payment · Instant course unlock</p>
                  </div>
                  <div className="text-right">
                    {appliedDiscount ? (
                      <div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm line-through text-muted-foreground">₹6,000</span>
                          <span className="text-3xl font-bold text-emerald-600">
                            ₹{appliedDiscount.finalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <span className="text-xs text-emerald-600 font-medium block">
                          Coupon {appliedDiscount.code} applied (Saved ₹{appliedDiscount.discountAmount.toLocaleString("en-IN")})
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-primary">₹6,000</span>
                        <span className="text-xs text-muted-foreground block">one time</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {[
                    "Full consolidated financial audit spreadsheet & training",
                    "Real return calculation model (accounting for 30% tax & inflation)",
                    "Nomination, MWP Act & insurance protection architecture checklist",
                    "The One Page Plan template your family can act on",
                    "Direct access to recorded video sessions with zero expiration",
                  ].map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 space-y-4">
                  <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground">
                      Enter your details to unlock instant course access:
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground flex items-center justify-between">
                        <span>Email Address <span className="text-destructive">*</span></span>
                        <span className="text-[10px] text-muted-foreground">Course access & receipt will be sent here</span>
                      </label>
                      <Input
                        type="email"
                        placeholder="yourname@gmail.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="text-xs bg-card"
                        required
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          Full Name
                        </label>
                        <Input
                          placeholder="Your Name"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          className="text-xs bg-card"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          WhatsApp Mobile
                        </label>
                        <Input
                          placeholder="+91 98200XXXXX"
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                          className="text-xs bg-card"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span>Have a Coupon Code?</span>
                      </label>
                      {appliedDiscount && (
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-[11px] text-destructive hover:underline font-medium"
                        >
                          ✕ Remove coupon
                        </button>
                      )}
                    </div>

                    {!appliedDiscount ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter coupon code (e.g. VIP500)"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value.toUpperCase());
                            setCouponError(null);
                          }}
                          className="h-8 text-xs font-mono uppercase bg-background"
                          disabled={couponLoading}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={couponLoading || !couponInput.trim()}
                          onClick={handleApplyCoupon}
                          className="h-8 text-xs px-4 shrink-0 font-medium"
                        >
                          {couponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5" />
                          <span className="font-mono font-bold">{appliedDiscount.code}</span>
                          <span>applied</span>
                        </div>
                        <span className="font-semibold">-₹{appliedDiscount.discountAmount.toLocaleString("en-IN")} off</span>
                      </div>
                    )}

                    {couponError && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {couponError}
                      </p>
                    )}
                  </div>

                  <RazorpayButton
                    label={`Pay ₹${(appliedDiscount ? appliedDiscount.finalAmount : 6000).toLocaleString("en-IN")} & Unlock Instant Access →`}
                    email={emailInput.trim()}
                    name={buyerName.trim()}
                    phone={buyerPhone.trim()}
                    discountCode={appliedDiscount ? appliedDiscount.code : undefined}
                    onSuccess={() => {
                      setShowPurchaseView(false);
                    }}
                  />
                  <p className="text-center text-[11px] text-muted-foreground mt-2">
                    Secured by Razorpay · UPI, Cards, Netbanking accepted
                  </p>
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowPurchaseView(false)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Already paid? Log in here with your email code →
                </button>
              </div>
            </div>
          ) : (
            /* STEP 1: Email OTP Login Screen */
            <CourseLoginView
              initialEmail={search.email || ""}
              onLoginSuccess={(email, tiers, userId, isAdmin) => {
                setActiveEmail(email);
                setActiveUserId(userId);
                setIsAdminUser(Boolean(isAdmin));
                setMemberTiers(tiers);
                setHasAccess(true);
                if (tiers?.canViewMrc && !tiers?.canViewSilver) {
                  setActiveSectionId("sec-mrc");
                  setActiveLessonId("mrc-01");
                }
              }}
              onShowPurchase={() => setShowPurchaseView(true)}
              onCheckAccess={async () => {
                const headers = await getSupabaseAuthHeaders();
                return await checkAccessFn({ headers });
              }}
            />
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
