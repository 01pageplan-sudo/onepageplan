const VIDEOS: { id: string; title: string; short: boolean }[] = [
  { id: "g3cl2_WIzhQ", title: "Attendee testimonial (Short 1)", short: true },
  { id: "nUNP9Do0y7c", title: "Attendee testimonial (Short 2)", short: true },
  { id: "Hng9FIQ8z4A", title: "Attendee testimonial (Short 3)", short: true },
  { id: "c5lXaVQhqWU", title: "Attendee testimonial", short: false },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14">
      <h2 className="text-2xl font-bold sm:text-3xl">What past attendees say</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {VIDEOS.map((video) => (
          <div
            key={video.id}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <iframe
              src={`https://www.youtube.com/embed/${video.id}`}
              title={video.title}
              loading="lazy"
              className={video.short ? "aspect-[9/16] w-full" : "aspect-video w-full"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ))}
      </div>
    </section>
  );
}
