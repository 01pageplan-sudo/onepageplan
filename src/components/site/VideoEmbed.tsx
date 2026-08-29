import { Wordmark } from "./Header";

export function VideoEmbed({ url, title }: { url?: string | undefined; title: string }) {
  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-[var(--muted)] shadow-sm">
        <Wordmark withByline={false} />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border shadow-sm">
      <iframe
        src={url}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
