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

// Built-in approved Meta templates for the webinar & commerce system (exactly the 7 approved in Meta WhatsApp Manager)
const CORE_META_TEMPLATES: TemplateDefinition[] = [
  {
    key: "webinar_confirmation",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "webinar_confirmation",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nYour seat for The One Page Plan masterclass is confirmed.\n\nDate & Time: 7:00 PM IST\nLive Room: {{2}}\n\nSee you inside!`,
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
    body: `Hello {{1}},\n\nWe start The One Page Plan masterclass in 2 hours at 7:00 PM IST.\n\nRoom link:\n{{2}}\n\nPlease join 5 minutes early.`,
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
    body: `Hello {{1}},\n\nThe Money Reality room is open! Milan Dodhia is starting in 15 minutes.\n\nTap below to enter:\n{{2}}`,
    variables: ["first_name", "room_url"],
    isActive: true,
  },
  {
    key: "webinar_live_now",
    channel: "whatsapp",
    category: "marketing",
    metaTemplateName: "webinar_live_now",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},\n\nThe Money Reality session is LIVE right now! Milan Dodhia has started the presentation.\n\nJoin here:\n{{2}}`,
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
    body: `Hello {{1}},\n\nYou registered for today's masterclass but missed the live session. To measure your own numbers, Money Reality Check is available.\n\nDetails:\n{{2}}`,
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
    body: `Hello {{1}},\n\nThank you for joining. Your enrollment is confirmed.\n\nYour diagnostic sessions and tools are unlocked here:\n{{2}}\n\nDownload receipt: {{3}}\n\nWarmly,\nMilan Dodhia`,
    variables: ["first_name", "member_area_url", "invoice_url"],
    isActive: true,
  },
  {
    key: "3p_direct_integration_test",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "3p_direct_integration_test",
    metaLanguage: "en_US",
    metaApprovalStatus: "APPROVED",
    body: `Welcome! This is a test message from Milan Dodhia: Hello {{1}}, your WhatsApp Cloud API integration is operational.`,
    variables: ["first_name"],
    isActive: true,
  },
];

/**
 * Calls Meta WhatsApp Cloud API to fetch live templates for the WhatsApp Business Account.
 */
export async function fetchMetaTemplates(): Promise<MetaFetchResult> {
  let token =
    process.env["WHATSAPP_ACCESS_TOKEN"]?.trim().replace(/^["']|["']$/g, "") || "";
  let wabaId =
    process.env["WHATSAPP_WABA_ID"]?.trim().replace(/^["']|["']$/g, "") ||
    process.env["WHATSAPP_BUSINESS_ACCOUNT_ID"]?.trim().replace(/^["']|["']$/g, "") ||
    "";
  let phoneId =
    process.env["WHATSAPP_PHONE_NUMBER_ID"]?.trim().replace(/^["']|["']$/g, "") || "";
  const apiVersion = process.env["WHATSAPP_API_VERSION"]?.trim() || "v21.0";
  const cleanVersion = apiVersion.startsWith("v") ? apiVersion : `v${apiVersion}`;

  // Check app_config for stored settings if not in process.env
  try {
    const db = createPublicServerClient();
    if (!token) {
      const { data: tokenRow } = await db.from("app_config" as never).select("value").eq("key" as never, "whatsapp_access_token" as never).maybeSingle();
      if ((tokenRow as any)?.value) token = (tokenRow as any).value;
    }
    if (!wabaId) {
      const { data: wabaRow } = await db.from("app_config" as never).select("value").eq("key" as never, "whatsapp_waba_id" as never).maybeSingle();
      if ((wabaRow as any)?.value) wabaId = (wabaRow as any).value;
      if (!wabaId) {
        const { data: bizRow } = await db.from("app_config" as never).select("value").eq("key" as never, "whatsapp_business_account_id" as never).maybeSingle();
        if ((bizRow as any)?.value) wabaId = (bizRow as any).value;
      }
    }
    if (!phoneId) {
      const { data: phoneRow } = await db.from("app_config" as never).select("value").eq("key" as never, "whatsapp_phone_number_id" as never).maybeSingle();
      if ((phoneRow as any)?.value) phoneId = (phoneRow as any).value;
    }
  } catch {
    // Non-fatal
  }

  if (!token) {
    return {
      live: false,
      count: CORE_META_TEMPLATES.length,
      error: "WHATSAPP_ACCESS_TOKEN not configured in environment.",
      templates: CORE_META_TEMPLATES,
    };
  }

  // Auto-discovery strategy if WABA ID is missing:
  // Strategy 1: Query phone number object for its parent whatsapp_business_account
  if (!wabaId && phoneId) {
    try {
      const phoneRes = await fetch(
        `https://graph.facebook.com/${cleanVersion}/${phoneId}?fields=whatsapp_business_account`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (phoneRes.ok) {
        const phoneData = (await phoneRes.json()) as any;
        wabaId = phoneData.whatsapp_business_account?.id || "";
      }
    } catch {
      // Fallback
    }
  }

  // Strategy 2: Query /me/whatsapp_business_accounts
  if (!wabaId) {
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/${cleanVersion}/me/whatsapp_business_accounts`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (meRes.ok) {
        const meData = (await meRes.json()) as any;
        wabaId = meData.data?.[0]?.id || "";
      }
    } catch {
      // Fallback
    }
  }

  // Strategy 3: Query debug_token to extract granular_scopes for WABA ID
  if (!wabaId) {
    try {
      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`,
      );
      if (debugRes.ok) {
        const debugData = (await debugRes.json()) as any;
        const scopes = debugData?.data?.granular_scopes || [];
        const wabaScope = scopes.find((s: any) => s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging");
        if (wabaScope?.target_ids?.[0]) {
          wabaId = String(wabaScope.target_ids[0]);
        }
      }
    } catch {
      // Fallback
    }
  }

  if (!wabaId) {
    return {
      live: false,
      count: CORE_META_TEMPLATES.length,
      error: "WHATSAPP_WABA_ID is not configured. Serving approved registered templates.",
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

    // Asynchronously cache templates to database
    try {
      const db = createPublicServerClient();
      for (const t of parsedTemplates) {
        await db.from("message_templates" as never).upsert(
          {
            key: t.key,
            channel: "whatsapp",
            category: t.category,
            meta_template_name: t.metaTemplateName,
            meta_language: t.metaLanguage,
            meta_approval_status: t.metaApprovalStatus,
            body: t.body,
            variables: t.variables,
            is_active: t.isActive,
          } as never,
          { onConflict: "key" },
        );
      }
    } catch {
      // Non-fatal cache failure
    }

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
        } else if (row.channel === "email") {
          templateMap.set(row.key, {
            key: row.key,
            channel: row.channel,
            category: row.category,
            subject: row.subject,
            body: row.body,
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
