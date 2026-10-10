import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Lock,
  UserCheck,
  Tag,
  Loader2,
} from "lucide-react";
import { Wordmark } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { type ProductId } from "@/lib/commerce/pricing.server";
import {
  getCheckoutPageDataFn,
  type CheckoutPageData,
} from "@/lib/commerce/checkout.server";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const TERMS_CONSENT_TEXT =
  "I have read the terms and refund policy, and I understand this is education, not investment advice.";
const WHATSAPP_CONSENT_TEXT =
  "Send me my access details and course reminders on WhatsApp.";

interface CheckoutViewProps {
  product: ProductId;
  isUpgrade?: boolean;
  pagePath: string;
}

export function CheckoutView({ product, isUpgrade = false, pagePath }: CheckoutViewProps) {
  const [data, setData] = useState<CheckoutPageData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(true);

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }
    const base = data?.pricing?.amountCharged || 6000;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/commerce/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          product,
          baseAmount: base,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.valid) {
        setCouponError(resData.error || `Coupon "${code}" is invalid or expired.`);
        setAppliedDiscount(null);
      } else {
        setAppliedDiscount({
          code: resData.code,
          discountType: resData.discountType,
          discountValue: resData.discountValue,
          discountAmount: Number(resData.discountAmount) || 0,
          finalAmount: Number(resData.finalAmount) || base,
        });
        setCouponError(null);
      }
    } catch {
      setCouponError("Could not validate coupon. Please check connection.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(null);
    setCouponInput("");
    setCouponError(null);
  };

  // 1. Initial Load: check localStorage for saved member email
  useEffect(() => {
    let initialEmail = "";
    if (typeof window !== "undefined") {
      initialEmail =
        window.localStorage.getItem("opp_course_email") ||
        window.localStorage.getItem("opp_lead_email") ||
        "";
    }

    if (initialEmail) {
      setEmail(initialEmail);
    }

    void loadPageData(initialEmail);
  }, [product, isUpgrade]);

  async function loadPageData(emailToCheck: string) {
    setLoadingData(true);
    try {
      const res = await getCheckoutPageDataFn({
        data: {
          product,
          email: emailToCheck || null,
          isUpgrade,
        },
      });
      setData(res);

      if (res.prefill) {
        if (res.prefill.name && !name) setName(res.prefill.name);
        if (res.prefill.phone && !phone) setPhone(res.prefill.phone);
        if (res.prefill.email && !email) setEmail(res.prefill.email);
      }

      // Fire Meta Pixel InitiateCheckout event once per page view
      const chargeAmount = res.pricing?.amountCharged || 0;
      track("InitiateCheckout", {
        content_name: res.productTitle,
        value: chargeAmount,
        currency: "INR",
      });
    } catch (err) {
      console.error("[Checkout] Error loading page data:", err);
    } finally {
      setLoadingData(false);
    }
  }

  // Handle email blur to re-evaluate upgrade eligibility or existing tier ownership
  const handleEmailBlur = () => {
    const clean = email.trim().toLowerCase();
    if (clean && clean.includes("@")) {
      void loadPageData(clean);
    }
  };

  // 2. Validate Form
  function validateForm(): boolean {
    setValidationError(null);
    setPaymentNotice(null);

    if (!name.trim()) {
      setValidationError("Please enter your full name.");
      return false;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setValidationError("Please enter a valid email address.");
      return false;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setValidationError("Please enter a valid 10-digit mobile number.");
      return false;
    }

    if (!termsAccepted) {
      setValidationError("You must accept the terms and refund policy to proceed.");
      return false;
    }

    return true;
  }

  // 3. Initiate Payment
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setPaymentNotice(null);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Could not initialize payment gateway. Please check your connection.");
      }

      const cleanPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;
      const nowIso = new Date().toISOString();

      // Build consent payload for Prompt 4 and auditing
      const consents = {
        terms_accepted: true,
        terms_wording: TERMS_CONSENT_TEXT,
        terms_timestamp: nowIso,
        whatsapp_consent: whatsappConsent,
        whatsapp_wording: whatsappConsent ? WHATSAPP_CONSENT_TEXT : null,
        whatsapp_timestamp: whatsappConsent ? nowIso : null,
        page: pagePath,
      };

      // Create Server Order (Server dictates price; browser never sends amount)
      const res = await fetch("/api/commerce/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: cleanPhone,
          discountCode: appliedDiscount?.code || undefined,
          consents,
        }),
      });

      const orderData = (await res.json()) as {
        ok?: boolean;
        orderId?: string;
        orderDbId?: string;
        orderToken?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        error?: string;
        alreadyOwned?: boolean;
        redirectUrl?: string;
      };

      if (!res.ok || !orderData.ok || !orderData.orderId || !orderData.keyId) {
        if (orderData.alreadyOwned) {
          window.location.href = orderData.redirectUrl || "/course";
          return;
        }
        throw new Error(orderData.error || "Unable to create payment order. Please try again.");
      }

      // Save email in localStorage for seamless course login
      if (typeof window !== "undefined") {
        window.localStorage.setItem("opp_course_email", email.trim().toLowerCase());
      }

      // Open Razorpay Standard Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount ? orderData.amount * 100 : undefined,
        currency: orderData.currency || "INR",
        name: "The One Page Plan",
        description: data?.productTitle || "The Calm Money System",
        order_id: orderData.orderId,
        prefill: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          contact: cleanPhone,
        },
        theme: {
          color: "#4A5A3A",
        },
        handler: function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // Determine completion slug based on product and upgrade status
          let completionSlug = "silver";
          if (product === "money_reality_check") {
            completionSlug = "money-reality-check";
          } else if (product === "silver") {
            completionSlug = isUpgrade ? "silver-upgrade" : "silver";
          } else if (product === "gold") {
            completionSlug = "gold";
          } else if (product === "diamond" || product === "diamond_renewal") {
            completionSlug = "diamond";
          }

          const targetOrderId = orderData.orderDbId || orderData.orderId || "";
          const targetToken = orderData.orderToken || "";

          const completionUrl = `/complete/${completionSlug}?order_id=${encodeURIComponent(targetOrderId)}&token=${encodeURIComponent(targetToken)}`;
          window.location.href = completionUrl;
        },
        modal: {
          ondismiss: function () {
            // User closed modal: "Payment not completed. Nothing was charged. You can try again."
            setSubmitting(false);
            setPaymentNotice("Payment not completed. Nothing was charged. You can try again.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPaymentNotice(msg);
      setSubmitting(false);
    }
  };

  if (loadingData || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Wordmark />
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground animate-pulse">Loading checkout details...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Handle Off-Sale States
  if (data.state === "off_sale") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Wordmark />
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Home
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">{data.productTitle}</h1>
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <p className="text-base text-foreground font-medium">{data.stateMessage}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Handle Already Owned / Included in Higher Tier
  if (data.state === "already_owns" || data.state === "included_in_tier") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Wordmark />
            <Link to="/course" className="text-xs font-semibold text-primary">
              Go to Member Area →
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">{data.productTitle}</h1>
          <p className="text-sm text-muted-foreground">{data.stateMessage}</p>
          <div className="pt-2">
            <Link
              to="/course"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Access Your Member Area →
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Handle Not Eligible for Upgrade Pages
  if (data.state === "not_eligible") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Wordmark />
            <Link to="/course" className="text-xs text-muted-foreground hover:text-foreground">
              Member Area
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">{data.productTitle} Upgrade</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.stateMessage}</p>
          {!email ? (
            <div className="pt-4 space-y-3">
              <p className="text-xs text-muted-foreground">Already enrolled? Enter your email to verify:</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs"
                />
                <Button size="sm" onClick={() => void loadPageData(email)}>
                  Check
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <Link
                to="/course"
                className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Return to Member Portal →
              </Link>
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  // Handle Window Ended
  if (data.state === "window_ended") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Wordmark />
            <Link to="/course" className="text-xs text-muted-foreground hover:text-foreground">
              Member Area
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-16 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Upgrade Window Ended</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.stateMessage}</p>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 text-left">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-sm">Standard {data.productTitle}</span>
              <span className="text-xl font-bold text-primary">
                ₹{data.pricing.basePrice.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{data.termDescription}</p>
            <Link
              to={product === "silver" ? "/checkout/silver" : "/checkout/gold"}
              className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Continue with Standard Checkout →
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // MAIN ELIGIBLE / RENEWAL CHECKOUT VIEW
  const isRenewal = data.state === "renewal";
  const displayAmount = appliedDiscount ? appliedDiscount.finalAmount : data.pricing.amountCharged;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <header className="border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-30">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Wordmark />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Secure 256-bit Checkout
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl w-full px-4 py-8 sm:py-12 space-y-6">
        {/* PAYMENT NOTIFICATION NOTICE (Close / Failed modal) */}
        {paymentNotice ? (
          <div className="rounded-xl border border-border bg-card p-4 text-xs flex items-start gap-3 shadow-sm animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{paymentNotice}</p>
              <p className="text-muted-foreground text-[11px]">
                You can review your details and retry below when ready.
              </p>
            </div>
          </div>
        ) : null}

        {/* PRODUCT OVERVIEW CARD */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="label-caps text-[var(--brass)] font-semibold text-[11px]">
                {isUpgrade
                  ? "Exclusive Upgrade Path"
                  : isRenewal
                  ? "Membership Renewal"
                  : "Checkout"}
              </span>
              {data.cohortStartDateFormatted ? (
                <span className="text-xs font-semibold text-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                  {data.cohortStartDateFormatted}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {data.productTitle}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              {data.termDescription}
            </p>
          </div>

          {/* WHAT'S INCLUDED LIST */}
          <div className="border-t border-border/70 pt-4 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              What's Included:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-foreground/90">
              {data.includesBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* DYNAMIC METRICS: Milestone & Bonus Lines */}
          {data.milestoneLine || data.bonusLine ? (
            <div className="rounded-lg bg-muted/50 border border-border/80 p-3.5 space-y-2 text-xs">
              {data.milestoneLine ? (
                <p className="text-foreground font-medium flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--brass)] shrink-0" />
                  {data.milestoneLine}
                </p>
              ) : null}
              {data.bonusLine ? (
                <p className="text-foreground font-semibold flex items-center gap-2 text-emerald-600">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                  {data.bonusLine}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* PRICING BREAKDOWN */}
          <div className="border-t border-border/70 pt-4 space-y-2">
            {isUpgrade && product === "silver" ? (
              /* /upgrade/silver shows 3 lines: Standard price, credit ("Your ₹601 counts towards Silver"), and what you pay */
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Standard Silver Price:</span>
                  <span className="tabular-nums font-medium">
                    ₹{data.pricing.basePrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Your ₹601 counts towards Silver:</span>
                  <span className="tabular-nums">-₹601</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border text-base sm:text-lg font-bold text-foreground">
                  <span>What you pay:</span>
                  <span className="text-2xl text-primary tabular-nums">
                    ₹{displayAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                {data.upgradeDeadlineFormatted ? (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    {data.upgradeDeadlineFormatted}
                  </p>
                ) : null}
              </div>
            ) : isUpgrade && product === "gold" ? (
              /* /upgrade/gold shows 2 lines: Gold ₹24,000 and special upgrade price */
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gold:</span>
                  <span className="tabular-nums font-medium">
                    ₹{data.pricing.basePrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border text-base sm:text-lg font-bold text-foreground">
                  <span>Your special upgrade price as a Silver completer:</span>
                  <span className="text-2xl text-primary tabular-nums">
                    ₹{displayAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                {data.upgradeDeadlineFormatted ? (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    {data.upgradeDeadlineFormatted}
                  </p>
                ) : null}
              </div>
            ) : isRenewal ? (
              /* Renewal line */
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-muted-foreground">Annual Renewal:</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    ₹{displayAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                {data.renewalNewEndDateFormatted ? (
                  <p className="text-[11px] text-muted-foreground">
                    Renews your Diamond access until {data.renewalNewEndDateFormatted}.
                  </p>
                ) : null}
              </div>
            ) : (
              /* Standard Single Line Price */
              <div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total (inclusive of taxes):</span>
                  <div className="text-right">
                    {appliedDiscount ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through text-muted-foreground">
                          ₹{data.pricing.amountCharged.toLocaleString("en-IN")}
                        </span>
                        <span className="text-3xl font-bold text-emerald-600 tabular-nums">
                          ₹{displayAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-3xl font-bold text-primary tabular-nums">
                        ₹{displayAmount.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>
                {appliedDiscount && (
                  <p className="text-right text-xs text-emerald-600 font-medium mt-0.5">
                    Coupon {appliedDiscount.code} applied (Saved ₹{appliedDiscount.discountAmount.toLocaleString("en-IN")})
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CHECKOUT FORM */}
        <form onSubmit={handleProceedToPayment} className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-foreground">Buyer Information</h2>

          <div className="space-y-4 text-xs">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className="text-xs">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 text-xs h-9"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-xs">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                required
                className="mt-1 text-xs h-9"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Your course access and invoice will be sent to this email.
              </p>
            </div>

            {/* Mobile Number */}
            <div>
              <Label htmlFor="mobile" className="text-xs">
                Mobile Number (+91) <span className="text-destructive">*</span>
              </Label>
              <div className="flex mt-1">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-xs text-muted-foreground">
                  +91
                </span>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="9876543210"
                  value={phone.replace(/^\+91/, "")}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="rounded-l-none text-xs h-9"
                />
              </div>
            </div>

            {/* Coupon Code Section */}
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span>Have a Coupon Code?</span>
                </label>
                {appliedDiscount && (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-[11px] text-destructive hover:underline font-medium"
                  >
                    ✕ Remove coupon
                  </button>
                )}
              </div>

              {!appliedDiscount ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code (e.g. VIP500)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    className="h-8 text-xs font-mono uppercase bg-background"
                    disabled={couponLoading}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={couponLoading || !couponInput.trim()}
                    onClick={handleApplyCoupon}
                    className="h-8 text-xs px-4 shrink-0 font-medium"
                  >
                    {couponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5" />
                    <span className="font-mono font-bold">{appliedDiscount.code}</span>
                    <span>applied</span>
                  </div>
                  <span className="font-semibold">-₹{appliedDiscount.discountAmount.toLocaleString("en-IN")} off</span>
                </div>
              )}

              {couponError && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {couponError}
                </p>
              )}
            </div>

            {/* CONSENTS */}
            <div className="pt-2 space-y-3">
              {/* Required Terms Checkbox */}
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="termsConsent"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="termsConsent"
                  className="text-[11px] leading-relaxed text-foreground cursor-pointer font-normal"
                >
                  I have read the{" "}
                  <Link to="/terms" target="_blank" className="underline font-medium">
                    terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/refund-policy" target="_blank" className="underline font-medium">
                    refund policy
                  </Link>
                  , and I understand this is education, not investment advice.{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>

              {/* WhatsApp Consent Checkbox (checked by default) */}
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="whatsappConsent"
                  checked={whatsappConsent}
                  onCheckedChange={(checked) => setWhatsappConsent(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="whatsappConsent"
                  className="text-[11px] leading-relaxed text-muted-foreground cursor-pointer font-normal"
                >
                  Send me my access details and course reminders on WhatsApp.
                </Label>
              </div>
            </div>

            {/* Validation Notice */}
            {validationError ? (
              <p className="text-xs text-destructive font-medium">{validationError}</p>
            ) : null}

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-4 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground h-11"
              >
                {submitting ? (
                  "Opening Secure Checkout..."
                ) : (
                  <>
                    Pay ₹{displayAmount.toLocaleString("en-IN")} & Complete Enrollment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                Secured by Razorpay · UPI, Cards, Netbanking accepted
              </p>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
