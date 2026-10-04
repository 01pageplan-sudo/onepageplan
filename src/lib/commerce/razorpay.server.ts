/**
 * Commerce Foundation: Razorpay Server Utilities
 * Handles Standard Checkout orders, Test/Live mode identification,
 * refund processing, and cryptographic webhook verification.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface CreateCommerceOrderParams {
  amountPaise: number;
  product: string;
  email: string;
  name?: string | undefined;
  phone?: string | undefined;
  receipt?: string | undefined;
  notes?: Record<string, string> | undefined;
}

export interface RazorpayOrderResult {
  ok: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  mode?: "test" | "live";
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
 * Returns current Razorpay mode: 'test' or 'live'.
 * Defaults to 'test' unless live credentials are provided.
 */
export function getRazorpayMode(): "test" | "live" {
  const keyId = getRazorpayKeyId();
  if (keyId.startsWith("rzp_live_")) {
    return "live";
  }
  return "test";
}

/**
 * Creates an order directly in Razorpay REST API v1.
 */
export async function createRazorpayOrder(
  params: CreateCommerceOrderParams,
): Promise<RazorpayOrderResult> {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  const mode = getRazorpayMode();

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
    currency: "INR",
    receipt: params.receipt || `ord_${Date.now()}`,
    notes: {
      product: params.product,
      email: params.email.slice(0, 100),
      name: (params.name || "").slice(0, 100),
      phone: (params.phone || "").slice(0, 20),
      ...(params.notes || {}),
    },
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
      currency: (data["currency"] as string) || "INR",
      keyId,
      mode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Razorpay] Network error creating order:", message);
    return { ok: false, error: message };
  }
}

/**
 * Initiates a full refund via Razorpay REST API:
 * POST /v1/payments/{payment_id}/refund
 */
export async function initiateRazorpayRefund(paymentId: string, amountPaise?: number): Promise<{
  ok: boolean;
  refundId?: string;
  error?: string;
}> {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

  if (!keyId || !keySecret) {
    return { ok: false, error: "Razorpay keys not configured." };
  }

  const authString = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const url = `https://api.razorpay.com/v1/payments/${paymentId}/refund`;

  try {
    const body: Record<string, unknown> = {};
    if (typeof amountPaise === "number" && amountPaise > 0) {
      body["amount"] = amountPaise;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const err = data["error"] as Record<string, unknown> | undefined;
      const desc = (err?.["description"] as string) || `HTTP ${res.status}`;
      return { ok: false, error: desc };
    }

    return {
      ok: true,
      refundId: data["id"] as string,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Cryptographically verifies Razorpay Webhook HMAC-SHA256 signature.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  customSecret?: string,
): boolean {
  const secret = (
    customSecret ||
    process.env["RAZORPAY_WEBHOOK_SECRET"] ||
    process.env["WEBHOOK_SHARED_SECRET"] ||
    getRazorpayKeySecret()
  )?.trim();

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
