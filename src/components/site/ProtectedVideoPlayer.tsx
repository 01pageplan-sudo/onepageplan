import { useEffect, useState } from "react";
import { ShieldCheck, Lock } from "lucide-react";

interface ProtectedVideoPlayerProps {
  url?: string | undefined;
  videoId?: string | undefined;
  provider?: "bigvu" | "youtube" | "custom" | undefined;
  title?: string | undefined;
}

export function ProtectedVideoPlayer({
  url,
  videoId = "dQw4w9WgXcQ", // fallback placeholder
  provider,
  title = "The Calm Money System — Master Video Session",
}: ProtectedVideoPlayerProps) {
  const [blockedNotice, setBlockedNotice] = useState(false);

  // Determine provider and embed source
  let detectedProvider: "bigvu" | "youtube" | "custom" = provider || "youtube";
  let embedSrc = "";

  if (url) {
    if (url.includes("bigvu.tv")) {
      detectedProvider = "bigvu";
      // Convert standard bigvu share/landing link to embed if needed
      embedSrc = url.includes("/embed/") ? url : url.replace("bigvu.tv/", "desk.bigvu.tv/embed/");
    } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
      detectedProvider = "youtube";
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      const ytId = match?.[1] || videoId;
      embedSrc = `https://www.youtube.com/embed/${ytId}?modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&playsinline=1`;
    } else {
      detectedProvider = "custom";
      embedSrc = url;
    }
  } else if (provider === "bigvu") {
    detectedProvider = "bigvu";
    embedSrc = videoId.startsWith("http") ? videoId : `https://desk.bigvu.tv/embed/${videoId}`;
  } else {
    // Default to YouTube
    embedSrc = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&playsinline=1`;
  }

  // Right-click and keyboard inspection blocker
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setBlockedNotice(true);
      setTimeout(() => setBlockedNotice(false), 2500);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U")) ||
        (e.metaKey && e.altKey && (e.key === "i" || e.key === "I" || e.key === "u" || e.key === "U"))
      ) {
        e.preventDefault();
        setBlockedNotice(true);
        setTimeout(() => setBlockedNotice(false), 2500);
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);


  return (
    <div className="relative w-full select-none overflow-hidden rounded-xl border border-border bg-black shadow-xl">
      {blockedNotice ? (
        <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-destructive/95 px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-lg backdrop-blur-xs transition-opacity">
          Right-click and source inspection are disabled on this protected player.
        </div>
      ) : null}

      <div className="relative aspect-video w-full">
        <iframe
          src={embedSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          // @ts-expect-error standard embed attribute
          allowtransparency="true"
          className="h-full w-full border-0"
        />

        {/* 
          Transparent Shield Overlay:
          Only needed for YouTube to block accidental or deliberate clicks on 
          the YouTube video title, Share icon, and Watch-on-YouTube watermark button.
        */}
        {detectedProvider === "youtube" ? (
          <div
            className="absolute top-0 right-0 left-0 h-[18%] z-10 cursor-default bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onContextMenu={(e) => e.preventDefault()}
            title=""
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border/40 bg-card px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Protected Stream · Authenticated Access
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          Single-User Licensed Content
        </span>
      </div>
    </div>
  );
}
