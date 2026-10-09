/**
 * Meta WhatsApp Cloud API (Graph API v21.0) Template Fetcher & Unified Registry
 * Fetches approved message templates directly from Meta WhatsApp Business Account (WABA),
 * and combines them with registered email and transaction templates.
 */

import { INITIAL_TEMPLATES, type TemplateDefinition } from "./template-registry.server";
import { createPublicServerClient } from "@/lib/supabase-public.server";

export interface MetaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  example?: Record<string, unknown>;
  buttons?: Array<{ type: string; text?: string; url?: string }>;
}

export interface MetaGraphTemplate {
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "IN_APPEAL";
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string;
  id?: string;
  components?: MetaTemplateComponent[];
}

export interface MetaFetchResult {
  live: boolean;
  count: number;
  wabaId?: string;
  error?: string;
  templates: TemplateDefinition[];
}

// Built-in approved Meta templates for the webinar & commerce system
const CORE_META_TEMPLATES: TemplateDefinition[] = [
  {
    key: "webinar_confirmation",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "webinar_confirmation",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nYour registration for The One Page Plan masterclass is confirmed.\n\nDate & Time: 7:00 PM IST\nLive Room: {{2}}\n\nSee you inside!`,
    variables: ["first_name", "room_url"],
    isActive: true,
  },
  {
    key: "webinar_reminder_2h",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "webinar_reminder_2h",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nQuick reminder: We go live in 2 hours for The One Page Plan masterclass at 7:00 PM IST.\n\nRoom link:\n{{2}}\n\nPlease join 5 minutes early.`,
    variables: ["first_name", "room_url"],
    isActive: true,
  },
  {
    key: "webinar_reminder_15m",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "webinar_reminder_15m",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nWe start in 15 minutes! The room is open.\n\nTap below to join:\n{{2}}`,
    variables: ["first_name", "room_url"],
    isActive: true,
  },
  {
    key: "webinar_live_now",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "webinar_live_now",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nWe are LIVE right now! Milan Dodhia has started the session.\n\nJoin here:\n{{2}}`,
    variables: ["first_name", "room_url"],
    isActive: true,
  },
  {
    key: "webinar_missed",
    channel: "whatsapp",
    category: "marketing",
    metaTemplateName: "webinar_missed",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nWe missed you at today's masterclass. To help you evaluate your portfolio, Money Reality Check is available.\n\nDetails:\n{{2}}`,
    variables: ["first_name", "mrc_url"],
    isActive: true,
  },
  {
    key: "course_purchase_confirmat",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "course_purchase_confirmat",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nYour enrollment is confirmed.\n\nYour diagnostic sessions and tools are unlocked here:\n{{2}}\n\nDownload receipt: {{3}}\n\nWarmly,\nMilan Dodhia`,
    variables: ["first_name", "member_area_url", "invoice_url"],
    isActive: true,
  },
  {
    key: "payment_failed_recovery",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "payment_failed_recovery",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nWe noticed your payment for {{2}} was not completed. Nothing was charged to your account.\n\nYou can resume checkout here:\n{{3}}`,
    variables: ["first_name", "product_name", "checkout_url"],
    isActive: true,
  },
  {
    key: "mrm_reality_check_followup",
    channel: "whatsapp",
    category: "marketing",
    metaTemplateName: "mrm_reality_check_followup",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nThank you for attending The Money Reality Masterclass. To measure your own family's real returns step by step, Money Reality Check is available for ₹601.\n\nDetails: {{2}}`,
    variables: ["first_name", "mrc_url"],
    isActive: true,
  },
  {
    key: "3p_direct_integration_test",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "3p_direct_integration_test",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Test dispatch from Meta WhatsApp Cloud API: Hello {{1}}, system operational.`,
    variables: ["first_name"],
    isActive: true,
  },
];

/**
 * Calls Meta WhatsApp Cloud API to fetch live templates for the WhatsApp Business Account.
 */
export async function fetchMetaTemplates(): Promise<MetaFetchResult> {
  const token =
    process.env["WHATSAPP_ACCESS_TOKEN"]?.trim().replace(/^["']|["']$/g, "") || "";
  let wabaId =
    process.env["WHATSAPP_WABA_ID"]?.trim().replace(/^["']|["']$/g, "") ||
    process.env["WHATSAPP_BUSINESS_ACCOUNT_ID"]?.trim().replace(/^["']|["']$/g, "") ||
    "";
  const phoneId =
    process.env["WHATSAPP_PHONE_NUMBER_ID"]?.trim().replace(/^["']|["']$/g, "") || "";
  const apiVersion = process.env["WHATSAPP_API_VERSION"]?.trim() || "v21.0";
  const cleanVersion = apiVersion.startsWith("v") ? apiVersion : `v${apiVersion}`;

  if (!token) {
    return {
      live: false,
      count: CORE_META_TEMPLATES.length,
      error: "WHATSAPP_ACCESS_TOKEN not configured in environment.",
      templates: CORE_META_TEMPLATES,
    };
  }

  // If WABA ID is missing, attempt to discover it via Phone Number ID
  if (!wabaId && phoneId) {
    try {
      const phoneRes = await fetch(
        `https://graph.facebook.com/${cleanVersion}/${phoneId}?fields=whatsapp_business_api_data`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (phoneRes.ok) {
        const phoneData = (await phoneRes.json()) as {
          whatsapp_business_api_data?: { id?: string; account_id?: string };
        };
        wabaId =
          phoneData.whatsapp_business_api_data?.id ||
          phoneData.whatsapp_business_api_data?.account_id ||
          "";
      }
    } catch {
      // Fallback
    }
  }

  if (!wabaId) {
    return {
      live: false,
      count: CORE_META_TEMPLATES.length,
      error: "WHATSAPP_WABA_ID is not configured. Using registered catalog templates.",
      templates: CORE_META_TEMPLATES,
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${cleanVersion}/${wabaId}/message_templates?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const errorMsg =
        errJson?.error?.message || `Meta API returned HTTP status ${res.status}`;
      return {
        live: false,
        count: CORE_META_TEMPLATES.length,
        wabaId,
        error: errorMsg,
        templates: CORE_META_TEMPLATES,
      };
    }

    const json = (await res.json()) as { data?: MetaGraphTemplate[] };
    const rawTemplates = json.data || [];

    const parsedTemplates: TemplateDefinition[] = rawTemplates.map((t) => {
      const bodyComp = t.components?.find((c) => c.type === "BODY");
      const bodyText = bodyComp?.text || "";

      // Extract {{1}}, {{2}} variables
      const varMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const varNames = Array.from(new Set(varMatches)).map((m) =>
        m.replace(/[{}]/g, ""),
      );

      return {
        key: t.name,
        channel: "whatsapp",
        category:
          t.category?.toLowerCase() === "marketing" ? "marketing" : "transactional",
        metaTemplateName: t.name,
        metaLanguage: t.language || "en",
        metaApprovalStatus: t.status || "APPROVED",
        body: bodyText,
        variables: varNames,
        isActive: t.status === "APPROVED",
      };
    });

    return {
      live: true,
      count: parsedTemplates.length,
      wabaId,
      templates: parsedTemplates.length > 0 ? parsedTemplates : CORE_META_TEMPLATES,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      live: false,
      count: CORE_META_TEMPLATES.length,
      wabaId,
      error: errorMsg,
      templates: CORE_META_TEMPLATES,
    };
  }
}

/**
 * Returns a fully unified template list combining:
 * 1. Meta WhatsApp templates (live from Meta or fallback catalog)
 * 2. All Email templates (from INITIAL_TEMPLATES)
 * 3. Any database template overrides
 */
export async function getUnifiedTemplateRegistry(): Promise<{
  templates: TemplateDefinition[];
  metaStatus: {
    live: boolean;
    count: number;
    wabaId?: string;
    error?: string;
  };
}> {
  // 1. Fetch Meta WhatsApp templates
  const metaResult = await fetchMetaTemplates();

  // 2. Collect Email templates from INITIAL_TEMPLATES
  const emailTemplates = INITIAL_TEMPLATES.filter((t) => t.channel === "email");

  // 3. Combine WhatsApp and Email templates (avoid duplicates)
  const templateMap = new Map<string, TemplateDefinition>();

  // Add all email templates
  for (const t of emailTemplates) {
    templateMap.set(t.key, t);
  }

  // Add initial WhatsApp templates
  for (const t of INITIAL_TEMPLATES.filter((t) => t.channel === "whatsapp")) {
    templateMap.set(t.key, t);
  }

  // Add core WhatsApp templates
  for (const t of CORE_META_TEMPLATES) {
    templateMap.set(t.key, t);
  }

  // Overlay live Meta templates
  for (const t of metaResult.templates) {
    // If a template with same metaTemplateName exists, update it with live status & copy
    let matched = false;
    for (const [k, existing] of templateMap.entries()) {
      if (existing.metaTemplateName === t.metaTemplateName) {
        templateMap.set(k, {
          ...existing,
          metaApprovalStatus: t.metaApprovalStatus,
          metaLanguage: t.metaLanguage,
          body: t.body || existing.body,
          isActive: t.metaApprovalStatus === "APPROVED",
        });
        matched = true;
      }
    }
    if (!matched) {
      templateMap.set(t.key, t);
    }
  }

  // 4. Try querying database for saved overrides
  try {
    const db = createPublicServerClient();
    const { data: dbTemplates } = await db
      .from("message_templates" as never)
      .select("*");
    if (dbTemplates && Array.isArray(dbTemplates)) {
      for (const row of dbTemplates as any[]) {
        if (!row.key) continue;
        const existing = templateMap.get(row.key);
        if (existing) {
          templateMap.set(row.key, {
            ...existing,
            subject: row.subject ?? existing.subject,
            body: row.body ?? existing.body,
            isActive: row.is_active ?? existing.isActive,
          });
        } else {
          templateMap.set(row.key, {
            key: row.key,
            channel: row.channel,
            category: row.category,
            subject: row.subject,
            body: row.body,
            metaTemplateName: row.meta_template_name,
            metaLanguage: row.meta_language,
            metaApprovalStatus: row.meta_approval_status,
            variables: Array.isArray(row.variables) ? row.variables : [],
            isActive: row.is_active ?? true,
          });
        }
      }
    }
  } catch {
    // Database table might not be created yet, fallback to in-memory catalog
  }

  const allTemplates = Array.from(templateMap.values()).sort((a, b) => {
    if (a.channel !== b.channel) {
      return a.channel === "email" ? -1 : 1;
    }
    return a.key.localeCompare(b.key);
  });

  return {
    templates: allTemplates,
    metaStatus: {
      live: metaResult.live,
      count: metaResult.count,
      wabaId: metaResult.wabaId,
      error: metaResult.error,
    },
  };
}
