import { Play } from "lucide-react";
import oppLogo from "@/assets/opp-logo.png";

function getEmbedUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    // YouTube standard watch or shorts
    if (host.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) {
        return `https://www.youtube-nocookie.com/embed/${v}?rel=0`;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2];
        if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return trimmed;
      }
    }

    // YouTube share shortlink (youtu.be/VIDEO_ID)
    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) {
        return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
      }
    }

    // Vimeo (vimeo.com/VIDEO_ID)
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      if (!host.includes("player.vimeo.com")) {
        const id = parsed.pathname.replace(/^\//, "").split("/")[0];
        if (id && /^\d+$/.test(id)) {
          return `https://player.vimeo.com/video/${id}`;
        }
      }
    }
  } catch {
    // Fallback to raw string if URL parsing fails
  }

  return trimmed;
}

export function VideoEmbed({ url, title }: { url?: string | undefined; title: string }) {
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card to-[var(--muted)] p-6 text-center shadow-sm">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--brass)]/30 bg-background/80 shadow-xs">
          <img src={oppLogo} alt="" className="h-9 w-9 object-contain" />
        </div>
        <p className="font-display text-base sm:text-lg font-bold text-foreground">
          {title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Free Live Masterclass · Presented by Milan Dodhia
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-3 py-1 text-xs font-medium text-foreground">
          <Play size={12} className="fill-current text-primary" />
          <span>Interactive Live Session • 90 Minutes</span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border shadow-sm">
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
