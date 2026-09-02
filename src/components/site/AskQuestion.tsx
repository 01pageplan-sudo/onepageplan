import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitPreworkQuestion } from "@/lib/registration.functions";

const MAX = 500;
const DONE_KEY = "opp_prework_question_sent";

export function AskQuestion() {
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DONE_KEY) === "1") setSent(true);
    } catch {
      /* storage blocked, show the form */
    }
  }, []);

  async function send() {
    const trimmed = question.trim();
    if (trimmed.length === 0) {
      setStatus("error");
      setError("Please type your question first.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      let registrationId: string | null = null;
      let email: string | null = null;
      try {
        registrationId = window.sessionStorage.getItem("opp_registration_id");
        email = window.sessionStorage.getItem("opp_registration_email");
      } catch {
        /* no identifier available, still accept the question */
      }

      const result = await submitPreworkQuestion({
        data: { question: trimmed, registration_id: registrationId, email },
      });

      if (result.ok) {
        try {
          window.localStorage.setItem(DONE_KEY, "1");
        } catch {
          /* nothing to do */
        }
        setSent(true);
        setStatus("idle");
        return;
      }
      setStatus("error");
      setError(result.error ?? "That did not send. Please try once more.");
    } catch {
      setStatus("error");
      setError("That did not send. Please try once more.");
    }
  }

  return (
    <section className="relative overflow-hidden rounded-xl border-2 border-[var(--brass)] bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-[var(--brass)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--brass)]">
          Attendance Priority : Answered Live
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          This Saturday, 7:00 PM IST
        </span>
      </div>

      <h2 className="mt-4 text-2xl font-bold tracking-tight">
        What is your biggest unanswered money question?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Milan reviews every submission before Saturday and answers them live during the session.
        Submitting your question creates your personal stake in the masterclass: be in the room to
        hear your exact question unpacked.
      </p>

      {sent ? (
        <div className="mt-6 rounded-lg border border-[var(--brass)]/40 bg-[var(--brass)]/10 p-5">
          <p className="text-base font-bold text-primary">
            ✓ Your question is in Milan&apos;s session notes for Saturday.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Milan will address it live in the final third of the session. Set your calendar for this Saturday at 7:00 PM IST to make sure you are in the room when it is answered.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            All submissions are confidential. Only the scenario and arithmetic are discussed.
          </p>
        </div>
      ) : (
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p className="text-xs leading-relaxed text-muted-foreground">
            Please do not ask which specific stock, mutual fund, or insurance scheme to buy. Milan is a
            Financial Educator, not an investment adviser, and teaches how to evaluate holdings yourself.
            Ask the arithmetic, the structure, or the decision rule you have been struggling with.
          </p>

          <Textarea
            rows={4}
            maxLength={MAX}
            value={question}
            onChange={(event) => setQuestion(event.target.value.slice(0, MAX))}
            placeholder="The one thing I have never been able to get a straight answer on is..."
            className="mt-3 bg-background text-base"
          />

          {question.length > 400 ? (
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {question.length} / {MAX}
            </p>
          ) : null}

          {status === "error" ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            disabled={status === "submitting"}
            className="mt-4 h-auto w-full bg-primary py-4 text-base font-semibold text-primary-foreground hover:bg-[var(--highlight)]"
          >
            {status === "submitting"
              ? "Sending..."
              : status === "error"
                ? "Try again"
                : "Submit my question for Saturday's live session →"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground border-t border-border pt-4">
        Milanaire is financial education only. Milan Dodhia is a Financial Educator and does not
        provide investment advice or recommend products. Nothing here is a recommendation. For tax
        questions speak to a Chartered Accountant, and for legal questions speak to a lawyer.
      </p>
    </section>
  );
}
