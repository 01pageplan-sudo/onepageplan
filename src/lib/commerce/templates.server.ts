import { createPublicServerClient } from "@/lib/supabase-public.server";

/**
 * Returns plain, clean default fallback HTML for any completion page slug.
 * This guarantees that every slug functions end-to-end even before custom HTML is uploaded.
 */
export function getDefaultTemplateForSlug(slug: string): string {
  const baseLayout = (title: string, bodyContent: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | The One Page Plan</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #FAFAFA;
      color: #1F2937;
      margin: 0;
      padding: 24px 16px;
      line-height: 1.5;
    }
    .card {
      max-width: 560px;
      margin: 40px auto;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 32px 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .badge {
      display: inline-block;
      background: #EBF5EE;
      color: #2F6F4E;
      font-weight: 600;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #111827;
    }
    p {
      font-size: 14px;
      color: #4B5563;
      margin: 0 0 16px 0;
    }
    .info-list {
      background: #F9FAFB;
      border: 1px solid #F3F4F6;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #6B7280;
    }
    .info-value {
      font-weight: 600;
      color: #111827;
      text-align: right;
    }
    .btn-primary {
      display: block;
      width: 100%;
      text-align: center;
      background: #4A5A3A;
      color: #FFFFFF !important;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 16px;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 20px;
      box-sizing: border-box;
    }
    .btn-secondary {
      display: block;
      width: 100%;
      text-align: center;
      background: #FFFFFF;
      color: #4A5A3A !important;
      border: 1px solid #D1D5DB;
      font-weight: 500;
      font-size: 13px;
      padding: 10px 16px;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 10px;
      box-sizing: border-box;
    }
    .notice {
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      color: #92400E;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Payment Confirmed</div>
    ${bodyContent}
  </div>
</body>
</html>`;

  switch (slug) {
    case "money-reality-check":
      return baseLayout(
        "Money Reality Check Confirmed",
        `<h1>Welcome, {{first_name}}</h1>
<p>Your enrollment in <strong>{{product_name}}</strong> is confirmed. You now have instant access to the 12-session track and 4 diagnostic tools.</p>

<div class="info-list">
  <div class="info-row"><span class="info-label">Amount Paid:</span><span class="info-value">{{amount_paid}}</span></div>
  <div class="info-row"><span class="info-label">Guest Seat:</span><span class="info-value">1 Thursday session included</span></div>
  {{#if thursday_booking_url}}
  <div class="info-row"><span class="info-label">Thursday Seat:</span><span class="info-value"><a href="{{thursday_booking_url}}" target="_blank">Book Your Guest Seat</a></span></div>
  {{/if}}
  {{#if community}}
  <div class="info-row"><span class="info-label">Community Access:</span><span class="info-value"><a href="{{community_url}}" target="_blank">Join Community</a></span></div>
  {{/if}}
  <div class="info-row"><span class="info-label">Silver Upgrade Credit:</span><span class="info-value">{{amount_paid}} locked until {{upgrade_end_date}}</span></div>
</div>

<div class="notice">
  <strong>Upgrade Window Open:</strong> You can apply your full {{amount_paid}} credit toward The Calm Money System (Silver) for {{upgrade_price}} until {{upgrade_end_date}}.
</div>

<a href="{{member_area_url}}" class="btn-primary">Go to Member Portal →</a>
<a href="{{invoice_url}}" target="_blank" class="btn-secondary">Download Official Receipt / Invoice ↓</a>`
      );

    case "silver":
      return baseLayout(
        "Silver Membership Confirmed",
        `<h1>Welcome to The Calm Money System, {{first_name}}</h1>
<p>Your enrollment in <strong>{{product_name}}</strong> is confirmed. You have lifetime access to the curriculum and live cohort missions.</p>

<div class="info-list">
  <div class="info-row"><span class="info-label">Amount Paid:</span><span class="info-value">{{amount_paid}}</span></div>
  <div class="info-row"><span class="info-label">Assigned Cohort:</span><span class="info-value">{{cohort_name}}</span></div>
  <div class="info-row"><span class="info-label">Cohort Starts:</span><span class="info-value">{{cohort_start_date}}</span></div>
  {{#if bonus}}
  <div class="info-row"><span class="info-label">1:1 Mentor Bonus:</span><span class="info-value">Confirmed! (30-min strategy session)</span></div>
  {{/if}}
</div>

{{#if bonus}}
<div class="notice">
  <strong>🎉 1:1 Strategy Session Reserved:</strong> You are one of the first 10 members in this cohort! 
  <a href="{{bonus_booking_url}}" target="_blank" style="color: #92400E; font-weight: 700; text-decoration: underline;">Schedule your 30-minute 1:1 call here →</a>
</div>
{{/if}}

<a href="{{member_area_url}}" class="btn-primary">Enter The Calm Money System →</a>
<a href="{{invoice_url}}" target="_blank" class="btn-secondary">Download Official Tax Invoice ↓</a>`
      );

    case "silver-upgrade":
      return baseLayout(
        "Silver Upgrade Confirmed",
        `<h1>Upgrade Complete, {{first_name}}!</h1>
<p>You have successfully upgraded from Money Reality Check to <strong>The Calm Money System (Silver)</strong>.</p>

<div class="info-list">
  <div class="info-row"><span class="info-label">Amount Paid:</span><span class="info-value">{{amount_paid}}</span></div>
  <div class="info-row"><span class="info-label">Credit Applied:</span><span class="info-value">{{credit_applied}}</span></div>
  <div class="info-row"><span class="info-label">Assigned Cohort:</span><span class="info-value">{{cohort_name}}</span></div>
  <div class="info-row"><span class="info-label">Cohort Starts:</span><span class="info-value">{{cohort_start_date}}</span></div>
</div>

<a href="{{member_area_url}}" class="btn-primary">Enter The Calm Money System →</a>
<a href="{{invoice_url}}" target="_blank" class="btn-secondary">Download Official Tax Invoice ↓</a>`
      );

    case "gold":
      return baseLayout(
        "Gold Membership Confirmed",
        `<h1>Welcome to Gold Master Access, {{first_name}}</h1>
<p>Your enrollment in <strong>{{product_name}}</strong> is confirmed. Includes Lifetime Gold Access and Lifetime Silver Access.</p>

<div class="info-list">
  <div class="info-row"><span class="info-label">Amount Paid:</span><span class="info-value">{{amount_paid}}</span></div>
  <div class="info-row"><span class="info-label">Curriculum:</span><span class="info-value">Silver & Gold unlocked</span></div>
  {{#if new_silver}}
  <div class="info-row"><span class="info-label">Silver Cohort:</span><span class="info-value">{{cohort_name}} (starts {{cohort_start_date}})</span></div>
  {{/if}}
</div>

<a href="{{member_area_url}}" class="btn-primary">Open Member Portal →</a>
<a href="{{invoice_url}}" target="_blank" class="btn-secondary">Download Official Tax Invoice ↓</a>`
      );

    case "diamond":
      return baseLayout(
        "Diamond Membership Confirmed",
        `<h1>Welcome to Diamond Elite, {{first_name}}</h1>
<p>Your enrollment in <strong>{{product_name}}</strong> is confirmed. Includes 12 months Diamond Access plus lifetime Silver and Gold access.</p>

<div class="info-list">
  <div class="info-row"><span class="info-label">Amount Paid:</span><span class="info-value">{{amount_paid}}</span></div>
  <div class="info-row"><span class="info-label">Diamond Valid Until:</span><span class="info-value">{{access_end_date}}</span></div>
  {{#if new_silver}}
  <div class="info-row"><span class="info-label">Silver Cohort:</span><span class="info-value">{{cohort_name}} (starts {{cohort_start_date}})</span></div>
  {{/if}}
</div>

<a href="{{member_area_url}}" class="btn-primary">Access Member Portal →</a>
<a href="{{invoice_url}}" target="_blank" class="btn-secondary">Download Official Tax Invoice ↓</a>`
      );

    case "course-complete":
      return baseLayout(
        "Course Completed",
        `<h1>Congratulations on Completing the Course, {{first_name}}!</h1>
<p>You have finished all required video lessons and execution missions in The Calm Money System.</p>

<div class="info-list">
  <div class="info-row"><span class="info-label">Status:</span><span class="info-value">Course Completed</span></div>
  <div class="info-row"><span class="info-label">Cohort:</span><span class="info-value">{{cohort_name}}</span></div>
</div>

<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
  {{certificate_form}}
</div>

<div class="notice" style="margin-top: 24px;">
  <strong>Exclusive Completer Offer:</strong> Silver completers who submit on time qualify for the Gold special upgrade price of <strong>{{gold_price}}</strong> until {{gold_deadline}}.
  <div style="margin-top: 8px;">
    <a href="/upgrade/gold" style="color: #92400E; font-weight: 700; text-decoration: underline;">Claim Your Gold Upgrade →</a>
  </div>
</div>`
      );

    default:
      return baseLayout(
        "Order Confirmed",
        `<h1>Thank you, {{first_name}}</h1>
<p>Your order for <strong>{{product_name}}</strong> has been received and processed.</p>
<div class="info-list">
  <div class="info-row"><span class="info-label">Amount Paid:</span><span class="info-value">{{amount_paid}}</span></div>
</div>
<a href="{{member_area_url}}" class="btn-primary">Go to Member Portal →</a>`
      );
  }
}

/**
 * Loads the active HTML template for a slug from the database, or falls back to default.
 */
export async function getActiveTemplateHtml(slug: string): Promise<{
  html: string;
  version: number;
  isCustom: boolean;
}> {
  try {
    const db = createPublicServerClient();
    const { data, error } = await db
      .from("completion_page_templates" as never)
      .select("html_content, version")
      .eq("slug" as never, slug)
      .eq("is_active" as never, true)
      .order("version" as never, { ascending: false })
      .maybeSingle();

    if (!error && data && (data as any).html_content) {
      return {
        html: (data as any).html_content,
        version: (data as any).version || 1,
        isCustom: true,
      };
    }
  } catch (err) {
    console.warn(`[Completion Templates] Error loading template for slug ${slug}:`, err);
  }

  return {
    html: getDefaultTemplateForSlug(slug),
    version: 0,
    isCustom: false,
  };
}
