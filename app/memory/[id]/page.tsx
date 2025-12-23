import Link from "next/link";
import { notFound } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { getEventById } from "@/lib/supabase";

type TimelineEvent = Database["public"]["Tables"]["timeline_events"]["Row"] & {
  contributor: { name: string; relation: string | null } | null;
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

export default async function MemoryPage({
  params,
}: {
  params: { id: string };
}) {
  const event = (await getEventById(params.id)) as TimelineEvent | null;

  if (!event) {
    notFound();
  }

  const dateLine = event.date ? `${event.date}, ${event.year}` : `${event.year}`;
  const primaryText = event.full_entry || event.preview || "";
  const themeLabels = event.themes
    ?.map((t) => t.theme?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={backgroundStyle}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/chapters"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          &larr; Back to the score
        </Link>

        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mt-8">
          A note in the score
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
          {event.title}
        </h1>

        <div className="flex flex-wrap gap-3 text-xs text-white/40 mt-4">
          <span>{dateLine}</span>
          {event.location && <span>Location: {event.location}</span>}
          {event.people_involved && event.people_involved.length > 0 && (
            <span>People: {event.people_involved.join(", ")}</span>
          )}
        </div>

        {primaryText ? (
          <div className="mt-8 space-y-6 text-white/70 leading-relaxed whitespace-pre-line">
            {primaryText}
          </div>
        ) : (
          <p className="mt-8 text-white/50">
            This note is in the score, but the full text has not been added yet.
          </p>
        )}

        {event.why_included && (
          <div className="mt-8 border-l-2 border-white/10 pl-4 text-white/50 italic">
            "{event.why_included}"
          </div>
        )}

        {themeLabels && themeLabels.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {event.themes
              ?.filter((theme) => Boolean(theme.theme))
              .map((theme) => (
                <Link
                  key={theme.theme.id}
                  href={`/motifs/${theme.theme.id}`}
                  className="text-xs text-white/50 px-3 py-1 rounded-full border border-white/10 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
                >
                  {theme.theme.label}
                </Link>
              ))}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-white/40">
          <span>
            Added by{" "}
            <span className="text-white/60">
              {event.contributor?.name || "Someone who loved her"}
            </span>
            {event.contributor?.relation &&
              event.contributor.relation !== "synthesized" && (
                <span className="text-white/40">
                  {" "}
                  ({event.contributor.relation})
                </span>
              )}
          </span>
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white/60 transition-colors"
            >
              {event.source_name || "Source"} ->
            </a>
          )}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/chapters"
            className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-5 py-2 text-xs uppercase tracking-[0.2em] hover:bg-[#d06a4f] transition-colors"
          >
            Back to the score
          </Link>
          <Link
            href="/letter"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Read the letter
          </Link>
        </div>
      </div>
    </div>
  );
}
