import Link from "next/link";
import { notFound } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { getThemes, getTimelineEvents } from "@/lib/supabase";

type Theme = Database["public"]["Tables"]["themes"]["Row"];

type TimelineEvent = Database["public"]["Tables"]["timeline_events"]["Row"] & {
  themes?: { theme: { id: string; label: string } }[];
};

const backgroundStyle = {
  backgroundImage: `
    radial-gradient(900px 520px at 12% -8%, rgba(224, 122, 95, 0.12), transparent 60%),
    radial-gradient(700px 520px at 88% 6%, rgba(124, 138, 120, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(11, 11, 11, 1), rgba(5, 5, 5, 1))
  `,
  backgroundAttachment: "fixed" as const,
};

export default async function MotifPage({
  params,
}: {
  params: { id: string };
}) {
  const [themes, events] = await Promise.all([
    getThemes(),
    getTimelineEvents({ privacyLevels: ["public", "family", "kids-only"] }),
  ]);

  const motif = (themes as Theme[]).find((theme) => theme.id === params.id);

  if (!motif) {
    notFound();
  }

  const motifEvents = (events as TimelineEvent[]).filter((event) =>
    event.themes?.some((entry) => entry.theme?.id === motif.id)
  );

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={backgroundStyle}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link
          href="/chapters"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          &larr; Back to the score
        </Link>

        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mt-8">
          Motif
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
          {motif.label}
        </h1>
        <p className="text-white/60 mt-4 max-w-2xl leading-relaxed">
          {motif.description || "A recurring pattern in her life."}
        </p>

        <div className="mt-10 space-y-4">
          {motifEvents.length > 0 ? (
            motifEvents.map((event) => (
              <Link
                key={event.id}
                href={`/memory/${event.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/20 transition-all"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  {event.year}
                </p>
                <h2 className="text-lg font-serif text-white mt-2">
                  {event.title}
                </h2>
                {event.preview && (
                  <p className="text-sm text-white/60 mt-2 leading-relaxed">
                    {event.preview}
                  </p>
                )}
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/60">
              No notes have been linked to this motif yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
