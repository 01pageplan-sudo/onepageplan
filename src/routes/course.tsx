import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ProtectedVideoPlayer } from "@/components/site/ProtectedVideoPlayer";
import { RazorpayButton } from "@/components/site/RazorpayButton";

type CourseSearchParams = {
  email?: string | undefined;
};

export const Route = createFileRoute("/course")({
  validateSearch: (search: Record<string, unknown>): CourseSearchParams => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ email: search.email }),
  loader: async ({ deps }) => {
    if (!deps.email) return { initialAccess: null as boolean | null, initialEmail: null as string | null };
    try {
      const res = await checkAccessFn({ data: { email: deps.email } });
      return { initialAccess: res.hasAccess, initialEmail: res.email || deps.email };
    } catch {
      return { initialAccess: null, initialEmail: deps.email };
    }
  },
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
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const cleanEmail = (data.email || "").trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cleanEmail)) {
      return { ok: false, hasAccess: false, error: "invalid_email" };
    }

    // Owner / Creator & Admin bypass for review & testing
    const adminEmails = (process.env["COURSE_ADMIN_EMAILS"] || "dodhia.milan@gmail.com")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim());

    if (adminEmails.includes(cleanEmail)) {
      return {
        ok: true,
        hasAccess: true,
        email: cleanEmail,
        isAdmin: true,
      };
    }

    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const db = createPublicServerClient();

    const { data: hasAccess, error } = await (db.rpc as any)("check_course_access", {
      p_email: cleanEmail,
    });

    if (error) {
      console.error("[Course Access] Lookup failed:", error.message);
      return { ok: false, hasAccess: false, error: "lookup_failed" };
    }

    return {
      ok: true,
      hasAccess: Boolean(hasAccess),
      email: cleanEmail,
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
  category: "core" | "implementation" | "bonuses";
  categoryLabel: string;
  sectionTitle: string;
  lessons: CourseLesson[];
};

export const COURSE_SECTIONS: CourseSection[] = [
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
        minWatchSeconds: 120, // 2 mins requirement (or instant completion click)
        desc: "Unearth the accounts you forgot existed. Calculate your real asset-to-liability ratio on one single sheet without financial jargon.",
        provider: "bigvu",
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
        videoUrl: "https://desk.bigvu.tv/embed/6828cee3fbf28abcfe211466/6831ae85078adf5a997bcfea",
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
  .inputValidator((data: { lessonId: string }) => data)
  .handler(async ({ data }) => {
    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const db = createPublicServerClient();

    try {
      const { data: rows, error } = await db
        .from("course_comments" as never)
        .select("*")
        .eq("lesson_id" as never, data.lessonId as never)
        .order("created_at" as never, { ascending: true } as never);

      if (error) {
        // Fallback: If table not yet in schema cache, return empty array gracefully
        return { ok: true, comments: [] as LessonComment[] };
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
      return { ok: true, comments: [] as LessonComment[] };
    }
  });

export const postLessonCommentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      lessonId: string;
      email: string;
      name?: string | undefined;
      content: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const cleanEmail = (data.email || "").trim().toLowerCase();
    const cleanContent = (data.content || "").trim();

    if (!cleanEmail || !cleanContent) {
      return { ok: false, error: "Content and email required." };
    }

    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const db = createPublicServerClient();

    const isAdmin =
      cleanEmail === "dodhia.milan@gmail.com" ||
      (process.env["COURSE_ADMIN_EMAILS"] || "").toLowerCase().includes(cleanEmail);

    const displayName =
      (data.name || "").trim() ||
      (isAdmin ? "Milan Dodhia (Mentor)" : cleanEmail.split("@")[0] || "Member");

    try {
      const { data: inserted, error } = await db
        .from("course_comments" as never)
        .insert({
          lesson_id: data.lessonId,
          author_email: cleanEmail,
          author_name: displayName,
          content: cleanContent,
          is_admin: isAdmin,
        } as never)
        .select()
        .single();

      if (error) {
        console.warn("[Course Comments] Insert fallback:", error.message);
      }

      return {
        ok: true,
        comment: {
          id: (inserted as any)?.id || `local-${Date.now()}`,
          lessonId: data.lessonId,
          authorEmail: cleanEmail,
          authorName: displayName,
          content: cleanContent,
          createdAt: new Date().toISOString(),
          isAdmin,
        },
      };
    } catch {
      return {
        ok: true,
        comment: {
          id: `local-${Date.now()}`,
          lessonId: data.lessonId,
          authorEmail: cleanEmail,
          authorName: displayName,
          content: cleanContent,
          createdAt: new Date().toISOString(),
          isAdmin,
        },
      };
    }
  });

function CoursePortalPage() {
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const [emailInput, setEmailInput] = useState(() => search.email || loaderData?.initialEmail || "");
  const [activeEmail, setActiveEmail] = useState<string | null>(() => loaderData?.initialEmail ?? null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(() => loaderData?.initialAccess ?? null);
  const [checking, setChecking] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");

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

  // Compute active lesson, all ordered lessons, and unlock status
  const allLessons = COURSE_SECTIONS.flatMap((s) => s.lessons);
  const activeSection =
    COURSE_SECTIONS.find((s) => s.id === activeSectionId) ?? COURSE_SECTIONS[0]!;
  const activeLesson =
    allLessons.find((l) => l.id === activeLessonId) ?? activeSection.lessons[0] ?? allLessons[0]!;

  const currentLessonIndex = allLessons.findIndex((l) => l.id === activeLesson.id);
  const nextLesson = allLessons[currentLessonIndex + 1];

  // Creator bypass: dodhia.milan@gmail.com can toggle between Student View (locked) and Mentor View (all unlocked)
  const isCreatorAdmin = activeEmail === "dodhia.milan@gmail.com";
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

  const verifyEmail = async (targetEmail: string) => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean) return;
    setErrorNotice("");
    setChecking(true);

    try {
      const res = await checkAccessFn({ data: { email: clean } });
      if (!res.ok && res.error === "invalid_email") {
        setErrorNotice("Please enter a valid email address.");
        setChecking(false);
        return;
      }

      setActiveEmail(res.email || clean);
      setHasAccess(res.hasAccess);
      if (res.hasAccess && typeof window !== "undefined") {
        try {
          window.localStorage.setItem("opp_course_email", clean);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setErrorNotice("Could not verify access. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyEmail(emailInput);
  };

  // Auto-verify on mount from query param or localStorage
  useEffect(() => {
    const queryEmail = search.email?.trim().toLowerCase();
    if (queryEmail) {
      setEmailInput(queryEmail);
      void verifyEmail(queryEmail);
      return;
    }

    if (typeof window !== "undefined") {
      const savedEmail = window.localStorage.getItem("opp_course_email")?.trim().toLowerCase();
      if (savedEmail) {
        setEmailInput(savedEmail);
        void verifyEmail(savedEmail);
      }
    }
  }, [search.email]);

  // Load comments whenever active lesson changes
  useEffect(() => {
    let isMounted = true;
    async function loadComments() {
      try {
        const res = await getLessonCommentsFn({ data: { lessonId: activeLesson.id } });
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
  }, [activeLesson.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    setCommentSuccess(false);

    const email = activeEmail || emailInput || "guest@onepageplan.in";
    const name = authorNameInput.trim() || undefined;

    try {
      const res = await postLessonCommentFn({
        data: {
          lessonId: activeLesson.id,
          email,
          name,
          content: commentText.trim(),
        },
      });

      if (res.ok && res.comment) {
        setComments((prev) => [...prev, res.comment]);
        setCommentText("");
        setCommentSuccess(true);
        setTimeout(() => setCommentSuccess(false), 3000);
      }
    } catch {
      // Fallback local append for immediate responsive UI
      const localComment: LessonComment = {
        id: `local-${Date.now()}`,
        lessonId: activeLesson.id,
        authorEmail: email,
        authorName: name || (email === "dodhia.milan@gmail.com" ? "Milan Dodhia (Mentor)" : email.split("@")[0] || "Member"),
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
        isAdmin: email === "dodhia.milan@gmail.com",
      };
      setComments((prev) => [...prev, localComment]);
      setCommentText("");
    } finally {
      setSubmittingComment(false);
    }
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
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.localStorage.removeItem("opp_course_email");
                      }
                      setHasAccess(null);
                      setActiveEmail(null);
                    }}
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
          {/* STEP 1: Not logged in / Email not verified yet */}
          {hasAccess === null ? (
            <div className="mx-auto max-w-md text-center py-12">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold">The Calm Money System</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the email address you used when purchasing to unlock your recorded curriculum.
              </p>

              <form onSubmit={handleVerifyEmail} className="mt-6 space-y-4">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  className="text-center"
                />
                <Button type="submit" disabled={checking} className="w-full">
                  {checking ? "Checking verified access..." : "Access Course Materials →"}
                </Button>
                {errorNotice ? <p className="text-xs text-destructive">{errorNotice}</p> : null}
              </form>

              <div className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
                Haven't enrolled yet?{" "}
                <button
                  type="button"
                  onClick={() => setHasAccess(false)}
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  View curriculum & purchase access (₹6,000)
                </button>
              </div>
            </div>
          ) : hasAccess === true ? (
            /* STEP 2: Access verified -> Full Structure (Modules, Sprints, Bonuses, Materials, Comments) */
            <div className="space-y-6">
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                {COURSE_SECTIONS.map((sec) => {
                  const isSecActive = sec.id === activeSectionId;
                  const Icon =
                    sec.category === "core"
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

              {/* Main Content Grid: Video + Details on Left, Curriculum Sidebar on Right */}
              <div className="grid gap-8 lg:grid-cols-[68fr_32fr]">
                {/* LEFT COLUMN: Player, Materials, Notes, Discussion */}
                <div className="space-y-6">
                  {/* Video Player */}
                  <div className="space-y-3">
                    <ProtectedVideoPlayer
                      videoId={activeLesson.videoId}
                      url={activeLesson.videoUrl}
                      provider={activeLesson.provider}
                      title={activeLesson.title}
                    />

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
                      {COURSE_SECTIONS.map((sec) => (
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
          ) : (
            /* STEP 3: No verified access -> Direct Razorpay ₹6,000 Purchase */
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
                    <span className="text-3xl font-bold text-primary">₹6,000</span>
                    <span className="text-xs text-muted-foreground block">one time</span>
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

                <div className="pt-2">
                  <RazorpayButton
                    label="Pay ₹6,000 & Unlock Instant Access →"
                    email={activeEmail || emailInput}
                    onSuccess={() => {
                      setHasAccess(true);
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
                  onClick={() => setHasAccess(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Already paid with a different email? Log in here
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
