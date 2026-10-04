import { useState } from "react";
import { Award, CheckCircle2, Package, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CourseRewardFormProps {
  email: string;
  defaultName?: string;
  isAlreadySubmitted?: boolean;
}

export function CourseRewardForm({
  email,
  defaultName = "",
  isAlreadySubmitted = false,
}: CourseRewardFormProps) {
  const [name, setName] = useState(defaultName);
  const [size, setSize] = useState("L");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(isAlreadySubmitted);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError("Please fill out your certificate name and delivery address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/course/submit-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          certificateName: name.trim(),
          tshirtSize: size,
          shippingAddress: address.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to submit reward details.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Reward Details Received!</h3>
        <p className="text-xs text-gray-600 max-w-sm mx-auto">
          Your physical One Page Plan graduation certificate and commemorative T-shirt will be prepared and dispatched to your address.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-4 text-left">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <Award className="h-5 w-5 text-[#4A5A3A]" />
        <div>
          <h3 className="text-sm font-bold text-gray-900">Claim Your Completion Reward</h3>
          <p className="text-xs text-gray-500">Official Physical Certificate & Exclusive One Page Plan T-shirt</p>
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Full Name (exactly as it should appear on your Certificate)
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            required
            className="text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            T-Shirt Size
          </label>
          <div className="grid grid-cols-5 gap-2">
            {["S", "M", "L", "XL", "XXL"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`py-1.5 text-xs font-semibold rounded-md border transition-all ${
                  size === s
                    ? "bg-[#4A5A3A] text-white border-[#4A5A3A]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Complete Delivery Address with PIN Code & Phone Number
          </label>
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Flat / House No, Building, Street, Landmark, City, State, PIN code, Contact Phone"
            rows={3}
            required
            className="text-xs"
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#4A5A3A] hover:bg-[#3D4B30] text-white text-xs py-2.5"
        >
          {submitting ? "Submitting..." : "Submit Reward Delivery Details"}
          <Send className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </form>
    </div>
  );
}
