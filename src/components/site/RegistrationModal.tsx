import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerAttendee } from "@/lib/registration.functions";

const PROFILE_OPTIONS = [
  "Salaried professional, mid to senior level",
  "Business owner or self employed",
  "Doctor, architect, lawyer or other practice owner",
  "Senior manager or leadership role",
  "Recently started earning well",
  "Something else",
];

const PAIN_OPTIONS = [
  "I do not actually know what I own",
  "I have no idea what any of it is returning",
  "I have never checked whether my family is covered",
  "I own things I was sold and cannot explain",
  "My parents and my children both land on me",
  "I earn more than ever and nothing feels more secure",
];

type Tracking = {
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_content?: string | undefined;
  utm_term?: string | undefined;
  referrer?: string | undefined;
  landing_path?: string | undefined;
};

type FieldErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  whatsappConsent?: string;
  profileType?: string;
  painPoint?: string;
};

function readTracking(): Tracking {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const read = (key: string) => params.get(key)?.slice(0, 200) ?? undefined;
  return {
    utm_source: read("utm_source"),
    utm_medium: read("utm_medium"),
    utm_campaign: read("utm_campaign"),
    utm_content: read("utm_content"),
    utm_term: read("utm_term"),
    referrer: document.referrer ? document.referrer.slice(0, 300) : undefined,
    landing_path: window.location.pathname + window.location.search,
  };
}

export function RegistrationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [declined, setDeclined] = useState(false);

  const [profileType, setProfileType] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [company, setCompany] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [tracking, setTracking] = useState<Tracking>({});

  useEffect(() => {
    setTracking(readTracking());
  }, []);

  const progress = declined ? 1 : step;

  function validateStep3() {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.fullName = "Please enter your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim()))
      next.email = "Please enter a valid email address.";
    if (whatsappConsent && !/^\d{10}$/.test(phone))
      next.phone = "Enter exactly 10 digits so I can send the link on WhatsApp.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setFormError("");
    if (!validateStep3()) return;
    setSubmitting(true);
    try {
      const result = await registerAttendee({
        data: {
          full_name: fullName,
          email,
          phone10: phone,
          whatsapp_consent: whatsappConsent,
          voice_consent: voiceConsent,
          profile_type: profileType,
          pain_point: painPoint,
          company,
          ...tracking,
        },
      });
      if (result.ok) {
        navigate({ to: "/confirmed" });
        return;
      }
      setFormError(result.error ?? "Something went wrong on our side. Please try once more.");
    } catch {
      setFormError("Something went wrong on our side. Please try once more.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] gap-0 border-border bg-background p-0">
        <div className="flex gap-1 px-6 pt-6">
          {[1, 2, 3].map((segment) => (
            <span
              key={segment}
              className={`h-1 flex-1 rounded-full ${
                segment <= progress ? "bg-[var(--brass)]" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="p-6">
          {declined ? (
            <div>
              <h2 className="text-xl font-bold">Then this is not the right session for you</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                I will never tell anyone which stock or which fund to buy, so you would leave
                disappointed and I would rather say that now than take your Saturday evening. If you
                ever want to learn how to evaluate those decisions yourself, the door is open.
              </p>
              <Button
                className="mt-6 w-full bg-primary text-primary-foreground hover:bg-[var(--highlight)]"
                onClick={() => setDeclined(false)}
              >
                Take me back
              </Button>
            </div>
          ) : step === 1 ? (
            <div>
              <h2 className="text-xl font-bold">One question first</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                So the session is worth your Saturday evening.
              </p>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full rounded-lg border border-border bg-card p-4 text-left text-sm leading-snug transition-colors hover:border-[var(--brass)]"
                >
                  I want to understand my own money and make my own decisions
                </button>
                <button
                  type="button"
                  onClick={() => setDeclined(true)}
                  className="w-full rounded-lg border border-border bg-card p-4 text-left text-sm leading-snug transition-colors hover:border-[var(--brass)]"
                >
                  I want someone to tell me which stock or fund to buy
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            <div>
              <h2 className="text-xl font-bold">Tell me who I am talking to</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Two taps. It changes what I focus on this Saturday.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <Label className="text-sm">What best describes you</Label>
                  <Select value={profileType} onValueChange={setProfileType}>
                    <SelectTrigger className="mt-1.5 w-full bg-card">
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.profileType ? (
                    <p className="mt-1 text-xs text-destructive">{errors.profileType}</p>
                  ) : null}
                </div>

                <div>
                  <Label className="text-sm">What is closest to your situation right now</Label>
                  <Select value={painPoint} onValueChange={setPainPoint}>
                    <SelectTrigger className="mt-1.5 w-full bg-card">
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAIN_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.painPoint ? (
                    <p className="mt-1 text-xs text-destructive">{errors.painPoint}</p>
                  ) : null}
                </div>
              </div>

              <Button
                className="mt-6 w-full bg-primary text-primary-foreground hover:bg-[var(--highlight)]"
                onClick={() => {
                  const next: FieldErrors = {};
                  if (!profileType) next.profileType = "Please choose one.";
                  if (!painPoint) next.painPoint = "Please choose one.";
                  setErrors(next);
                  if (Object.keys(next).length === 0) setStep(3);
                }}
              >
                Continue →
              </Button>
              <button
                type="button"
                className="mt-3 w-full text-xs text-muted-foreground underline"
                onClick={() => setStep(1)}
              >
                Back
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <h2 className="text-xl font-bold">Where do I send the joining link</h2>

              <div className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="full_name" className="text-sm">
                    Your name
                  </Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-1.5 bg-card"
                    autoComplete="name"
                  />
                  {errors.fullName ? (
                    <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1.5 bg-card"
                    autoComplete="email"
                  />
                  {errors.email ? (
                    <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                  ) : null}
                </div>

                <div>
                  <label className="flex gap-3 text-xs leading-snug text-muted-foreground">
                    <Checkbox
                      checked={whatsappConsent}
                      onCheckedChange={(value) => setWhatsappConsent(value === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Yes, send me the joining link and session reminders on WhatsApp. I can opt out
                      any time by replying STOP. You may also call me with a reminder before the
                      session.
                    </span>
                  </label>
                </div>

                {whatsappConsent ? (
                  <div>
                    <Label htmlFor="phone" className="text-sm">
                      WhatsApp number
                    </Label>
                    <div className="mt-1.5 flex items-center overflow-hidden rounded-md border border-input bg-card">
                      <span className="border-r border-input px-3 py-2 text-sm text-muted-foreground">
                        +91
                      </span>
                      <input
                        id="phone"
                        inputMode="numeric"
                        type="tel"
                        value={phone}
                        onChange={(event) =>
                          setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                        autoComplete="tel-national"
                      />
                    </div>
                    {errors.phone ? (
                      <p className="mt-1 text-xs text-destructive">{errors.phone}</p>
                    ) : null}
                  </div>
                ) : null}

                <input
                  type="text"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  className="pointer-events-none absolute h-0 w-0 opacity-0"
                />
              </div>

              {formError ? <p className="mt-4 text-xs text-destructive">{formError}</p> : null}

              <Button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full bg-primary text-primary-foreground hover:bg-[var(--highlight)]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Saving your seat
                  </span>
                ) : (
                  "Save my seat →"
                )}
              </Button>
              <button
                type="button"
                className="mt-3 w-full text-xs text-muted-foreground underline"
                onClick={() => setStep(2)}
              >
                Back
              </button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
