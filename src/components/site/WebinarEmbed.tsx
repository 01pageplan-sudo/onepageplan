import { useEffect, useState } from "react";
import { Loader2, X, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const WEBINAR_ORIGIN = "https://webinar.gg";
const DEFAULT_WEBINAR_ID = "cmthk6y4001kos60ybxfkbc67";

interface WebinarEmbedProps {
  email?: string;
  name?: string;
  onClose?: () => void;
}

export function WebinarEmbed({ email = "", name = "", onClose }: WebinarEmbedProps) {
  const [token, setToken] = useState<string>("");
  const [webinarId, setWebinarId] = useState<string>(DEFAULT_WEBINAR_ID);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchToken() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/get-webinar-token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: email || "guest@onepageplan.in",
            name: name || "Masterclass Attendee",
          }),
        });

        const data = (await response.json()) as {
          token?: string;
          webinarId?: string;
          error?: string;
        };

        if (!isMounted) return;

        if (response.ok && data.token) {
          setToken(data.token);
          if (data.webinarId) setWebinarId(data.webinarId);
        } else {
          setError(
            data.error === "not_registered"
              ? "No registration found for this email."
              : "Could not generate session token. Please try again.",
          );
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to fetch join token:", err);
        setError("Network error connecting to the webinar server.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchToken();

    return () => {
      isMounted = false;
    };
  }, [email, name]);

  const embedUrl = `${WEBINAR_ORIGIN}/embed/${webinarId}?token=${encodeURIComponent(token)}`;

  return (
    <div className="fixed inset-0 z-50 h-screen w-full overflow-hidden bg-black text-white flex flex-col">
      {/* Top Bar Overlay */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-6 py-4 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
            The Money Reality Masterclass <span className="text-emerald-400 font-mono text-xs ml-2">LIVE</span>
          </h1>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            title="Exit Fullscreen"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Exit player</span>
          </Button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative flex-1 w-full h-full bg-black">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-zinc-400 tracking-wide animate-pulse">
              Joining live room...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-950/50 text-rose-400 mb-4 border border-rose-900/50">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Unable to Load Stream</h2>
            <p className="text-sm text-zinc-400 max-w-md mb-6">{error}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
              {onClose && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={onClose}
                >
                  Return to Main Page
                </Button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && token && (
          <iframe
            src={embedUrl}
            title="The Money Reality Masterclass Live Stream"
            width="100%"
            height="100%"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0 overflow-hidden"
            style={{ border: 0, outline: "none" }}
          />
        )}
      </main>
    </div>
  );
}
