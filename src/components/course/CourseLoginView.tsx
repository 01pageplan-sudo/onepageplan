import { useState, useEffect, useRef } from "react";
import { Mail, KeyRound, ArrowRight, Loader2, RefreshCw, AlertCircle, Sparkles, LogOut, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";

interface CourseLoginViewProps {
  initialEmail?: string;
  onLoginSuccess: (email: string, tiers: any, userId: string, isAdmin?: boolean) => void;
  onShowPurchase: () => void;
  onCheckAccess: () => Promise<{
    ok: boolean;
    authenticated: boolean;
    hasAccess: boolean;
    email: string | null;
    userId: string | null;
    isAdmin: boolean;
    tiers: any;
    error?: string;
  }>;
}

export function CourseLoginView({
  initialEmail = "",
  onLoginSuccess,
  onShowPurchase,
  onCheckAccess,
}: CourseLoginViewProps) {
  const [step, setStep] = useState<"email" | "otp" | "no_purchases">("email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        // Generic message for security
        setErrorMessage(error.message || "Could not send verification code. Please try again.");
        setLoading(false);
        return;
      }

      setStep("otp");
      setOtp("");
      setResendCooldown(60); // 60s cooldown
    } catch {
      setErrorMessage("Network error while sending verification code. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (tokenToVerify?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = (tokenToVerify || otp).trim();

    if (cleanToken.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "email",
      });

      if (error || !data.session) {
        setErrorMessage("Invalid or expired code. Please verify the code or request a new one.");
        setLoading(false);
        return;
      }

      // Check entitlements server-side with verified session
      const accessRes = await onCheckAccess();

      if (accessRes.ok && accessRes.authenticated) {
        if (accessRes.hasAccess) {
          onLoginSuccess(
            accessRes.email || cleanEmail,
            accessRes.tiers,
            accessRes.userId || data.user?.id || "",
            accessRes.isAdmin,
          );
        } else {
          // Logged in successfully, but no active course purchases found
          setStep("no_purchases");
        }
      } else {
        setErrorMessage("Could not verify course entitlements. Please refresh or try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Verification error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string) => {
    setOtp(val);
    setErrorMessage(null);
    if (val.length === 6 && !loading) {
      void handleVerifyOtp(val);
    }
  };

  const handleSignOutAndReset = async () => {
    await supabase.auth.signOut().catch(() => {});
    setStep("email");
    setOtp("");
    setErrorMessage(null);
  };

  return (
    <div className="mx-auto max-w-md py-8">
      {step === "email" && (
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs text-center space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Access Your Learning
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Enter your registered email address. We'll send you a one-time login code.
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-email" className="text-xs font-semibold text-foreground">
                Email Address
              </label>
              <div className="relative">
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  required
                  autoFocus
                  disabled={loading}
                  className="pl-9 text-xs sm:text-sm h-10"
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2 text-left">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-10 text-xs sm:text-sm font-semibold gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending login code...
                </>
              ) : (
                <>
                  Send Login Code
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-border/70 text-xs text-muted-foreground">
            Haven't enrolled yet?{" "}
            <button
              type="button"
              onClick={onShowPurchase}
              className="font-semibold text-primary underline underline-offset-4 hover:text-primary/90 transition-colors"
            >
              View curriculum & purchase access (₹6,000)
            </button>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs text-center space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <Mail className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Verify Your Email
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We've sent a 6-digit verification code to{" "}
              <strong className="text-foreground font-semibold">{email}</strong>.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center space-y-2">
              <label htmlFor="otp-input" className="text-xs font-semibold text-muted-foreground">
                Enter 6-digit code
              </label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={handleOtpChange}
                  disabled={loading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2 text-left">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={loading || otp.length !== 6}
              className="w-full h-10 text-xs sm:text-sm font-semibold gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying code...
                </>
              ) : (
                <>
                  Verify & Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={loading || resendCooldown > 0}
                className={`font-semibold transition-colors flex items-center gap-1.5 ${
                  resendCooldown > 0
                    ? "text-muted-foreground cursor-not-allowed"
                    : "text-primary hover:underline underline-offset-4"
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : "Resend Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setErrorMessage(null);
                  setOtp("");
                }}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Change Email
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "no_purchases" && (
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs text-center space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Email Verified ({email})
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              No Active Course Found
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Your login was successful, but we couldn't find an active course linked to this email.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 text-xs space-y-2.5 text-left">
            <p className="font-semibold text-foreground">Did you purchase with another email?</p>
            <p className="text-muted-foreground leading-relaxed">
              If you used a different email during Razorpay checkout, please sign out and enter that email address.
            </p>
          </div>

          <div className="space-y-2.5">
            <Button
              type="button"
              onClick={onShowPurchase}
              className="w-full h-10 text-xs sm:text-sm font-semibold gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Enroll in The Calm Money System (₹6,000)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSignOutAndReset}
              className="w-full h-10 text-xs sm:text-sm gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign in with a different email
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Need help? Contact support at{" "}
            <a
              href="mailto:connect@onepageplan.in"
              className="font-semibold text-primary underline underline-offset-4"
            >
              connect@onepageplan.in
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
