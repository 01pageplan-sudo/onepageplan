import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, AlertCircle } from "lucide-react";

interface CompletionViewProps {
  slug: string;
  orderId?: string | undefined;
  token?: string | undefined;
  initialStatus: "ready" | "polling" | "unauthorized" | "not_found";
  initialHtml?: string | undefined;
  amountCharged?: number | undefined;
  productName?: string | undefined;
  orderDbId?: string | undefined;
}

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function CompletionView({
  slug,
  orderId,
  token,
  initialStatus,
  initialHtml,
  amountCharged,
  productName,
  orderDbId,
}: CompletionViewProps) {
  const [status, setStatus] = useState(initialStatus);
  const [renderedHtml, setRenderedHtml] = useState(initialHtml || "");
  const [pollSeconds, setPollSeconds] = useState(0);

  // Meta Pixel Purchase Deduplication
  useEffect(() => {
    if (status === "ready" && orderDbId && typeof window !== "undefined") {
      const storageKey = `opp_purchase_fired_${orderDbId}`;
      const alreadyFired =
        window.sessionStorage.getItem(storageKey) || window.localStorage.getItem(storageKey);

      if (!alreadyFired && typeof window.fbq === "function") {
        try {
          window.fbq(
            "track",
            "Purchase",
            {
              value: amountCharged || 0,
              currency: "INR",
              content_name: productName || slug,
              content_type: "product",
            },
            { eventID: orderDbId }
          );
          window.sessionStorage.setItem(storageKey, "true");
          window.localStorage.setItem(storageKey, "true");
        } catch (e) {
          console.warn("[Meta Pixel] Failed to track Purchase:", e);
        }
      }
    }
  }, [status, orderDbId, amountCharged, productName, slug]);

  // Polling logic when status is 'polling'
  useEffect(() => {
    if (status !== "polling" || !orderId) return;

    let timer: NodeJS.Timeout | null = null;
    let secondsElapsed = 0;

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/commerce/poll-order-status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token || "")}`
        );
        const data = await res.json();
        if (data.ok && data.captured) {
          // Captured! Reload page to render tokens cleanly
          window.location.reload();
          return;
        }
      } catch (err) {
        console.warn("[Completion] Poll error:", err);
      }

      secondsElapsed += 2;
      setPollSeconds(secondsElapsed);

      if (secondsElapsed >= 120) {
        // 2 minutes timeout reached -> redirect to /payment/pending
        window.location.href = `/payment/pending?order_id=${encodeURIComponent(orderId)}`;
      } else {
        timer = setTimeout(checkStatus, 2000);
      }
    };

    timer = setTimeout(checkStatus, 2000);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, orderId, token]);

  // 1. Polling State
  if (status === "polling") {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center shadow-xs space-y-4">
          <div className="flex justify-center">
            <Loader2 className="h-10 w-10 text-[#4A5A3A] animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Confirming your payment...</h2>
          <p className="text-sm text-gray-600">
            We are verifying your transaction with the bank. This usually takes just a few seconds.
          </p>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#4A5A3A] h-2 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, Math.round((pollSeconds / 120) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">Please do not close or refresh this page.</p>
        </div>
      </div>
    );
  }

  // 2. Unauthorized State (No personal data leaked)
  if (status === "unauthorized" || status === "not_found") {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center shadow-xs space-y-4">
          <div className="flex justify-center text-amber-600">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Order Verification Needed</h2>
          <p className="text-sm text-gray-600">
            We couldn't verify this order reference. If you recently made a payment, please log into your member account or contact support.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/course"
              className="w-full py-2.5 px-4 bg-[#4A5A3A] text-white rounded-lg font-medium text-sm text-center"
            >
              Go to Member Login →
            </Link>
            <Link
              to="/"
              className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm text-center"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Render HTML as supplied without wrapping in site layout
  return (
    <div
      className="opp-completion-container w-full min-h-screen"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
