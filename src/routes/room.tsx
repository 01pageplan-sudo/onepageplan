import { createFileRoute } from "@tanstack/react-router";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Footer } from "@/components/site/Footer";
import { Wordmark } from "@/components/site/Header";
import {
  RegistrationProvider,
  useRegistration,
} from "@/components/site/registration-context";
import { track } from "@/lib/analytics";
import { getJoinToken } from "@/lib/room.functions";
import { WEBINAR_REGISTER_URL } from "@/lib/calendar";

const TITLE = "Join the session | The Money Reality Masterclass";
const DESCRIPTION =
  "This is where The Money Reality Masterclass runs. Enter the email you registered with to join the live session.";

export const Route = createFileRoute("/room")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomRoute,
});

const WEBINAR_ORIGIN = "https://webinar.gg";

type Phase = "form" | "player" | "not_registered" | "fallback" | "ended" | "left" | "duplicate";

function RoomRoute() {
  return (
    <RegistrationProvider>
      <RoomPage />
    </RegistrationProvider>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-lg border border-border bg-card p-6 text-center">
      {children}
    </div>
  );
}

function RoomPage() {
  const testMode =
    ((import.meta.env["VITE_ROOM_TEST_MODE"] as string | undefined) ?? "false").trim() === "true";
  const webinarUrl =
    ((import.meta.env["VITE_WEBINAR_URL"] as string | undefined) || "").trim() ||
    WEBINAR_REGISTER_URL;
  const { open } = useRegistration();

  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [webinarId, setWebinarId] = useState("");
  const tracked = useRef(false);

  const requestToken = useCallback(
    async (value: string) => {
      setBusy(true);
      try {
        const result = await getJoinToken({ data: { email: value } });
        if (result.ok) {
          setToken(result.token);
          setWebinarId(result.webinarId);
          setPhase("player");
        } else if (result.reason === "not_registered") {
          setPhase("not_registered");
        } else {
          setPhase("fallback");
        }
      } catch {
        setPhase("fallback");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (phase === "player" && !tracked.current) {
      tracked.current = true;
      track("JoinedRoom");
    }
  }, [phase]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== WEBINAR_ORIGIN) return;
      const raw = event.data as unknown;
      const type =
        typeof raw === "string"
          ? raw
          : typeof (raw as { type?: unknown } | null)?.type === "string"
            ? ((raw as { type: string }).type)
            : "";
      if (type === "webinar-ended") setPhase("ended");
      else if (type === "webinar-user-left") setPhase("left");
      else if (type === "webinar-tab-duplicate") setPhase("duplicate");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const directLink = webinarUrl ? (
    <a
      href={webinarUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-primary underline"
    >
      Open the session directly.
    </a>
  ) : (
    <span>Open the session directly.</span>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        {phase === "form" ? (
          busy ? (
            <PlayerSkeleton />
          ) : (
            <Card>
              <h1 className="text-2xl font-bold">Join the session</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the email you registered with.
              </p>
              <form
                className="mt-6 space-y-3 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy) void requestToken(email);
                }}
              >
                <Input
                  type="email"
                  required={!testMode}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  Join →
                </Button>
              </form>
            </Card>
          )
        ) : null}


        {phase === "not_registered" ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              We cannot find a registration for that email. Please check it, or register again
              below.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <Button onClick={open}>Register again →</Button>
              <Button variant="outline" onClick={() => setPhase("form")}>
                Try another email
              </Button>
            </div>
          </Card>
        ) : null}

        {phase === "fallback" ? <Fallback webinarUrl={webinarUrl} /> : null}

        {phase === "duplicate" ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              This session is already open in another tab.
            </p>
          </Card>
        ) : null}

        {phase === "ended" ? (
          <Card>
            <h2 className="text-xl font-bold">The session has ended.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you for staying to the end.
            </p>
          </Card>
        ) : null}

        {phase === "left" ? (
          <Card>
            <h2 className="text-xl font-bold">You left the session.</h2>
            <Button className="mt-5" disabled={busy} onClick={() => void requestToken(email)}>
              {busy ? "Rejoining…" : "Rejoin"}
            </Button>
          </Card>
        ) : null}

        {phase === "player" ? (
          <section className="mx-auto w-full max-w-[1100px]">
            <p className="label-caps text-[var(--brass)]">
              The Money Reality Masterclass · Live
            </p>
            <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-border">
              <iframe
                src={`${WEBINAR_ORIGIN}/embed/${webinarId}?token=${encodeURIComponent(token)}`}
                title="The Money Reality Masterclass"
                width="100%"
                height="600"
                style={{ border: 0 }}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        ) : null}

        <p className="mx-auto mt-4 w-full max-w-[1100px] text-xs text-muted-foreground">
          Trouble with the player? {directLink}
        </p>
      </main>

      <Footer />
    </div>
  );
}

function Fallback({ webinarUrl }: { webinarUrl: string }) {
  return (
    <Card>
      <h2 className="text-xl font-bold">Join here instead</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The embedded player is not loading. Use the direct link below, it works exactly the same.
      </p>
      <Button asChild className="mt-5 w-full">
        <a href={webinarUrl || "#"} target="_blank" rel="noopener noreferrer">
          Open the session →
        </a>
      </Button>
    </Card>
  );
}
