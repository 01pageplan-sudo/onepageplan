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

import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function checkTierAccess(
  tier: string,
  email: string,
  userId?: string,
): Promise<boolean> {
  try {
    const res = await (supabaseAdmin.rpc as any)("has_active_access_for_user", {
      p_user_id: userId || null,
      p_email: email,
      p_tier: tier,
    });
    if (!res.error && typeof res.data === "boolean") {
      return res.data;
    }
  } catch {
    // Fall back to legacy has_active_access if migration is not yet loaded
  }

  try {
    const legacyRes = await (supabaseAdmin.rpc as any)("has_active_access", {
      p_email: email,
      p_tier: tier,
    });
    return Boolean(legacyRes.data);
  } catch {
    return false;
  }
}

/**
 * Checks member's active access rights and returns the list of tiers they are entitled to view.
 */
export async function getMemberEntitledTiers(
  email: string,
  userId?: string,
): Promise<{
  canViewMrc: boolean;
  canViewSilver: boolean;
  canViewGold: boolean;
  canViewDiamond: boolean;
}> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail && !userId) {
    return { canViewMrc: false, canViewSilver: false, canViewGold: false, canViewDiamond: false };
  }

  // Admin bypass
  const adminEmails = (process.env["COURSE_ADMIN_EMAILS"] || "dodhia.milan@gmail.com")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim());

  if (cleanEmail && adminEmails.includes(cleanEmail)) {
    return { canViewMrc: true, canViewSilver: true, canViewGold: true, canViewDiamond: true };
  }

  const [hasMrc, hasSilverTier, hasGoldTier, hasDiamondTier] = await Promise.all([
    checkTierAccess("money_reality_check", cleanEmail, userId),
    checkTierAccess("silver", cleanEmail, userId),
    checkTierAccess("gold", cleanEmail, userId),
    checkTierAccess("diamond", cleanEmail, userId),
  ]);

  const hasDiamond = Boolean(hasDiamondTier);
  const hasGold = hasDiamond || Boolean(hasGoldTier);
  const hasSilver = hasGold || Boolean(hasSilverTier);

  return {
    canViewMrc: Boolean(hasMrc),
    canViewSilver,
    canViewGold,
    canViewDiamond,
  };
}

/**
 * Resolves a specific lesson's video stream securely.
 * Rejects if user does not possess active entitlement for the lesson's tier.
 * Never leaks the embed URL on forbidden calls.
 */
export async function getEntitledLessonVideo(params: {
  email: string;
  userId?: string;
  lessonId: string;
}): Promise<{
  ok: boolean;
  lesson?: EntitledLessonPayload;
  error?: string;
}> {
  const cleanEmail = (params.email || "").trim().toLowerCase();

  // 1. Fetch lesson metadata from catalog
  const { data: lessonRow, error: lessonError } = await supabaseAdmin
    .from("course_lessons_catalog" as never)
    .select("*")
    .eq("id" as never, params.lessonId as never)
    .maybeSingle();

  if (lessonError || !lessonRow) {
    return { ok: false, error: "lesson_not_found" };
  }

  const lesson = lessonRow as any;
  const tiers = await getMemberEntitledTiers(cleanEmail, params.userId);

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
