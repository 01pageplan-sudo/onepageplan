import { createPublicServerClient } from "@/lib/supabase-public.server";
import { formatRupees } from "@/lib/commerce/pricing.server";
import { formatPlainDate } from "@/lib/commerce/completion.server";
import { sendEmailViaResend } from "./resend.server";
import { sendWhatsAppTemplate, normaliseWhatsAppPhone } from "@/services/whatsapp/whatsapp.server";

/**
 * Normalizes an IST hour to a Date object.
 * Returns a Date corresponding to given day offset at targetHourIST (default 11:00 AM IST).
 */
export function calculateIstTime(baseDate: Date, dayOffset: number, targetHourIST = 11, targetMinuteIST = 0): Date {
  const d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + dayOffset);
  // IST is UTC + 5:30
  // Target UTC hour = targetHourIST - 5, target UTC minute = targetMinuteIST - 30
  const utcHour = targetHourIST - 5 - (targetMinuteIST < 30 ? 1 : 0);
  const utcMinute = (targetMinuteIST - 30 + 60) % 60;
  d.setUTCHours(utcHour, utcMinute, 0, 0);
  return d;
}

/**
 * Checks if current time is within 9:00 AM - 8:00 PM IST (Quiet Hours Enforcement).
 * If outside, returns the next 9:00 AM IST timestamp.
 */
export function enforceMarketingWindow(scheduledDate: Date): Date {
  // Convert scheduledDate to IST components
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(scheduledDate.getTime() + istOffset);
  const hourIST = istTime.getUTCHours();

  // If between 9 AM (9) and 8 PM (20) IST, it is fine
  if (hourIST >= 9 && hourIST < 20) {
    return scheduledDate;
  }

  // If outside 9 AM - 8 PM:
  // If before 9 AM IST today -> move to 9:00 AM IST today
  // If after 8 PM IST today -> move to 9:00 AM IST tomorrow
  const adjusted = new Date(scheduledDate.getTime());
  if (hourIST >= 20) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  // 9:00 AM IST = 3:30 AM UTC
  adjusted.setUTCHours(3, 30, 0, 0);
  return adjusted;
}

/**
 * Checks if recipient is suppressed from communications.
 */
export async function isSuppressed(identifier: string, channel: "email" | "whatsapp"): Promise<boolean> {
  const db = createPublicServerClient();
  const clean = identifier.trim().toLowerCase();

  const { data } = await db
    .from("communication_suppressions" as never)
    .select("id")
    .eq("identifier" as never, clean)
    .or(`channel.eq.${channel},channel.eq.all` as never)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Event Listener 1: onPurchaseCompleted
 * Triggered by Razorpay webhook capture.
 * - Sends immediate confirmation (Email always, WhatsApp if opted in)
 * - If product is Money Reality Check: schedules the 6-stage upgrade reminder series
 */
export async function handlePurchaseCompletedEvent(payload: {
  orderId: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  product: string;
  amount: number;
  invoiceUrl: string;
  cohortName?: string;
  cohortStartDate?: string;
  hasBonus?: boolean;
  bonusBookingUrl?: string;
  mrcLockedPrice?: number;
  mrcWindowEndDate?: string;
  whatsappConsent?: boolean;
}): Promise<void> {
  const db = createPublicServerClient();
  const email = payload.email.trim().toLowerCase();
  const now = new Date();

  // 1. Queue immediate purchase confirmation email
  let emailTplKey = "silver_confirmation_email";
  let waTplKey = "silver_confirmation_wa";

  if (payload.product === "money_reality_check") {
    emailTplKey = "mrc_confirmation_email";
    waTplKey = "mrc_confirmation_wa";
  } else if (payload.product === "silver") {
    emailTplKey = "silver_confirmation_email";
    waTplKey = "silver_confirmation_wa";
  } else if (payload.product === "gold") {
    emailTplKey = "gold_confirmation_email";
    waTplKey = "gold_confirmation_wa";
  } else if (payload.product === "diamond" || payload.product === "diamond_renewal") {
    emailTplKey = "diamond_confirmation_email";
    waTplKey = "diamond_confirmation_wa";
  }

  // Queue Email
  await db.from("scheduled_messages" as never).insert({
    recipient_email: email,
    recipient_phone: payload.phone || null,
    recipient_name: payload.name || "Member",
    template_key: emailTplKey,
    channel: "email",
    category: "transactional",
    product_id: payload.product,
    order_id: payload.orderId,
    scheduled_for: now.toISOString(),
    status: "pending",
    context_payload: {
      first_name: payload.name ? payload.name.split(" ")[0] : "there",
      amount_paid: formatRupees(payload.amount),
      member_area_url: `https://onepageplan.in/course?email=${encodeURIComponent(email)}`,
      invoice_url: payload.invoiceUrl,
      cohort_name: payload.cohortName || "The Calm Money Cohort",
      cohort_start_date: formatPlainDate(payload.cohortStartDate),
      bonus: Boolean(payload.hasBonus),
      bonus_booking_url: payload.bonusBookingUrl || "",
      upgrade_price: payload.mrcLockedPrice ? formatRupees(payload.mrcLockedPrice) : "₹5,401",
      upgrade_end_date: formatPlainDate(payload.mrcWindowEndDate),
    },
  } as never);

  // Queue WhatsApp if opted in
  if (payload.whatsappConsent && payload.phone) {
    await db.from("scheduled_messages" as never).insert({
      recipient_email: email,
      recipient_phone: payload.phone,
      recipient_name: payload.name || "Member",
      template_key: waTplKey,
      channel: "whatsapp",
      category: "transactional",
      product_id: payload.product,
      order_id: payload.orderId,
      scheduled_for: now.toISOString(),
      status: "pending",
      context_payload: {
        first_name: payload.name ? payload.name.split(" ")[0] : "there",
        member_area_url: `https://onepageplan.in/course?email=${encodeURIComponent(email)}`,
        invoice_url: payload.invoiceUrl,
        cohort_name: payload.cohortName || "The Calm Money Cohort",
        cohort_start_date: formatPlainDate(payload.cohortStartDate),
      },
    } as never);
  }

  // 2. If Money Reality Check: schedule the 6-stage upgrade reminders
  if (payload.product === "money_reality_check") {
    const upgradeUrl = `https://onepageplan.in/upgrade/silver?email=${encodeURIComponent(email)}`;
    const lockedPriceStr = payload.mrcLockedPrice ? formatRupees(payload.mrcLockedPrice) : "₹5,401";
    const deadlineStr = formatPlainDate(payload.mrcWindowEndDate);

    const mrcStages = [
      { key: "mrc_upgrade_reminder_day15", dayOffset: 15 },
      { key: "mrc_upgrade_reminder_day23_7d", dayOffset: 23 },
      { key: "mrc_upgrade_reminder_day25_5d", dayOffset: 25 },
      { key: "mrc_upgrade_reminder_day26_4d", dayOffset: 26 },
      { key: "mrc_upgrade_reminder_day28_2d", dayOffset: 28 },
      { key: "mrc_upgrade_reminder_day29_24h", dayOffset: 29 },
    ];

    for (const stage of mrcStages) {
      const scheduledAt = calculateIstTime(now, stage.dayOffset, 11, 0); // 11:00 AM IST
      await db.from("scheduled_messages" as never).insert({
        recipient_email: email,
        recipient_phone: payload.phone || null,
        recipient_name: payload.name || "Member",
        template_key: stage.key,
        channel: "email",
        category: "marketing",
        product_id: "money_reality_check",
        sequence_group: "mrc_upgrade_sequence",
        order_id: payload.orderId,
        scheduled_for: enforceMarketingWindow(scheduledAt).toISOString(),
        status: "pending",
        context_payload: {
          first_name: payload.name ? payload.name.split(" ")[0] : "there",
          upgrade_price: lockedPriceStr,
          upgrade_url: upgradeUrl,
          upgrade_end_date: deadlineStr,
        },
      } as never);
    }
  }

  // Immediately dispatch pending items
  await processPendingMessages(10);
}

/**
 * Event Listener 2: onGoldCompleterEligible
 * Triggered when a Silver member completes the course before deadline.
 * - Initial notification within 10 minutes
 * - 3 reminders: 5 days before, 2 days before, and 1 day (24 hours) before deadline
 */
export async function handleGoldCompleterEligibleEvent(payload: {
  email: string;
  name?: string;
  phone?: string;
  deadlineDate: string;
  goldPrice: number;
}): Promise<void> {
  const db = createPublicServerClient();
  const email = payload.email.trim().toLowerCase();
  const now = new Date();
  const deadline = new Date(payload.deadlineDate);

  const goldPriceStr = formatRupees(payload.goldPrice);
  const deadlineStr = formatPlainDate(deadline);
  const goldUpgradeUrl = `https://onepageplan.in/upgrade/gold?email=${encodeURIComponent(email)}`;
  const courseCompleteUrl = `https://onepageplan.in/course/complete?email=${encodeURIComponent(email)}`;

  const context = {
    first_name: payload.name ? payload.name.split(" ")[0] : "Member",
    gold_price: goldPriceStr,
    gold_deadline: deadlineStr,
    gold_upgrade_url: goldUpgradeUrl,
    course_complete_url: courseCompleteUrl,
  };

  // Initial notification (within 10 minutes)
  const initialTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins
  await db.from("scheduled_messages" as never).insert({
    recipient_email: email,
    recipient_phone: payload.phone || null,
    template_key: "gold_completer_eligible_initial",
    channel: "email",
    category: "marketing",
    sequence_group: "gold_completer_sequence",
    scheduled_for: enforceMarketingWindow(initialTime).toISOString(),
    status: "pending",
    context_payload: context,
  } as never);

  // Reminders relative to deadline: 5d, 2d, 1d (24h)
  const reminders = [
    { key: "gold_completer_reminder_5d", daysBefore: 5 },
    { key: "gold_completer_reminder_2d", daysBefore: 2 },
    { key: "gold_completer_reminder_24h", daysBefore: 1 },
  ];

  for (const r of reminders) {
    const remTime = new Date(deadline.getTime());
    remTime.setDate(remTime.getDate() - r.daysBefore);
    // At 11:00 AM IST
    remTime.setUTCHours(5, 30, 0, 0); // 11:00 AM IST = 5:30 AM UTC

    // Only schedule if remTime is in the future
    if (remTime.getTime() > now.getTime()) {
      await db.from("scheduled_messages" as never).insert({
        recipient_email: email,
        recipient_phone: payload.phone || null,
        template_key: r.key,
        channel: "email",
        category: "marketing",
        sequence_group: "gold_completer_sequence",
        scheduled_for: enforceMarketingWindow(remTime).toISOString(),
        status: "pending",
        context_payload: context,
      } as never);
    }
  }

  await processPendingMessages(10);
}

/**
 * Event Listener 3: onPaymentFailedOrAbandoned
 * Sends exactly 1 intimation message with instant checkout resumption link.
 */
export async function handlePaymentFailedOrAbandoned(payload: {
  email: string;
  name?: string | undefined;
  phone?: string | undefined;
  product: string;
  checkoutUrl: string;
  whatsappConsent?: boolean | undefined;
}): Promise<void> {
  const db = createPublicServerClient();
  const email = payload.email.trim().toLowerCase();
  const now = new Date();

  // Deduplication check: check if an intimation was already sent to this email for this product within last 24h
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await db
    .from("scheduled_messages" as never)
    .select("id")
    .eq("recipient_email" as never, email)
    .eq("product_id" as never, payload.product)
    .or("template_key.eq.payment_failed_intimation_email,template_key.eq.payment_failed_intimation_wa" as never)
    .gte("created_at" as never, oneDayAgo)
    .maybeSingle();

  if (existing) {
    console.log(`[Messaging] Intimation already sent for ${email} on product ${payload.product}. Skipping duplicate.`);
    return;
  }

  const productNameMap: Record<string, string> = {
    money_reality_check: "Money Reality Check",
    silver: "The Calm Money System (Silver)",
    gold: "Gold Master Access",
    diamond: "Diamond Elite Access",
  };
  const prodName = productNameMap[payload.product] || payload.product;

  const context = {
    first_name: payload.name ? payload.name.split(" ")[0] : "there",
    product_name: prodName,
    resume_checkout_url: payload.checkoutUrl,
  };

  // Queue Email intimation
  await db.from("scheduled_messages" as never).insert({
    recipient_email: email,
    recipient_phone: payload.phone || null,
    template_key: "payment_failed_intimation_email",
    channel: "email",
    category: "transactional",
    product_id: payload.product,
    scheduled_for: now.toISOString(),
    status: "pending",
    context_payload: context,
  } as never);

  // Queue WhatsApp intimation if opted in
  if (payload.whatsappConsent && payload.phone) {
    await db.from("scheduled_messages" as never).insert({
      recipient_email: email,
      recipient_phone: payload.phone,
      template_key: "payment_failed_intimation_wa",
      channel: "whatsapp",
      category: "transactional",
      product_id: payload.product,
      scheduled_for: now.toISOString(),
      status: "pending",
      context_payload: context,
    } as never);
  }

  await processPendingMessages(10);
}

/**
 * Event Listener 4: onRefundProcessedOrUpgraded
 * Cancels every scheduled message for that product or sequence group.
 */
export async function cancelPendingMessagesForRecipient(
  email: string,
  options?: { productId?: string; sequenceGroup?: string }
): Promise<number> {
  const db = createPublicServerClient();
  const cleanEmail = email.trim().toLowerCase();

  let query = db
    .from("scheduled_messages" as never)
    .update({ status: "cancelled", skip_reason: "refund_or_upgrade_cancelled" } as never)
    .eq("recipient_email" as never, cleanEmail)
    .eq("status" as never, "pending");

  if (options?.productId) {
    query = query.eq("product_id" as never, options.productId);
  }
  if (options?.sequenceGroup) {
    query = query.eq("sequence_group" as never, options.sequenceGroup);
  }

  const { data } = await query.select("id");
  const count = (data as any)?.length || 0;
  console.log(`[Messaging] Cancelled ${count} pending messages for ${cleanEmail}`);
  return count;
}

/**
 * Main Dispatcher: Processes due scheduled messages.
 * Runs on cron or on-demand.
 */
export async function processPendingMessages(limit = 25): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const db = createPublicServerClient();
  const now = new Date().toISOString();

  // Fetch settings for test mode
  const { data: settingsRow } = await db
    .from("commerce_settings" as never)
    .select("messaging_test_mode, test_recipient_email, test_recipient_phone")
    .eq("id" as never, 1)
    .maybeSingle();

  const settings = settingsRow as any;
  let isTestMode = settings?.messaging_test_mode;
  if (isTestMode === undefined) {
    try {
      const { data: cfgRow } = await db
        .from("app_config" as never)
        .select("value")
        .eq("key" as never, "messaging_test_mode")
        .maybeSingle();
      if (cfgRow) {
        isTestMode = (cfgRow as any).value === "true";
      }
    } catch {
      /* ignore */
    }
  }
  if (isTestMode === undefined && process.env["OPP_MESSAGING_TEST_MODE"]) {
    isTestMode = process.env["OPP_MESSAGING_TEST_MODE"] === "true";
  }
  if (isTestMode === undefined) {
    isTestMode = true;
  }
  const testEmail = settings?.test_recipient_email || "dodhia.milan@gmail.com";
  const testPhone = settings?.test_recipient_phone || "+919820000000";

  // Query due pending messages
  const { data: messages, error } = await db
    .from("scheduled_messages" as never)
    .select("*, message_templates(*)")
    .eq("status" as never, "pending")
    .lte("scheduled_for" as never, now)
    .order("scheduled_for" as never, { ascending: true })
    .limit(limit);

  if (error || !messages || messages.length === 0) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const msg of messages as any[]) {
    const tpl = msg.message_templates;
    const recipientEmail = isTestMode ? testEmail : msg.recipient_email;
    const recipientPhone = isTestMode ? testPhone : msg.recipient_phone;

    // 1. Suppression check
    const suppressed = await isSuppressed(msg.recipient_email || msg.recipient_phone, msg.channel);
    if (suppressed) {
      await db.from("scheduled_messages" as never).update({
        status: "skipped",
        skip_reason: "user_opted_out_or_suppressed",
      } as never).eq("id" as never, msg.id);
      skipped++;
      continue;
    }

    // 2. Token interpolation & validation
    const tokens = msg.context_payload || {};
    let bodyRendered = tpl.body;
    let subjectRendered = tpl.subject || "The One Page Plan";

    // Handle conditional blocks: {{#if ...}} ... {{/if}}
    const blockRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    bodyRendered = bodyRendered.replace(blockRegex, (_m: string, key: string, content: string) => {
      return tokens[key] ? content : "";
    });

    // Handle variables: {{var}} or WhatsApp {{1}}, {{2}}
    for (const [k, v] of Object.entries(tokens)) {
      bodyRendered = bodyRendered.split(`{{${k}}}`).join(String(v ?? ""));
      subjectRendered = subjectRendered.split(`{{${k}}}`).join(String(v ?? ""));
    }

    // Check required variables
    const missingVars = (tpl.variables as string[]).filter((v) => tokens[v] === undefined || tokens[v] === null);
    if (missingVars.length > 0 && tpl.category !== "transactional") {
      await db.from("scheduled_messages" as never).update({
        status: "skipped",
        skip_reason: `missing_variables: ${missingVars.join(", ")}`,
      } as never).eq("id" as never, msg.id);
      skipped++;
      continue;
    }

    // 3. Dispatch by channel
    if (msg.channel === "email") {
      const emailRes = await sendEmailViaResend({
        to: recipientEmail,
        subject: subjectRendered,
        bodyText: bodyRendered,
        category: msg.category,
        testMode: isTestMode,
      });

      if (emailRes.ok) {
        await db.from("scheduled_messages" as never).update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: emailRes.messageId,
        } as never).eq("id" as never, msg.id);

        await db.from("message_send_logs" as never).insert({
          scheduled_message_id: msg.id,
          template_key: tpl.key,
          channel: "email",
          category: msg.category,
          recipient_email: recipientEmail,
          status: "sent",
          provider: "resend",
          provider_message_id: emailRes.messageId,
          is_test_mode: isTestMode,
          payload_snapshot: tokens,
        } as never);
        sent++;
      } else {
        await db.from("scheduled_messages" as never).update({
          status: "failed",
          error_message: emailRes.error,
        } as never).eq("id" as never, msg.id);
        failed++;
      }
    } else if (msg.channel === "whatsapp") {
      if (!recipientPhone) {
        await db.from("scheduled_messages" as never).update({
          status: "skipped",
          skip_reason: "no_phone_number",
        } as never).eq("id" as never, msg.id);
        skipped++;
        continue;
      }

      // Check Meta approval status
      if (tpl.meta_approval_status !== "APPROVED") {
        console.warn(`[WhatsApp] Template ${tpl.key} not approved by Meta (${tpl.meta_approval_status}). Falling back to email.`);
        // Failover: send email version instead
        if (msg.recipient_email) {
          const fallbackRes = await sendEmailViaResend({
            to: isTestMode ? testEmail : msg.recipient_email,
            subject: subjectRendered,
            bodyText: bodyRendered,
            category: msg.category,
            testMode: isTestMode,
          });
          if (fallbackRes.ok) {
            await db.from("scheduled_messages" as never).update({
              status: "sent",
              sent_at: new Date().toISOString(),
              skip_reason: "whatsapp_unapproved_email_failover",
            } as never).eq("id" as never, msg.id);
            sent++;
            continue;
          }
        }
      }

      // Dispatch via Meta WhatsApp
      const waParams = (tpl.variables as string[]).map((v) => String(tokens[v] ?? ""));
      const waRes = await sendWhatsAppTemplate({
        to: recipientPhone,
        templateName: tpl.meta_template_name || tpl.key,
        languageCode: tpl.meta_language || "en",
        bodyParameters: waParams,
      });

      if (waRes.sent) {
        await db.from("scheduled_messages" as never).update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: waRes.messageId,
        } as never).eq("id" as never, msg.id);

        await db.from("message_send_logs" as never).insert({
          scheduled_message_id: msg.id,
          template_key: tpl.key,
          channel: "whatsapp",
          category: msg.category,
          recipient_phone: recipientPhone,
          status: "sent",
          provider: "meta_whatsapp",
          provider_message_id: waRes.messageId,
          is_test_mode: isTestMode,
          payload_snapshot: tokens,
        } as never);
        sent++;
      } else {
        // WhatsApp failed -> Failover to email
        if (msg.recipient_email) {
          console.log(`[WhatsApp] Send failed (${waRes.error}). Triggering email failover for ${msg.recipient_email}`);
          const fallbackEmail = await sendEmailViaResend({
            to: isTestMode ? testEmail : msg.recipient_email,
            subject: subjectRendered,
            bodyText: bodyRendered,
            category: msg.category,
            testMode: isTestMode,
          });
          if (fallbackEmail.ok) {
            await db.from("scheduled_messages" as never).update({
              status: "sent",
              sent_at: new Date().toISOString(),
              skip_reason: `whatsapp_failed_email_failover: ${waRes.error}`,
            } as never).eq("id" as never, msg.id);
            sent++;
            continue;
          }
        }

        await db.from("scheduled_messages" as never).update({
          status: "failed",
          error_message: waRes.error,
        } as never).eq("id" as never, msg.id);
        failed++;
      }
    }
  }

  return { processed: messages.length, sent, failed, skipped };
}
