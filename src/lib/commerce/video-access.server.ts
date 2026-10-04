/**
 * Commerce Foundation: Protected Video Access & Gating (Server-side)
 * Ensures BIGVU embed codes and URLs never reach unentitled browsers.
 *
 * Entitlement Matrix:
 * - Money Reality Check: exactly their 12 sessions.
 * - Silver: Silver curriculum, missions, and bonus masterclasses.
 * - Gold: Silver + Gold sessions.
 * - Diamond: Silver + Gold + Diamond sessions.
 */

import { createPublicServerClient } from "@/lib/supabase-public.server";

export interface LessonSummary {
  id: string;
  tier: "money_reality_check" | "silver" | "gold" | "diamond";
  title: string;
  duration: string;
  durationSeconds: number;
  minWatchSeconds: number;
  desc: string;
  materials: Array<{ title: string; type: string; url: string; size?: string }>;
  takeaways: string[];
  sequenceOrder: number;
}

export interface EntitledLessonPayload extends LessonSummary {
  embedUrl: string; // BIGVU embed URL - provided ONLY to authorized members
}

/**
 * Checks member's active access rights and returns the list of tiers they are entitled to view.
 */
export async function getMemberEntitledTiers(
  email: string,
): Promise<{
  canViewMrc: boolean;
  canViewSilver: boolean;
  canViewGold: boolean;
  canViewDiamond: boolean;
}> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) {
    return { canViewMrc: false, canViewSilver: false, canViewGold: false, canViewDiamond: false };
  }

  // Admin bypass
  const adminEmails = (process.env["COURSE_ADMIN_EMAILS"] || "dodhia.milan@gmail.com")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim());

  if (adminEmails.includes(cleanEmail)) {
    return { canViewMrc: true, canViewSilver: true, canViewGold: true, canViewDiamond: true };
  }

  const db = createPublicServerClient();

  const [mrcRes, silverRes, goldRes, diamondRes] = await Promise.all([
    (db.rpc as any)("has_active_access", { p_email: cleanEmail, p_tier: "money_reality_check" }),
    (db.rpc as any)("has_active_access", { p_email: cleanEmail, p_tier: "silver" }),
    (db.rpc as any)("has_active_access", { p_email: cleanEmail, p_tier: "gold" }),
    (db.rpc as any)("has_active_access", { p_email: cleanEmail, p_tier: "diamond" }),
  ]);

  const hasDiamond = Boolean(diamondRes.data);
  const hasGold = hasDiamond || Boolean(goldRes.data);
  const hasSilver = hasGold || Boolean(silverRes.data);
  const hasMrc = Boolean(mrcRes.data);

  return {
    canViewMrc: hasMrc,
    canViewSilver: hasSilver,
    canViewGold: hasGold,
    canViewDiamond: hasDiamond,
  };
}

/**
 * Resolves a specific lesson's video stream securely.
 * Rejects if user does not possess active entitlement for the lesson's tier.
 * Never leaks the embed URL on forbidden calls.
 */
export async function getEntitledLessonVideo(params: {
  email: string;
  lessonId: string;
}): Promise<{
  ok: boolean;
  lesson?: EntitledLessonPayload;
  error?: string;
}> {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  const db = createPublicServerClient();

  // 1. Fetch lesson metadata from catalog
  const { data: lessonRow, error: lessonError } = await db
    .from("course_lessons_catalog" as never)
    .select("*")
    .eq("id" as never, params.lessonId as never)
    .maybeSingle();

  if (lessonError || !lessonRow) {
    return { ok: false, error: "lesson_not_found" };
  }

  const lesson = lessonRow as any;
  const tiers = await getMemberEntitledTiers(cleanEmail);

  // 2. Validate entitlement against lesson tier
  let isAuthorized = false;

  if (lesson.tier === "money_reality_check" && tiers.canViewMrc) {
    isAuthorized = true;
  } else if (lesson.tier === "silver" && tiers.canViewSilver) {
    isAuthorized = true;
  } else if (lesson.tier === "gold" && tiers.canViewGold) {
    isAuthorized = true;
  } else if (lesson.tier === "diamond" && tiers.canViewDiamond) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return { ok: false, error: "forbidden_unentitled" };
  }

  // 3. Return sanitized payload with protected BIGVU embed URL
  return {
    ok: true,
    lesson: {
      id: lesson.id,
      tier: lesson.tier,
      title: lesson.title,
      duration: lesson.duration,
      durationSeconds: lesson.duration_seconds,
      minWatchSeconds: lesson.min_watch_seconds,
      desc: lesson.desc,
      embedUrl: lesson.embed_url, // Exposed strictly to verified member
      materials: (lesson.materials as any) || [],
      takeaways: (lesson.takeaways as any) || [],
      sequenceOrder: lesson.sequence_order,
    },
  };
}
