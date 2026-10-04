/**
 * Commerce Foundation: Automated Reconciliation Engine
 * Compares captured Razorpay transactions against database entitlements and orders.
 * Flags missing orders, mismatched amounts, or orphan captured payments into reconciliation_flags.
 */

import { createPublicServerClient } from "@/lib/supabase-public.server";
import { getRazorpayKeyId, getRazorpayKeySecret } from "./razorpay.server";

export interface ReconciliationReport {
  ok: boolean;
  checkedCount: number;
  matchedCount: number;
  flaggedCount: number;
  flags: Array<{
    paymentId: string;
    orderId?: string;
    email?: string;
    issue: string;
  }>;
}

export async function runCommerceReconciliation(): Promise<ReconciliationReport> {
  const db = createPublicServerClient();
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    return {
      ok: false,
      checkedCount: 0,
      matchedCount: 0,
      flaggedCount: 0,
      flags: [],
    };
  }

  const authString = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const flags: Array<{ paymentId: string; orderId?: string; email?: string; issue: string }> = [];
  let checkedCount = 0;
  let matchedCount = 0;

  try {
    // 1. Fetch recent captured payments from Razorpay (last 100)
    const res = await fetch("https://api.razorpay.com/v1/payments?count=100", {
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Razorpay API returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
    const payments = data.items || [];

    for (const payment of payments) {
      if (payment["status"] !== "captured") continue;

      checkedCount++;
      const paymentId = String(payment["id"] || "");
      const orderId = String(payment["order_id"] || "");
      const email = String(
        payment["email"] ||
          (payment["notes"] as Record<string, string>)?.[ "email"] ||
          "",
      ).toLowerCase();
      const amountPaise = Number(payment["amount"]) || 0;
      const amountInr = amountPaise / 100;

      // 2. Lookup corresponding database order
      const { data: orderRow } = await db
        .from("orders" as never)
        .select("*")
        .or(`razorpay_payment_id.eq.${paymentId},razorpay_order_id.eq.${orderId}` as never)
        .maybeSingle();

      if (!orderRow) {
        // Orphan payment on Razorpay not found in database orders
        flags.push({
          paymentId,
          orderId,
          email,
          issue: "orphan_razorpay_captured_payment",
        });

        await db.from("reconciliation_flags" as never).insert({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          email,
          amount: amountInr,
          issue_type: "orphan_razorpay_payment",
          details: { razorpay_payment: payment },
        } as never);
        continue;
      }

      const ord = orderRow as any;

      // 3. Verify status & amount
      if (ord.status !== "captured") {
        flags.push({
          paymentId,
          orderId,
          email,
          issue: `order_status_mismatch_db_has_${ord.status}`,
        });

        await db.from("reconciliation_flags" as never).insert({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          email,
          amount: amountInr,
          issue_type: "order_status_mismatch",
          details: { expected: "captured", found: ord.status },
        } as never);
        continue;
      }

      if (ord.amount_charged !== amountInr) {
        flags.push({
          paymentId,
          orderId,
          email,
          issue: `amount_mismatch_${amountInr}_vs_${ord.amount_charged}`,
        });

        await db.from("reconciliation_flags" as never).insert({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          email,
          amount: amountInr,
          issue_type: "mismatched_amount",
          details: { razorpay_amount: amountInr, db_amount: ord.amount_charged },
        } as never);
        continue;
      }

      // 4. Verify access grant exists for this order
      const { data: grantRows } = await db
        .from("member_access_grants" as never)
        .select("id")
        .eq("order_id" as never, ord.id as never);

      if (!grantRows || (grantRows as any[]).length === 0) {
        flags.push({
          paymentId,
          orderId,
          email,
          issue: "captured_order_missing_access_grants",
        });

        await db.from("reconciliation_flags" as never).insert({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          email,
          amount: amountInr,
          issue_type: "missing_entitlement",
          details: { order_id: ord.id },
        } as never);
        continue;
      }

      matchedCount++;
    }

    return {
      ok: true,
      checkedCount,
      matchedCount,
      flaggedCount: flags.length,
      flags,
    };
  } catch (err) {
    console.error("[Commerce Reconciliation] Error:", err);
    return {
      ok: false,
      checkedCount,
      matchedCount,
      flaggedCount: flags.length,
      flags,
    };
  }
}
