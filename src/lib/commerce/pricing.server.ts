/**
 * Commerce Foundation: Pricing Engine (Server-side)
 * Handles server-calculated pricing, rounding rules, upgrade windows,
 * milestone member counting, discount validation, and product access restrictions.
 */

import { createPublicServerClient } from "@/lib/supabase-public.server";

export type ProductId =
  | "money_reality_check"
  | "silver"
  | "gold"
  | "diamond"
  | "diamond_renewal";

export type PricingRule =
  | "full_price"
  | "mrc_credit"
  | "special_upgrade_price"
  | "diamond_renewal";

export interface PricingCalculationResult {
  ok: boolean;
  product: ProductId;
  basePrice: number;
  creditApplied: number;
  specialUpgradeDiscount: number;
  discountCodeApplied?: string | null;
  discountAmount: number;
  amountCharged: number; // In INR
  amountPaise: number; // In paise for Razorpay
  pricingRule: PricingRule;
  referralCode?: string | null;
  alreadyOwned?: boolean;
  redirectUrl?: string;
  error?: string;
}

/**
 * Rounding rule for all credit upgrades:
 * Subtract credit, then round up to the next amount ending in 01.
 * Examples:
 *   5,400 -> 5,401
 *   17,998 -> 18,001
 *   18,001 -> 18,001
 */
export function roundUp01(amount: number): number {
  if (amount <= 0) return 1;
  const rem = amount % 100;
  if (rem === 1) return amount;
  return Math.floor(amount / 100) * 100 + (rem > 1 ? 101 : 1);
}

/**
 * Formats an amount in INR with Indian numbering and the ₹ symbol (e.g. ₹5,401).
 */
export function formatRupees(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "₹0";
  return `₹${Math.round(Number(amount)).toLocaleString("en-IN")}`;
}

/**
 * Calculates current Silver pricing according to active unrefunded Silver purchases
 * evaluated against the milestone table in commerce_settings.
 */
export async function getSilverMilestonePricing(): Promise<{
  activeCount: number;
  currentPrice: number;
  nextThreshold: number | null;
  nextPrice: number | null;
}> {
  const db = createPublicServerClient();
  const { data, error } = await (db.rpc as any)("compute_current_silver_pricing");

  if (error || !data) {
    return {
      activeCount: 0,
      currentPrice: 6001,
      nextThreshold: 100,
      nextPrice: 7001,
    };
  }

  return {
    activeCount: Number(data.current_count) || 0,
    currentPrice: Number(data.current_price) || 6001,
    nextThreshold: data.next_threshold ? Number(data.next_threshold) : null,
    nextPrice: data.next_price ? Number(data.next_price) : null,
  };
}

export function resolveMilestoneSilverPrice(
  activeCount: number = 0,
  basePrice: number = 6001,
  schedule: Array<{ threshold: number; price: number }> = [],
): { currentPrice: number; nextThreshold: number | null; nextPrice: number | null } {
  const sorted = [...schedule].sort((a, b) => a.threshold - b.threshold);
  let currentPrice = basePrice;
  let nextThreshold: number | null = null;
  let nextPrice: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item && activeCount >= item.threshold) {
      currentPrice = item.price;
    } else if (item) {
      nextThreshold = item.threshold;
      nextPrice = item.price;
      break;
    }
  }

  return { currentPrice, nextThreshold, nextPrice };
}

export interface PurePricingParams {
  product: ProductId;
  activeSilverCount?: number;
  milestoneSchedule?: Array<{ threshold: number; price: number }>;
  settings?: {
    gold_on_sale?: boolean;
    diamond_on_sale?: boolean;
    mrc_base_price?: number;
    silver_base_price?: number;
    gold_base_price?: number;
    gold_completer_price?: number;
    diamond_base_price?: number;
    diamond_renewal_price?: number;
  };
  existingEntitlements?: string[];
  mrcGrant?: {
    locked_silver_upgrade_price?: number;
    silver_upgrade_deadline?: string;
  } | null;
  completion?: {
    is_completed?: boolean;
    is_before_deadline?: boolean;
    gold_upgrade_eligible?: boolean;
    submission_deadline?: string;
    gold_upgrade_deadline?: string;
    total_silver_paid?: number;
  } | null;
  discount?: {
    code: string;
    discount_amount: number;
    final_amount: number;
  } | null;
  referralCode?: string | null | undefined;
}

export function computePurePricing(params: PurePricingParams): PricingCalculationResult {
  const settings = {
    gold_on_sale: params.settings?.gold_on_sale ?? false,
    diamond_on_sale: params.settings?.diamond_on_sale ?? false,
    mrc_base_price: params.settings?.mrc_base_price ?? 601,
    silver_base_price: params.settings?.silver_base_price ?? 6001,
    gold_base_price: params.settings?.gold_base_price ?? 24000,
    gold_completer_price: params.settings?.gold_completer_price ?? 18001,
    diamond_base_price: params.settings?.diamond_base_price ?? 60001,
    diamond_renewal_price: params.settings?.diamond_renewal_price ?? 60001,
  };

  const entitlements = params.existingEntitlements || [];
  const hasMrc = entitlements.includes("money_reality_check");
  const hasSilver = entitlements.includes("silver");
  const hasGold = entitlements.includes("gold");
  const hasDiamond = entitlements.includes("diamond");

  // Ownership & restriction check
  if (params.product === "money_reality_check" && hasMrc) {
    return {
      ok: false,
      product: params.product,
      basePrice: 601,
      creditApplied: 0,
      specialUpgradeDiscount: 0,
      discountAmount: 0,
      amountCharged: 601,
      amountPaise: 60100,
      pricingRule: "full_price",
      alreadyOwned: true,
      redirectUrl: "/course",
      error: "You already own Money Reality Check.",
    };
  }

  if (params.product === "silver" && (hasSilver || hasGold || hasDiamond)) {
    return {
      ok: false,
      product: params.product,
      basePrice: 6001,
      creditApplied: 0,
      specialUpgradeDiscount: 0,
      discountAmount: 0,
      amountCharged: 6001,
      amountPaise: 600100,
      pricingRule: "full_price",
      alreadyOwned: true,
      redirectUrl: "/course",
      error: "You already have Silver access.",
    };
  }

  if (params.product === "gold") {
    if (hasGold || hasDiamond) {
      return {
        ok: false,
        product: params.product,
        basePrice: 24000,
        creditApplied: 0,
        specialUpgradeDiscount: 0,
        discountAmount: 0,
        amountCharged: 24000,
        amountPaise: 2400000,
        pricingRule: "full_price",
        alreadyOwned: true,
        redirectUrl: "/course",
        error: "You already have Gold access.",
      };
    }

    if (!settings.gold_on_sale) {
      return {
        ok: false,
        product: params.product,
        basePrice: 24000,
        creditApplied: 0,
        specialUpgradeDiscount: 0,
        discountAmount: 0,
        amountCharged: 24000,
        amountPaise: 2400000,
        pricingRule: "full_price",
        error: "Gold is currently not on sale.",
      };
    }
  }

  if (params.product === "diamond") {
    if (hasDiamond) {
      return {
        ok: false,
        product: params.product,
        basePrice: 60001,
        creditApplied: 0,
        specialUpgradeDiscount: 0,
        discountAmount: 0,
        amountCharged: 60001,
        amountPaise: 6000100,
        pricingRule: "full_price",
        alreadyOwned: true,
        redirectUrl: "/course",
        error: "You already have active Diamond membership.",
      };
    }

    if (!settings.diamond_on_sale) {
      return {
        ok: false,
        product: params.product,
        basePrice: 60001,
        creditApplied: 0,
        specialUpgradeDiscount: 0,
        discountAmount: 0,
        amountCharged: 60001,
        amountPaise: 6000100,
        pricingRule: "full_price",
        error: "Diamond is currently not on sale.",
      };
    }
  }

  if (params.product === "diamond_renewal" && !settings.diamond_on_sale) {
    return {
      ok: false,
      product: params.product,
      basePrice: 60001,
      creditApplied: 0,
      specialUpgradeDiscount: 0,
      discountAmount: 0,
      amountCharged: 60001,
      amountPaise: 6000100,
      pricingRule: "diamond_renewal",
      error: "Diamond renewals are currently not available.",
    };
  }

  // Calculate prices
  let basePrice = 0;
  let creditApplied = 0;
  let specialUpgradeDiscount = 0;
  let pricingRule: PricingRule = "full_price";
  let targetCharged = 0;

  if (params.product === "money_reality_check") {
    basePrice = Number(settings.mrc_base_price) || 601;
    targetCharged = basePrice;
    pricingRule = "full_price";
  } else if (params.product === "silver") {
    const milestoneInfo = resolveMilestoneSilverPrice(
      params.activeSilverCount || 0,
      settings.silver_base_price || 6001,
      params.milestoneSchedule || [],
    );
    const currentMilestonePrice = milestoneInfo.currentPrice;

    if (params.mrcGrant && params.mrcGrant.silver_upgrade_deadline) {
      const isWithinWindow = new Date(params.mrcGrant.silver_upgrade_deadline).getTime() >= Date.now();
      if (isWithinWindow) {
        basePrice = Number(params.mrcGrant.locked_silver_upgrade_price) || currentMilestonePrice;
        creditApplied = 601;
        targetCharged = roundUp01(basePrice - creditApplied);
        pricingRule = "mrc_credit";
      } else {
        basePrice = currentMilestonePrice;
        creditApplied = 0;
        targetCharged = basePrice;
        pricingRule = "full_price";
      }
    } else {
      basePrice = currentMilestonePrice;
      targetCharged = basePrice;
      pricingRule = "full_price";
    }
  } else if (params.product === "gold") {
    basePrice = Number(settings.gold_base_price) || 24000;
    if (params.completion) {
      const deadline = params.completion.gold_upgrade_deadline || params.completion.submission_deadline;
      const isEligible = params.completion.is_completed && (params.completion.is_before_deadline ?? true);
      const isWithinDeadline = deadline ? new Date(deadline).getTime() >= Date.now() : false;

      if (isEligible && isWithinDeadline) {
        targetCharged = Number(settings.gold_completer_price) || 18001;
        specialUpgradeDiscount = basePrice - targetCharged;
        pricingRule = "special_upgrade_price";
      } else {
        targetCharged = basePrice;
        pricingRule = "full_price";
      }
    } else {
      targetCharged = basePrice;
      pricingRule = "full_price";
    }
  } else if (params.product === "diamond") {
    basePrice = Number(settings.diamond_base_price) || 60001;
    targetCharged = basePrice;
    pricingRule = "full_price";
  } else if (params.product === "diamond_renewal") {
    basePrice = Number(settings.diamond_renewal_price) || 60001;
    targetCharged = basePrice;
    pricingRule = "diamond_renewal";
  }

  // Discounts
  let discountAmount = 0;
  let discountCodeApplied: string | null = null;
  if (params.discount) {
    discountCodeApplied = params.discount.code;
    discountAmount = params.discount.discount_amount;
    targetCharged = params.discount.final_amount;
  }

  targetCharged = Math.max(1, targetCharged);

  return {
    ok: true,
    product: params.product,
    basePrice,
    creditApplied,
    specialUpgradeDiscount,
    discountCodeApplied,
    discountAmount,
    amountCharged: targetCharged,
    amountPaise: targetCharged * 100,
    pricingRule,
    referralCode: params.referralCode ? params.referralCode.trim().toLowerCase() : null,
  };
}

/**
 * Primary Pricing Engine
 * Validates ownership, checks on-sale switches, locks upgrade windows,
 * and computes exact order total. Browser never provides price.
 */
export async function computeOrderPricing(params: {
  product: ProductId;
  email: string;
  discountCode?: string | null | undefined;
  referralCode?: string | null | undefined;
}): Promise<PricingCalculationResult> {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  const db = createPublicServerClient();

  if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return {
      ok: false,
      product: params.product,
      basePrice: 0,
      creditApplied: 0,
      specialUpgradeDiscount: 0,
      discountAmount: 0,
      amountCharged: 0,
      amountPaise: 0,
      pricingRule: "full_price",
      error: "valid_email_required",
    };
  }

  // 1. Fetch Commerce Settings
  const { data: settingsRow } = await db
    .from("commerce_settings" as never)
    .select("*")
    .eq("id" as never, 1 as never)
    .maybeSingle();

  const settings = (settingsRow as any) || {
    gold_on_sale: false,
    diamond_on_sale: false,
    mrc_base_price: 601,
    silver_base_price: 6001,
    gold_base_price: 24000,
    gold_completer_price: 18001,
    diamond_base_price: 60001,
    diamond_renewal_price: 60001,
  };

  // 2. Fetch User's Active Access Grants
  const { data: grants } = await db
    .from("member_access_grants" as never)
    .select("*")
    .eq("email" as never, cleanEmail as never)
    .eq("status" as never, "active" as never);

  const activeGrants = ((grants ?? []) as any[]).filter((g) => {
    if (!g.expires_at) return true;
    return new Date(g.expires_at).getTime() > Date.now();
  });

  const existingEntitlements = activeGrants.map((g) => g.access_tier);
  const mrcGrant = activeGrants.find((g) => g.access_tier === "money_reality_check") || null;

  // 3. Fetch completion
  let completion = null;
  const { data: compData } = await db
    .from("course_completions" as never)
    .select("*, cohorts(*)")
    .eq("email" as never, cleanEmail as never)
    .maybeSingle();
  if (compData) {
    const compRecord = compData as any;
    completion = {
      is_completed: Boolean(compRecord.is_completed),
      is_before_deadline: Boolean(compRecord.is_before_deadline),
      submission_deadline: compRecord.cohorts?.submission_deadline || compRecord.gold_upgrade_deadline,
      gold_upgrade_deadline: compRecord.gold_upgrade_deadline,
      total_silver_paid: Number(compRecord.total_silver_paid) || 6001,
    };
  }

  // 4. Milestone pricing info
  const milestoneInfo = await getSilverMilestonePricing();

  // 5. Discount code validation
  let discount = null;
  if (params.discountCode && params.discountCode.trim()) {
    const { data: dcRes } = await (db.rpc as any)("validate_discount_code", {
      p_code: params.discountCode.trim().toUpperCase(),
      p_product: params.product,
      p_amount: 100000,
    });
    if (dcRes && dcRes.valid) {
      discount = {
        code: dcRes.code,
        discount_amount: Number(dcRes.discount_amount) || 0,
        final_amount: Number(dcRes.final_amount) || 0,
      };
    }
  }

  return computePurePricing({
    product: params.product,
    activeSilverCount: milestoneInfo.activeCount,
    milestoneSchedule: settings.silver_milestones || [],
    settings,
    existingEntitlements,
    mrcGrant,
    completion,
    discount,
    referralCode: params.referralCode,
  });
}

export async function hasActiveAccess(email: string, tier: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  const db = createPublicServerClient();
  const { data: grant } = await db
    .from("member_access_grants" as never)
    .select("id, status, expires_at")
    .eq("email" as never, cleanEmail as never)
    .eq("access_tier" as never, tier as never)
    .eq("status" as never, "active" as never)
    .maybeSingle();

  if (!grant) return false;
  const g = grant as any;
  if (!g.expires_at) return true;
  return new Date(g.expires_at).getTime() > Date.now();
}
