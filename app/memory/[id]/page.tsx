import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Database, EventReferenceWithContributor } from "@/lib/database.types";
import { getEventById } from "@/lib/supabase";
import Nav from "@/components/Nav";
import { ReferencesList } from "@/components/ReferencesList";
import { immersiveBackground } from "@/lib/styles";
import { LIFE_STAGES } from "@/lib/terminology";
import { redactReferences } from "@/lib/references";

type TimelineEvent = Database["public"]["Tables"]["timeline_events"]["Row"] & {
  contributor: { name: string; relation: string | null } | null;
  media?: { media: Database["public"]["Tables"]["media"]["Row"] }[];
  references?: EventReferenceWithContributor[] | ReturnType<typeof redactReferences>;
};

type LinkedStory = {
  id: string;
  title: string;
  year: number;
  year_end: number | null;
  timing_certainty: 'exact' | 'approximate' | 'vague' | null;
  contributor: { name: string; relation: string | null } | null;
  relationship: string;
  isOriginal: boolean; // true if this event is the original, false if it's a response
};

export default async function MemoryPage({
  params,
}: {
  params: { id: string };
}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
  const admin =
    supabaseUrl && supabaseServiceKey
      ? createClient<Database>(supabaseUrl, supabaseServiceKey)
      : null;

  let event: TimelineEvent | null = null;
  const linkedStories: LinkedStory[] = [];

  if (admin) {
    const { data, error } = await admin
      .from("timeline_events")
      .select(
        `
        *,
        contributor:contributors!timeline_events_contributor_id_fkey(name, relation),
        media:event_media(media:media(*)),
        references:event_references(id, type, url, display_name, role, note, visibility, relationship_to_subject, person:people(id, canonical_name, visibility), contributor:contributors!event_references_contributor_id_fkey(name))
      `
      )
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Error fetching event:", error);
    } else {
      // Redact private names before rendering
      const eventData = data as TimelineEvent;
      event = {
        ...eventData,
        references: redactReferences(eventData.references || []),
      } as TimelineEvent;
    }

    // Fetch linked stories via memory_threads
    if (event) {
      // Stories where this is the original
      const { data: responsesToThis } = await admin
        .from("memory_threads")
        .select(`
          relationship,
          response_event:timeline_events!response_event_id(id, title, year, year_end, timing_certainty, contributor:contributors!timeline_events_contributor_id_fkey(name, relation))
        `)
        .eq("original_event_id", params.id);

      // Stories where this is a response
      const { data: originalsForThis } = await admin
        .from("memory_threads")
        .select(`
          relationship,
          original_event:timeline_events!original_event_id(id, title, year, year_end, timing_certainty, contributor:contributors!timeline_events_contributor_id_fkey(name, relation))
        `)
        .eq("response_event_id", params.id);

      if (responsesToThis) {
        for (const thread of responsesToThis as Array<{
          relationship: string | null;
          response_event: {
            id: string;
            title: string;
            year: number;
            year_end: number | null;
            timing_certainty: 'exact' | 'approximate' | 'vague' | null;
            contributor: { name: string; relation: string | null } | null;
          } | null;
        }>) {
          const responseEvent = thread.response_event;
          if (responseEvent) {
            linkedStories.push({
              id: responseEvent.id,
              title: responseEvent.title,
              year: responseEvent.year,
              year_end: responseEvent.year_end ?? null,
              timing_certainty: responseEvent.timing_certainty ?? null,
              contributor: responseEvent.contributor,
              relationship: thread.relationship || "perspective",
              isOriginal: false, // this event is the original, linked one is response
            });
          }
        }
      }

      if (originalsForThis) {
        for (const thread of originalsForThis as Array<{
          relationship: string | null;
          original_event: {
            id: string;
            title: string;
            year: number;
            year_end: number | null;
            timing_certainty: 'exact' | 'approximate' | 'vague' | null;
            contributor: { name: string; relation: string | null } | null;
          } | null;
        }>) {
          const originalEvent = thread.original_event;
          if (originalEvent) {
            linkedStories.push({
              id: originalEvent.id,
              title: originalEvent.title,
              year: originalEvent.year,
              year_end: originalEvent.year_end ?? null,
              timing_certainty: originalEvent.timing_certainty ?? null,
              contributor: originalEvent.contributor,
              relationship: thread.relationship || "perspective",
              isOriginal: true, // linked one is the original, this is response
            });
          }
        }
      }
    }
  }

  if (!event) {
    event = (await getEventById(params.id)) as TimelineEvent | null;
  }

  if (!event) {
    notFound();
  }

  const formatYearLabel = (target: TimelineEvent) => {
    const isApproximate = target.timing_certainty && target.timing_certainty !== "exact";
    const hasRange =
      typeof target.year_end === "number" && target.year_end !== target.year;
    if (hasRange) {
      return `${isApproximate ? "~" : ""}${target.year}–${target.year_end}`;
    }
    return isApproximate ? `~${target.year}` : String(target.year);
  };

  const formatLinkedYear = (story: LinkedStory) => {
    const isApproximate = story.timing_certainty && story.timing_certainty !== "exact";
    const hasRange =
      typeof story.year_end === "number" && story.year_end !== story.year;
    if (hasRange) {
      return `${isApproximate ? "~" : ""}${story.year}–${story.year_end}`;
    }
    return isApproximate ? `~${story.year}` : String(story.year);
  };

  const dateLine = event.date
    ? `${event.date}, ${formatYearLabel(event)}`
    : formatYearLabel(event);
  const primaryText = event.full_entry || event.preview || "";

  // Find "heard from" reference for invite button
  const heardFromRef = event.references?.find((r) => r.role === "heard_from");
  const heardFromName =
    heardFromRef?.person_display_name ||
    heardFromRef?.contributor?.name ||
    null;
  const hasLinkedResponse = linkedStories.some((s) => !s.isOriginal);

  const mediaItems = event.media
    ?.map((item) => item.media)
    .filter((item): item is Database["public"]["Tables"]["media"]["Row"] => Boolean(item));

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={immersiveBackground}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Nav variant="back" />

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
          {event.timing_certainty && event.timing_certainty !== "exact" && (
            <span>
              Timing: {event.timing_certainty === "approximate" ? "Approximate" : "Vague"}
            </span>
          )}
          {event.timing_input_type === "age_range"
            && event.age_start !== null
            && event.age_end !== null && (
            <span>Ages {event.age_start}–{event.age_end}</span>
          )}
          {event.life_stage && (
            <span>Life stage: {LIFE_STAGES[event.life_stage]}</span>
          )}
        </div>

        {primaryText ? (
          <div
            className="mt-8 space-y-6 text-white/70 leading-relaxed prose prose-sm prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: primaryText }}
          />
        ) : (
          <p className="mt-8 text-white/50">
            This note is in the score, but the full text has not been added yet.
          </p>
        )}

        {event.why_included && (
          <div
            className="mt-8 border-l-2 border-white/10 pl-4 text-white/50 italic prose prose-sm prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: event.why_included }}
          />
        )}

        {mediaItems && mediaItems.length > 0 && (
          <div className="mt-8 space-y-4">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                {item.type === "audio" && (
                  <audio controls className="w-full">
                    <source src={item.url} />
                  </audio>
                )}
                {item.type === "photo" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.caption || "Attached image"}
                    className="w-full rounded-lg border border-white/10"
                  />
                )}
                {item.type === "document" && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#e07a5f] hover:text-white transition-colors"
                  >
                    Open link
                  </a>
                )}
                {item.caption && (
                  <p className="text-xs text-white/40 mt-3">{item.caption}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10 space-y-4">
          <div className="text-xs text-white/40">
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
          </div>
          {event.references && event.references.length > 0 && (
            <ReferencesList references={event.references} />
          )}

          {/* Invite storyteller button */}
          {heardFromRef && !hasLinkedResponse && heardFromName && (
            <div className="mt-4 p-4 rounded-xl border border-[#e07a5f]/20 bg-[#e07a5f]/5">
              <p className="text-sm text-white/70">
                This story traveled from{" "}
                <span className="text-white">{heardFromName}</span>.
                They haven&apos;t added their link to the chain yet.
              </p>
              <Link
                href={`/share?responding_to=${event.id}&storyteller=${encodeURIComponent(heardFromName)}`}
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-[#e07a5f] text-white text-sm hover:bg-[#d06a4f] transition-colors"
              >
                Invite {heardFromName} to carry it themselves
              </Link>
            </div>
          )}
        </div>

        {/* Story chain - linked accounts */}
        {linkedStories.length > 0 && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">
              The chain continues
            </p>
            <div className="space-y-3">
              {linkedStories.map((story) => (
                <Link
                  key={story.id}
                  href={`/memory/${story.id}`}
                  className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-white">{story.title}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {story.isOriginal ? "The story as it was told" : "Told by"}{" "}
                        <span className="text-white/60">
                          {story.contributor?.name || "Someone"}
                        </span>
                        {story.contributor?.relation && (
                          <span> ({story.contributor.relation})</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-white/30">{formatLinkedYear(story)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/score"
            className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-5 py-2 text-xs uppercase tracking-[0.2em] hover:bg-[#d06a4f] transition-colors"
          >
            Back to the score
          </Link>
          <Link
            href="/share"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Add a note
          </Link>
        </div>
      </div>
    </div>
  );
}
