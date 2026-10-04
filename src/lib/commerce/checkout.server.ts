/**
 * Commerce Checkout & Upgrade Data Server Layer
 * Fetches server-calculated pricing, eligibility status, cohort start dates,
 * bonus seat limits, milestone lines, and policy text.
 */

import { createServerFn } from "@tanstack/react-start";
import { createPublicServerClient } from "@/lib/supabase-public.server";
import {
  computeOrderPricing,
  getSilverMilestonePricing,
  type ProductId,
  type PricingCalculationResult,
} from "./pricing.server";

export interface CheckoutPageData {
  product: ProductId;
  productTitle: string;
  includedDescription: string;
  termDescription: string;
  includesBullets: string[];
  pricing: PricingCalculationResult;
  onSale: boolean;
  state:
    | "eligible"
    | "window_ended"
    | "already_owns"
    | "not_eligible"
    | "off_sale"
    | "included_in_tier"
    | "renewal";
  stateMessage?: string | undefined;
  redirectUrl?: string | undefined;
  upgradeDeadlineFormatted?: string | null | undefined;
  milestoneLine?: string | null | undefined;
  bonusLine?: string | null | undefined;
  cohortStartDateFormatted?: string | null | undefined;
  renewalNewEndDateFormatted?: string | null | undefined;
  prefill?: {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
  } | undefined;
}

export function formatIndianDateOnly(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Loads checkout or upgrade page context.
 * Performs all checks strictly on the server.
 */
export const getCheckoutPageDataFn = createServerFn({ method: "POST" })
  .inputValidator((data: { product: ProductId; email?: string | null; isUpgrade?: boolean }) => data)
  .handler(async ({ data }): Promise<CheckoutPageData> => {
    const db = createPublicServerClient();
    const cleanEmail = (data.email || "").trim().toLowerCase();

    // 1. Fetch settings
    const { data: settingsRow } = await db
      .from("commerce_settings" as never)
      .select("*")
      .eq("id" as never, 1 as never)
      .maybeSingle();

    const settings = (settingsRow as any) || {
      mrc_base_price: 601,
      silver_base_price: 6001,
      gold_base_price: 24000,
      gold_completer_price: 18001,
      diamond_base_price: 60001,
      diamond_renewal_price: 60001,
      gold_on_sale: false,
      diamond_on_sale: false,
      bonus_seats_limit: 10,
    };

    // 2. Fetch User's Active Access Grants (if email provided)
    let activeGrants: any[] = [];
    let memberName = "";
    let memberPhone = "";

    if (cleanEmail) {
      const { data: grants } = await db
        .from("member_access_grants" as never)
        .select("*")
        .eq("email" as never, cleanEmail as never)
        .eq("status" as never, "active" as never);

      activeGrants = ((grants ?? []) as any[]).filter((g) => {
        if (!g.expires_at) return true;
        return new Date(g.expires_at).getTime() > Date.now();
      });

      // Find user details from latest order or registration
      const { data: latestOrder } = await db
        .from("orders" as never)
        .select("buyer_name, buyer_phone")
        .eq("buyer_email" as never, cleanEmail as never)
        .order("created_at" as never, { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestOrder) {
        memberName = (latestOrder as any).buyer_name || "";
        memberPhone = (latestOrder as any).buyer_phone || "";
      } else {
        const { data: reg } = await db
          .from("registrations" as never)
          .select("full_name, phone_e164")
          .eq("email" as never, cleanEmail as never)
          .limit(1)
          .maybeSingle();
        if (reg) {
          memberName = (reg as any).full_name || "";
          memberPhone = (reg as any).phone_e164 || "";
        }
      }
    }

    const hasMrc = activeGrants.some((g) => g.access_tier === "money_reality_check");
    const hasSilver = activeGrants.some((g) => g.access_tier === "silver");
    const hasGold = activeGrants.some((g) => g.access_tier === "gold");
    const hasDiamond = activeGrants.some((g) => g.access_tier === "diamond");

    // 3. Define Product Metadata
    let productTitle = "";
    let termDescription = "";
    let includedDescription = "";
    let bulletsRaw = "";

    switch (data.product) {
      case "money_reality_check":
        productTitle = "The Money Reality Check";
        termDescription = "Lifetime access to diagnostic curriculum & tools";
        includedDescription = "Grants Money Reality Check track and 4 tools. 1 Thursday guest seat (60 days) and 60 days community access.";
        bulletsRaw = settings.mrc_included_bullets || `• Money Reality Check 12 recorded diagnostic sessions
• 4 diagnostic calculator & audit sheets
• 1 Thursday guest seat to use within 60 days
• 60 days of community access`;
        break;
      case "silver":
        productTitle = "The Calm Money System (Silver)";
        termDescription = "Lifetime access.";
        includedDescription = "Grants /course Silver access and assigns buyer to cohort.";
        bulletsRaw = settings.silver_included_bullets || `• Full consolidated financial audit spreadsheet & training
• Real return calculation model (accounting for 30% tax & inflation)
• Nomination, MWP Act & insurance protection architecture checklist
• The One Page Plan template your family can act on
• Direct access to recorded video sessions with zero expiration`;
        break;
      case "gold":
        productTitle = "The Calm Money System (Gold)";
        termDescription = "Includes Silver. Lifetime access.";
        includedDescription = "Grants lifetime Gold access and lifetime Silver access.";
        bulletsRaw = settings.gold_included_bullets || `• Includes Silver: Lifetime access
• Advanced wealth transmission & private office sessions
• Quarterly portfolio architecture reviews
• Priority cohort positioning`;
        break;
      case "diamond":
      case "diamond_renewal":
        productTitle = "The Calm Money System (Diamond)";
        termDescription = "Includes Silver and Gold. Diamond access for 12 months.";
        includedDescription = "Grants Diamond access for 12 months from payment, plus lifetime Silver and Gold access.";
        bulletsRaw = settings.diamond_included_bullets || `• Includes Silver and Gold: Lifetime access
• 12 months of direct Diamond private office advisory
• Bespoke estate, trust & tax optimization architecture
• Direct 1-on-1 private advisory access`;
        break;
    }

    const includesBullets = bulletsRaw
      .split("\n")
      .map((b: string) => b.trim().replace(/^[•\-*]\s*/, ""))
      .filter((b: string) => Boolean(b));

    // 4. Milestone & Cohort Info for Silver
    let milestoneLine: string | null = null;
    let bonusLine: string | null = null;
    let cohortStartDateFormatted: string | null = null;

    if (data.product === "silver") {
      const milestoneInfo = await getSilverMilestonePricing();
      if (milestoneInfo.nextThreshold && milestoneInfo.nextPrice) {
        milestoneLine = `Silver members so far: ${milestoneInfo.activeCount}. The price moves to ₹${milestoneInfo.nextPrice.toLocaleString("en-IN")} after member ${milestoneInfo.nextThreshold}.`;
      }

      // Fetch active/next cohort
      const { data: cohortRow } = await db
        .from("cohorts" as never)
        .select("*")
        .eq("status" as never, "active" as never)
        .order("start_date" as never, { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cohortRow) {
        const cohort = cohortRow as any;
        if (cohort.start_date) {
          cohortStartDateFormatted = `Starts on ${formatIndianDateOnly(cohort.start_date)}`;
        }
        const memberCount = Number(cohort.current_member_count) || 0;
        const bonusLimit = Number(settings.bonus_seats_limit) || 10;
        const spotsLeft = Math.max(0, bonusLimit - memberCount);

        if (cohort.bonuses_active !== false && spotsLeft > 0) {
          bonusLine = `The first 10 members of this cohort get 30 minutes with me, one to one. Spots left: ${spotsLeft}.`;
        }
      }
    }

    // 5. Compute Pricing
    const pricing = await computeOrderPricing({
      product: data.product,
      email: cleanEmail || "anonymous@buyer.onepageplan.in",
    });

    // 6. Resolve State & Messages
    let state: CheckoutPageData["state"] = "eligible";
    let stateMessage: string | undefined = undefined;
    let upgradeDeadlineFormatted: string | null = null;
    let renewalNewEndDateFormatted: string | null = null;

    // Check On-Sale switches
    if (data.product === "gold" && !settings.gold_on_sale) {
      state = "off_sale";
      stateMessage = "Gold opens to Silver members first.";
    } else if (
      (data.product === "diamond" || data.product === "diamond_renewal") &&
      !settings.diamond_on_sale
    ) {
      state = "off_sale";
      stateMessage = "Diamond is not open yet.";
    }

    // Check Already Included / Owned
    if (state === "eligible" && cleanEmail) {
      if (data.product === "money_reality_check" && hasMrc) {
        state = "already_owns";
        stateMessage = "You already own Money Reality Check.";
      } else if (data.product === "silver") {
        if (hasGold || hasDiamond) {
          state = "included_in_tier";
          stateMessage = "Silver is already included in your membership.";
        } else if (hasSilver) {
          state = "already_owns";
          stateMessage = "You already have Silver access.";
        }
      } else if (data.product === "gold") {
        if (hasDiamond) {
          state = "included_in_tier";
          stateMessage = "Gold is already included in your Diamond membership.";
        } else if (hasGold) {
          state = "already_owns";
          stateMessage = "You already have Gold access.";
        }
      } else if (data.product === "diamond") {
        // Check if renewal scenario: Diamond year ended or within 30 days of ending
        const diamondGrant = activeGrants.find((g) => g.access_tier === "diamond");
        if (diamondGrant && diamondGrant.expires_at) {
          const expiresAt = new Date(diamondGrant.expires_at).getTime();
          const msLeft = expiresAt - Date.now();
          const daysLeft = msLeft / (1000 * 3600 * 24);

          if (daysLeft <= 30) {
            state = "renewal";
            const newExpiry = new Date(Math.max(Date.now(), expiresAt) + 365 * 24 * 3600 * 1000);
            renewalNewEndDateFormatted = formatIndianDateOnly(newExpiry);
          } else {
            state = "already_owns";
            stateMessage = `You already have active Diamond membership until ${formatIndianDateOnly(diamondGrant.expires_at)}.`;
          }
        }
      }
    }

    // 7. Handle Specific Upgrade Pages
    if (data.isUpgrade) {
      if (data.product === "silver") {
        // /upgrade/silver: Money Reality Check buyers upgrading with locked credit
        const mrcGrant = activeGrants.find((g) => g.access_tier === "money_reality_check");
        if (!cleanEmail || !mrcGrant) {
          state = "not_eligible";
          stateMessage = "This upgrade is exclusively for Money Reality Check buyers.";
        } else if (mrcGrant.silver_upgrade_deadline) {
          const isWithinWindow = new Date(mrcGrant.silver_upgrade_deadline).getTime() >= Date.now();
          upgradeDeadlineFormatted = `Available until ${formatIndianDateOnly(mrcGrant.silver_upgrade_deadline)}`;

          if (!isWithinWindow) {
            state = "window_ended";
            stateMessage = "Your 30-day upgrade window has ended. You can join at the current standard price.";
          }
        }
      } else if (data.product === "gold") {
        // /upgrade/gold: Silver completers upgrading with special upgrade price
        const { data: completion } = await db
          .from("course_completions" as never)
          .select("*, cohorts(*)")
          .eq("email" as never, cleanEmail as never)
          .maybeSingle();

        if (!cleanEmail || !completion) {
          state = "not_eligible";
          stateMessage = "This special upgrade price is exclusively for Silver completers who submitted on or before their cohort deadline.";
        } else {
          const compRecord = completion as any;
          const deadline = compRecord.gold_upgrade_deadline || compRecord.cohorts?.submission_deadline;
          const isEligible = compRecord.is_before_deadline || compRecord.gold_upgrade_eligible;
          const isWithinDeadline = deadline ? new Date(deadline).getTime() >= Date.now() : false;

          if (deadline) {
            upgradeDeadlineFormatted = `Available until ${formatIndianDateOnly(deadline)}`;
          }

          if (!isEligible) {
            state = "not_eligible";
            stateMessage = "This special upgrade price is exclusively for Silver completers who completed on or before their cohort deadline.";
          } else if (!isWithinDeadline) {
            state = "window_ended";
            stateMessage = "Your special upgrade window for this cohort has ended.";
          }
        }
      }
    }

    return {
      product: data.product,
      productTitle,
      includedDescription,
      termDescription,
      includesBullets,
      pricing,
      onSale:
        data.product === "gold"
          ? settings.gold_on_sale
          : data.product === "diamond" || data.product === "diamond_renewal"
          ? settings.diamond_on_sale
          : true,
      state,
      stateMessage,
      redirectUrl: pricing.redirectUrl || "/course",
      upgradeDeadlineFormatted,
      milestoneLine,
      bonusLine,
      cohortStartDateFormatted,
      renewalNewEndDateFormatted,
      prefill: {
        name: memberName,
        email: cleanEmail,
        phone: memberPhone,
      },
    };
  });

/**
 * Loads Legal Policy Content (terms, privacy, refund, shipping, contact)
 * Editable in admin as markdown. Falls back to "This policy is being updated."
 */
export const getLegalPolicyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { policy: "terms" | "privacy" | "refund" | "shipping" | "contact" }) => data)
  .handler(async ({ data }) => {
    const db = createPublicServerClient();
    const { data: settingsRow } = await db
      .from("commerce_settings" as never)
      .select("*")
      .eq("id" as never, 1 as never)
      .maybeSingle();

    const settings = (settingsRow as any) || {
      registered_business_name: "The One Page Plan LLP",
      registered_address: "Bandra West, Mumbai 400050, India",
    };

    let customMarkdown: string | null = null;
    let title = "";

    switch (data.policy) {
      case "terms":
        title = "Terms of Use";
        customMarkdown = settings.policy_terms_markdown || null;
        break;
      case "privacy":
        title = "Privacy Policy";
        customMarkdown = settings.policy_privacy_markdown || null;
        break;
      case "refund":
        title = "Cancellation & Refund Policy";
        customMarkdown = settings.policy_refund_markdown || null;
        break;
      case "shipping":
        title = "Shipping & Delivery Policy";
        customMarkdown = settings.policy_shipping_markdown || null;
        break;
      case "contact":
        title = "Contact Us";
        customMarkdown = settings.policy_contact_markdown || null;
        break;
    }

    return {
      title,
      customMarkdown,
      businessName: settings.registered_business_name || "The One Page Plan LLP",
      registeredAddress: settings.registered_address || "Bandra West, Mumbai 400050, India",
      supportEmail: "connect@onepageplan.in",
      gstin: settings.gstin || null,
    };
  });
