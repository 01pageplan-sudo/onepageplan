/**
 * Razorpay Payment Integration (Server-side)
 * Directly integrates with Razorpay REST API v1.
 * Bypasses Tagmango for all transactions.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface CreateOrderParams {
  amountPaise: number; // e.g. 600000 for INR 6,000
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  ok: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  error?: string;
}

export function getRazorpayKeyId(): string {
  return (
    process.env["RAZORPAY_KEY_ID"] ||
    process.env["VITE_RAZORPAY_KEY_ID"] ||
    ""
  ).trim();
}

export function getRazorpayKeySecret(): string {
  return (process.env["RAZORPAY_KEY_SECRET"] || "").trim();
}

/**
 * Creates an order directly in Razorpay using Basic Auth.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    console.error("[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.");
    return {
      ok: false,
      error: "Razorpay credentials are not configured on the server.",
    };
  }

  const authString = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const payload = {
    amount: params.amountPaise,
    currency: params.currency || "INR",
    receipt: params.receipt || `rcpt_${Date.now()}`,
    notes: params.notes || {},
  };

  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const err = data["error"] as Record<string, unknown> | undefined;
      const desc = (err?.["description"] as string) || `HTTP ${res.status}`;
      console.error("[Razorpay] Order creation failed:", desc);
      return { ok: false, error: desc };
    }

    return {
      ok: true,
      orderId: data["id"] as string,
      amount: data["amount"] as number,
      currency: data["currency"] as string,
      keyId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Razorpay] Network error creating order:", message);
    return { ok: false, error: message };
  }
}

/**
 * Cryptographically verifies the Razorpay payment signature.
 * HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
 */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;

  try {
    const text = `${params.orderId}|${params.paymentId}`;
    const expected = createHmac("sha256", secret).update(text).digest("hex");

    const a = Buffer.from(params.signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Cryptographically verifies a Razorpay webhook payload signature.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  const secret = (
    process.env["RAZORPAY_WEBHOOK_SECRET"] ||
    process.env["WEBHOOK_SHARED_SECRET"] ||
    getRazorpayKeySecret()
  ).trim();

  if (!secret || !signature) return false;

  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
