import { createPublicServerClient } from "@/lib/supabase-public.server";

export interface TemplateDefinition {
  key: string;
  channel: "email" | "whatsapp";
  category: "transactional" | "marketing";
  subject?: string;
  body: string;
  metaTemplateName?: string;
  metaLanguage?: string;
  metaApprovalStatus?: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED";
  variables: string[];
  isActive?: boolean;
}

export const EMAIL_COMPLIANCE_FOOTER = `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5DFD3; font-size: 11px; line-height: 1.6; color: #6B6A63;">
  Milan Dodhia. Financial Educator. Mannrs Wellness LLP.<br />
  This email is financial education, not financial advice. I do not recommend specific stocks, funds, policies or lenders. I don't sell products, so I don't earn commissions. For tax questions, speak to a Chartered Accountant. For legal questions, speak to a lawyer.<br /><br />
  <a href="{{unsubscribe_url}}" style="color: #6B6A63; text-decoration: underline;">Unsubscribe from marketing emails</a>
</div>`;

export function renderMustacheWithConditionals(body: string, tokens: Record<string, unknown>): string {
  let rendered = body;
  const blockRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  rendered = rendered.replace(blockRegex, (_m: string, key: string, content: string) => {
    return tokens[key] ? content : "";
  });
  for (const [k, v] of Object.entries(tokens)) {
    rendered = rendered.split(`{{${k}}}`).join(String(v ?? ""));
  }
  return rendered;
}

export const INITIAL_TEMPLATES: TemplateDefinition[] = [
  // 1. PURCHASE CONFIRMATIONS (Email + WhatsApp)
  {
    key: "mrc_confirmation_email",
    channel: "email",
    category: "transactional",
    subject: "Your Money Reality Check access details",
    body: `Hello {{first_name}},

Your enrollment in Money Reality Check is confirmed. You now have instant access to the 12 recorded diagnostic sessions and the 4 financial calculation tools.

Amount Paid: {{amount_paid}}
Access your tools & curriculum: {{member_area_url}}
Download your official receipt: {{invoice_url}}

{{#if thursday_booking_url}}
You also have 1 guest seat for our Thursday Inner Circle Call. You can book your seat here:
{{thursday_booking_url}}
{{/if}}

{{#if community}}
Community access link:
{{community_url}}
{{/if}}

Note on upgrading: You can apply your full {{amount_paid}} payment towards The Calm Money System (Silver) for {{upgrade_price}} until {{upgrade_end_date}}.

Warmly,
Milan Dodhia`,
    variables: ["first_name", "amount_paid", "member_area_url", "invoice_url", "thursday_booking_url", "community_url", "upgrade_price", "upgrade_end_date"],
  },
  {
    key: "mrc_confirmation_wa",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "course_purchase_confirmat",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},

Your enrollment in Money Reality Check is confirmed.

Your 12 diagnostic sessions and 4 tools are unlocked here:
{{2}}

Download receipt: {{3}}

Reply to this chat anytime if you need help.

Warmly,
Milan Dodhia`,
    variables: ["first_name", "member_area_url", "invoice_url"],
  },
  {
    key: "silver_confirmation_email",
    channel: "email",
    category: "transactional",
    subject: "Welcome to The Calm Money System",
    body: `Hello {{first_name}},

Your enrollment in The Calm Money System is confirmed. You have lifetime access to the curriculum, tools, and cohort missions.

Amount Paid: {{amount_paid}}
Assigned Cohort: {{cohort_name}}
Cohort Start Date: {{cohort_start_date}}
Member Area: {{member_area_url}}
Official Tax Invoice: {{invoice_url}}

{{#if bonus}}
🎉 1:1 Strategy Session Reserved:
You are one of the first 10 members in this cohort! You can schedule your 30-minute 1:1 call with me here:
{{bonus_booking_url}}
{{/if}}

Start by testing your login and exploring Module 0 before our cohort kicks off.

Warmly,
Milan Dodhia`,
    variables: ["first_name", "amount_paid", "cohort_name", "cohort_start_date", "member_area_url", "invoice_url", "bonus_booking_url"],
  },
  {
    key: "silver_confirmation_wa",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "course_purchase_confirmat",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},

Welcome to The Calm Money System. Your enrollment is confirmed.

Cohort: {{2}} (Starts {{3}})
Portal Access: {{4}}

Download Tax Invoice: {{5}}

Warmly,
Milan Dodhia`,
    variables: ["first_name", "cohort_name", "cohort_start_date", "member_area_url", "invoice_url"],
  },
  {
    key: "silver_upgrade_confirmation_email",
    channel: "email",
    category: "transactional",
    subject: "Your upgrade to The Calm Money System (Silver)",
    body: `Hello {{first_name}},

You have successfully upgraded from Money Reality Check to The Calm Money System (Silver).

Standard Silver Price: {{base_price}}
Credit Applied from MRC: {{credit_applied}}
Amount Charged: {{amount_paid}}
Assigned Cohort: {{cohort_name}} (starts {{cohort_start_date}})

Member Portal: {{member_area_url}}
Tax Invoice: {{invoice_url}}

Warmly,
Milan Dodhia`,
    variables: ["first_name", "base_price", "credit_applied", "amount_paid", "cohort_name", "cohort_start_date", "member_area_url", "invoice_url"],
  },
  {
    key: "gold_confirmation_email",
    channel: "email",
    category: "transactional",
    subject: "Welcome to Gold Master Access",
    body: `Hello {{first_name}},

Your enrollment in Gold Master Access is confirmed.

Amount Paid: {{amount_paid}}
Entitlements: Includes Lifetime Gold Access and Lifetime Silver Access.
{{#if new_silver}}
Assigned Silver Cohort: {{cohort_name}} (starts {{cohort_start_date}})
{{/if}}

Member Portal: {{member_area_url}}
Tax Invoice: {{invoice_url}}

Warmly,
Milan Dodhia`,
    variables: ["first_name", "amount_paid", "cohort_name", "cohort_start_date", "member_area_url", "invoice_url"],
  },
  {
    key: "diamond_confirmation_email",
    channel: "email",
    category: "transactional",
    subject: "Welcome to Diamond Elite Access",
    body: `Hello {{first_name}},

Your Diamond Elite Access enrollment is confirmed.

Amount Paid: {{amount_paid}}
Diamond Term: 12 months access (valid until {{access_end_date}}).
Includes Lifetime Silver and Lifetime Gold Access.

Member Portal: {{member_area_url}}
Tax Invoice: {{invoice_url}}

Warmly,
Milan Dodhia`,
    variables: ["first_name", "amount_paid", "access_end_date", "member_area_url", "invoice_url"],
  },

  // 2. MONEY REALITY CHECK TO SILVER UPGRADE 6-STAGE SEQUENCE
  {
    key: "mrc_upgrade_reminder_day15",
    channel: "email",
    category: "marketing",
    subject: "Halfway through your Silver credit window",
    body: `Hello {{first_name}},

It has been 15 days since you started Money Reality Check.

Your ₹601 credit is currently locked towards The Calm Money System (Silver) for {{upgrade_price}}.

If you have finished auditing your numbers with the 4 diagnostic sheets, Silver is where you take those findings into the 90-day execution framework.

View your credit and upgrade here:
{{upgrade_url}}

This locked price remains available until {{upgrade_end_date}}.

Milan Dodhia`,
    variables: ["first_name", "upgrade_price", "upgrade_url", "upgrade_end_date"],
  },
  {
    key: "mrc_upgrade_reminder_day23_7d",
    channel: "email",
    category: "marketing",
    subject: "7 days remaining: Your ₹601 credit towards Silver",
    body: `Hello {{first_name}},

Exactly one week remains on your Money Reality Check upgrade credit.

Your ₹601 payment counts fully towards The Calm Money System (Silver), making your price {{upgrade_price}}.

After {{upgrade_end_date}}, the credit expires and standard cohort pricing applies.

Upgrade with your locked credit:
{{upgrade_url}}

Milan Dodhia`,
    variables: ["first_name", "upgrade_price", "upgrade_url", "upgrade_end_date"],
  },
  {
    key: "mrc_upgrade_reminder_day25_5d",
    channel: "email",
    category: "marketing",
    subject: "5 days left: Complete your One Page Plan in Silver",
    body: `Hello {{first_name}},

Five days left on your Silver upgrade window.

You have the diagnostics from Money Reality Check. In Silver, you get the live cohort, the 90-day missions, and direct Thursday Q&A access.

Your locked price: {{upgrade_price}} (using your ₹601 credit)
Window closes: {{upgrade_end_date}}

{{upgrade_url}}

Milan Dodhia`,
    variables: ["first_name", "upgrade_price", "upgrade_url", "upgrade_end_date"],
  },
  {
    key: "mrc_upgrade_reminder_day26_4d",
    channel: "email",
    category: "marketing",
    subject: "4 days left on your locked Silver price",
    body: `Hello {{first_name}},

Just 4 days remaining to apply your ₹601 credit towards The Calm Money System (Silver).

Your special price: {{upgrade_price}}
Expires: {{upgrade_end_date}}

Review what is included and upgrade here:
{{upgrade_url}}

Milan Dodhia`,
    variables: ["first_name", "upgrade_price", "upgrade_url", "upgrade_end_date"],
  },
  {
    key: "mrc_upgrade_reminder_day28_2d",
    channel: "email",
    category: "marketing",
    subject: "48 hours: Your Silver upgrade credit closes soon",
    body: `Hello {{first_name}},

Two days remain on your locked upgrade price of {{upgrade_price}} for The Calm Money System.

After {{upgrade_end_date}}, any upgrade to Silver will be at full standard price.

Lock in your Silver access now:
{{upgrade_url}}

Milan Dodhia`,
    variables: ["first_name", "upgrade_price", "upgrade_url", "upgrade_end_date"],
  },
  {
    key: "mrc_upgrade_reminder_day29_24h",
    channel: "email",
    category: "marketing",
    subject: "Final day: Your Silver upgrade credit expires tomorrow",
    body: `Hello {{first_name}},

This is the final 24-hour reminder for your Money Reality Check upgrade credit.

Tomorrow, {{upgrade_end_date}}, your ₹601 credit window closes.

Upgrade to The Calm Money System for {{upgrade_price}}:
{{upgrade_url}}

Thank you for being part of Money Reality Check.

Milan Dodhia`,
    variables: ["first_name", "upgrade_price", "upgrade_url", "upgrade_end_date"],
  },

  // 3. GOLD COMPLETER 4 NOTIFICATIONS
  {
    key: "gold_completer_eligible_initial",
    channel: "email",
    category: "marketing",
    subject: "Congratulations: You qualify for Gold Completer pricing",
    body: `Hello {{first_name}},

Congratulations on completing the required core tools and curriculum in The Calm Money System!

Because you completed your missions on time, you have unlocked the Gold Completer special upgrade price of {{gold_price}} (standard price ₹24,000).

Your special price is reserved until {{gold_deadline}}.

View your special upgrade page:
{{gold_upgrade_url}}

Claim your completion reward (certificate and T-shirt):
{{course_complete_url}}

Milan Dodhia`,
    variables: ["first_name", "gold_price", "gold_deadline", "gold_upgrade_url", "course_complete_url"],
  },
  {
    key: "gold_completer_reminder_5d",
    channel: "email",
    category: "marketing",
    subject: "5 days remaining: Your Gold Completer upgrade offer",
    body: `Hello {{first_name}},

Five days remain to claim your Gold Completer special upgrade price of {{gold_price}}.

Gold covers deep-dive wealth transmission, private portfolio architecture reviews, and multi-generational structures.

Review the curriculum and claim your upgrade:
{{gold_upgrade_url}}

Available until {{gold_deadline}}.

Milan Dodhia`,
    variables: ["first_name", "gold_price", "gold_deadline", "gold_upgrade_url"],
  },
  {
    key: "gold_completer_reminder_2d",
    channel: "email",
    category: "marketing",
    subject: "2 days left: Gold Completer special upgrade price",
    body: `Hello {{first_name}},

Two days left to upgrade to Gold Master Access at {{gold_price}} instead of the standard ₹24,000.

Your deadline is {{gold_deadline}}.

{{gold_upgrade_url}}

Milan Dodhia`,
    variables: ["first_name", "gold_price", "gold_deadline", "gold_upgrade_url"],
  },
  {
    key: "gold_completer_reminder_24h",
    channel: "email",
    category: "marketing",
    subject: "Final 24 hours: Your Gold Completer offer closes tomorrow",
    body: `Hello {{first_name}},

This is the final notice for your Gold Completer upgrade price.

Your special price of {{gold_price}} closes on {{gold_deadline}}.

Upgrade here before the deadline:
{{gold_upgrade_url}}

Milan Dodhia`,
    variables: ["first_name", "gold_price", "gold_deadline", "gold_upgrade_url"],
  },

  // 4. MASTERCLASS ATTENDEE FOLLOW-UP FOR MONEY REALITY CHECK
  {
    key: "mrm_reality_check_followup_email",
    channel: "email",
    category: "marketing",
    subject: "Measure the gap on your own numbers",
    body: `Hello {{first_name}},

Thank you for attending The Money Reality Masterclass.

The masterclass showed that the gap between headline returns and real purchasing power exists.

If you want to measure that gap precisely on your own family's numbers, Money Reality Check is available for ₹601:
• 12 recorded diagnostic sessions
• 4 diagnostic calculator & audit sheets
• 1 Thursday guest seat with me
• Full ₹601 credit locked towards Silver for 30 days

Explore Money Reality Check:
{{checkout_mrc_url}}

Milan Dodhia`,
    variables: ["first_name", "checkout_mrc_url"],
  },
  {
    key: "mrm_reality_check_followup_wa",
    channel: "whatsapp",
    category: "marketing",
    metaTemplateName: "mrm_reality_check_followup",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},

Thank you for attending The Money Reality Masterclass.

To measure your own family's real returns step by step, Money Reality Check is available for ₹601.

Details and instant access:
{{2}}

Milan Dodhia`,
    variables: ["first_name", "checkout_mrc_url"],
  },

  // 5. PAYMENT FAILURE / ABANDONED CHECKOUT INTIMATION (1 Message)
  {
    key: "payment_failed_intimation_email",
    channel: "email",
    category: "transactional",
    subject: "Your order was not completed (nothing was charged)",
    body: `Hello {{first_name}},

We noticed your recent payment attempt for {{product_name}} was not completed.

Nothing was charged to your account.

If this was an interruption or your bank app timed out, you can resume your checkout anytime using this link:
{{resume_checkout_url}}

If you have any questions or faced an issue with the payment gateway, simply reply to this email.

Milan Dodhia`,
    variables: ["first_name", "product_name", "resume_checkout_url"],
  },
  {
    key: "payment_failed_intimation_wa",
    channel: "whatsapp",
    category: "transactional",
    metaTemplateName: "payment_failed_recovery",
    metaLanguage: "en",
    metaApprovalStatus: "APPROVED",
    body: `Hello {{1}},

We noticed your payment for {{2}} was not completed. Nothing was charged to your account.

You can resume your checkout anytime here:
{{3}}

Reply here if you need any assistance.

Milan Dodhia`,
    variables: ["first_name", "product_name", "resume_checkout_url"],
  },
];

/**
 * Seed or verify message templates in database.
 */
export async function seedMessageTemplates(): Promise<void> {
  const db = createPublicServerClient();

  for (const tpl of INITIAL_TEMPLATES) {
    const { data: existing } = await db
      .from("message_templates" as never)
      .select("key")
      .eq("key" as never, tpl.key)
      .maybeSingle();

    if (!existing) {
      await db.from("message_templates" as never).insert({
        key: tpl.key,
        channel: tpl.channel,
        category: tpl.category,
        subject: tpl.subject || null,
        body: tpl.body,
        meta_template_name: tpl.metaTemplateName || null,
        meta_language: tpl.metaLanguage || "en",
        meta_approval_status: tpl.metaApprovalStatus || "APPROVED",
        variables: tpl.variables,
        is_active: tpl.isActive ?? true,
      } as never);
    }
  }
}
