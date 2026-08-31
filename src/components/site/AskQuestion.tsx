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
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Ask me one question</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        I answer these live at the end of Saturday&apos;s session. Ask the one thing you have not
        had a straight answer to.
      </p>

      {sent ? (
        <div className="mt-5">
          <p className="text-sm font-semibold">Got it. Your question is on my list for Saturday.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            I read every one of these before the session. Questions may be read out without any name
            attached.
          </p>
        </div>
      ) : (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p className="text-xs leading-relaxed text-muted-foreground">
            Please do not ask which stock, which fund, or whether a particular policy is the right
            one. I am a Financial Educator, not an investment adviser, and I do not answer those
            questions for anyone, including paying members. What I do answer is how to work it out
            yourself, so ask me the how.
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
              ? "Sending"
              : status === "error"
                ? "Try again"
                : "Send my question"}
          </Button>
        </form>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Milanaire is financial education only. Milan Dodhia is a Financial Educator and does not
        provide investment advice or recommend products. Nothing here is a recommendation. For tax
        questions speak to a Chartered Accountant, and for legal questions speak to a lawyer.
      </p>
    </section>
  );
}
