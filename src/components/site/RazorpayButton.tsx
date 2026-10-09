import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

interface RazorpayButtonProps {
  label?: string;
  className?: string;
  email?: string;
  name?: string;
  phone?: string;
  discountCode?: string;
  onSuccess?: () => void;
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

export function RazorpayButton({
  label = "Enroll in The Calm Money System (₹6,000) →",
  className = "",
  email = "",
  name = "",
  phone = "",
  discountCode = "",
  onSuccess,
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Could not load payment gateway. Please check your internet connection.");
      }

      // 1. Create order on server
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          phone,
          discountCode: discountCode?.trim() || undefined,
        }),
      });

      const orderData = (await orderRes.json()) as {
        ok?: boolean;
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        error?: string;
      };

      if (!orderRes.ok || !orderData.ok || !orderData.orderId || !orderData.keyId) {
        throw new Error(orderData.error || "Failed to initiate order. Please try again.");
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "The One Page Plan",
        description: "The Calm Money System — Lifetime Course & Implementation Pack",
        order_id: orderData.orderId,
        prefill: {
          name,
          email,
          contact: phone,
        },
        theme: {
          color: "#4A5A3A", // Brand Sage Olive
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          setLoading(true);
          try {
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                email,
                name,
                phone,
              }),
            });

            const verifyData = (await verifyRes.json()) as {
              ok?: boolean;
              accessGranted?: boolean;
              redirectUrl?: string;
              error?: string;
            };

            if (verifyRes.ok && verifyData.ok) {
              if (onSuccess) {
                onSuccess();
              } else {
                window.location.href = verifyData.redirectUrl || "/course";
              }
            } else {
              setError(verifyData.error || "Payment verification failed. Please contact support.");
            }
          } catch (err) {
            setError("Error verifying transaction. If money was debited, please contact us.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <Button
        onClick={handleCheckout}
        disabled={loading}
        className={`w-full py-4 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing Secure Checkout...
          </>
        ) : (
          label
        )}
      </Button>
      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
