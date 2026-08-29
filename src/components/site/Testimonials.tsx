const PLACEHOLDERS = [
  { name: "Name", context: "Context line", quote: "Placeholder quote text." },
  { name: "Name", context: "Context line", quote: "Placeholder quote text." },
  { name: "Name", context: "Context line", quote: "Placeholder quote text." },
];

/**
 * Rendered only when VITE_TESTIMONIALS_ENABLED is exactly the string "true".
 * The content below is placeholder text, not a real attendee quote.
 */
export function Testimonials() {
  const enabled = import.meta.env["VITE_TESTIMONIALS_ENABLED"] === "true";
  if (!enabled) return null;

  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">What past attendees say</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PLACEHOLDERS.map((item, index) => (
          <figure key={index} className="rounded-lg border border-border bg-card p-5">
            <blockquote className="text-sm leading-relaxed">{item.quote}</blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-semibold">{item.name}</span>
              <span className="block text-xs text-muted-foreground">{item.context}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
