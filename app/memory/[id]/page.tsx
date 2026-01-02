import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { readEditSession, isNoteOwner } from "@/lib/edit-session";
import { getEventById } from "@/lib/supabase";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { ReferencesList } from "@/components/ReferencesList";
import ShareInvitePanel from "@/components/ShareInvitePanel";
import { PromptedEventLink } from "@/components/PromptedEventLink";
import { immersiveBackground } from "@/lib/styles";
import { LIFE_STAGES, THREAD_RELATIONSHIP_LABELS } from "@/lib/terminology";
import { redactReferences, type ReferenceRow, type RedactedReference } from "@/lib/references";
import { maskContentWithReferences } from "@/lib/name-detection";

type TimelineEvent = Database["public"]["Views"]["current_notes"]["Row"] & {
  contributor: { name: string; relation: string | null } | null;
  media?: { media: Database["public"]["Tables"]["media"]["Row"] | null }[];
  references?: RedactedReference[];
  mentions?: Array<{
    mention_text: string;
    status: string | null;
    visibility: string | null;
    display_label: string | null;
  }>;
  prompted_event?: { id: string; title: string; privacy_level?: string | null } | null;
};

type LinkedStory = {
  id: string;
  title: string;
  year: number;
  year_end: number | null;
  timing_certainty: 'exact' | 'approximate' | 'vague' | null;
  contributor: { name: string; relation: string | null } | null;
  relationship: string;
  threadNote?: string | null;
  isOriginal: boolean; // true if this event is the original, false if it's a response
};

export default async function MemoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Read edit session to check if viewer is the note owner (magic link users)
  const cookieStore = await cookies();
  const editSession = readEditSession(cookieStore.get("vals-memory-edit")?.value);

  // Also check if logged-in user has a linked contributor (auth users like Amy)
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("contributor_id")
        .eq("id", user.id)
        .single()
    : { data: null };
  const authContributorId = profile?.contributor_id ?? null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
  const admin =
    supabaseUrl && supabaseServiceKey
      ? createClient<Database>(supabaseUrl, supabaseServiceKey)
      : null;

  let event: TimelineEvent | null = null;
  const linkedStories: LinkedStory[] = [];

  if (admin) {
    const { data: eventData, error: eventError } = await admin
      .from("current_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (eventError) {
      // Soft-fail: fall back to getEventById; avoid dev overlay noise
      console.warn("Error fetching event via admin client:", eventError);
    } else if (eventData) {
      const baseEvent = eventData as Database["public"]["Views"]["current_notes"]["Row"];

      let contributor: { name: string; relation: string | null } | null = null;
      if (baseEvent.contributor_id) {
        const { data: contributorRow, error: contributorError } = await admin
          .from("contributors")
          .select("id, name, relation")
          .eq("id", baseEvent.contributor_id)
          .single();
        if (contributorError) {
          console.warn("Error fetching contributor:", contributorError);
        } else if (contributorRow) {
          contributor = {
            name: contributorRow.name,
            relation: contributorRow.relation ?? null,
          };
        }
      }

      let media: Array<{ media: Database["public"]["Tables"]["media"]["Row"] | null }> = [];
      const { data: mediaRows, error: mediaError } = await admin
        .from("event_media")
        .select("event_id, media:media(*)")
        .eq("event_id", baseEvent.id);
      if (mediaError) {
        console.warn("Error fetching media:", mediaError);
      } else {
        media = (mediaRows ?? []).map((row) => ({
          media: (row as { media: Database["public"]["Tables"]["media"]["Row"] | null }).media,
        }));
      }

      let rawRefs: ReferenceRow[] = [];
      const { data: referenceRows, error: referenceError } = await admin
        .from("event_references")
        .select(`
          id,
          type,
          url,
          display_name,
          role,
          note,
          visibility,
          relationship_to_subject,
          person:people(id, canonical_name, visibility),
          contributor:contributors!event_references_contributor_id_fkey(name)
        `)
        .eq("event_id", baseEvent.id);
      if (referenceError) {
        if (referenceError.code !== "PGRST200") {
          console.warn("Error fetching references:", referenceError);
        }
      } else {
        rawRefs = (referenceRows ?? []) as ReferenceRow[];
      }

      let mentionRows: Array<{
        mention_text: string;
        status: string | null;
        visibility: string | null;
        display_label: string | null;
      }> = [];
      const { data: mentionData, error: mentionError } = await admin
        .from("note_mentions")
        .select("mention_text, status, visibility, display_label")
        .eq("event_id", baseEvent.id);
      if (mentionError) {
        if (mentionError.code !== "PGRST200") {
          console.warn("Error fetching mentions:", mentionError);
        }
      } else {
        mentionRows = (mentionData ?? []) as typeof mentionRows;
      }

      let promptedEvent: { id: string; title: string; privacy_level?: string | null } | null = null;
      if (baseEvent.prompted_by_event_id) {
        const { data: promptedRow, error: promptedError } = await admin
          .from("current_notes")
          .select("id, title, privacy_level")
          .eq("id", baseEvent.prompted_by_event_id)
          .single();
        if (promptedError) {
          console.warn("Error fetching prompted event:", promptedError);
        } else if (promptedRow) {
          promptedEvent = promptedRow as { id: string; title: string; privacy_level?: string | null };
        }
      }

      // Redact private names before rendering (include author payload so owner can see real names)
      event = {
        ...baseEvent,
        contributor,
        media,
        references: redactReferences(rawRefs, { includeAuthorPayload: true }),
        mentions: mentionRows,
        prompted_event: promptedEvent,
      } as TimelineEvent;
    }

    // Fetch linked stories via memory_threads
    if (event) {
      type ThreadRow = {
        relationship: string | null;
        note: string | null;
        response_event_id?: string | null;
        original_event_id?: string | null;
      };

      const { data: responsesToThis } = await admin
        .from("memory_threads")
        .select("relationship, note, response_event_id")
        .eq("original_event_id", id);

      const { data: originalsForThis } = await admin
        .from("memory_threads")
        .select("relationship, note, original_event_id")
        .eq("response_event_id", id);

      const linkedEventIds = new Set<string>();

      for (const thread of (responsesToThis ?? []) as ThreadRow[]) {
        if (thread.response_event_id) linkedEventIds.add(thread.response_event_id);
      }

      for (const thread of (originalsForThis ?? []) as ThreadRow[]) {
        if (thread.original_event_id) linkedEventIds.add(thread.original_event_id);
      }

      const linkedEventsById = new Map<string, {
        id: string;
        title: string;
        year: number;
        year_end: number | null;
        timing_certainty: 'exact' | 'approximate' | 'vague' | null;
        contributor_id: string | null;
      }>();

      const contributorIds = new Set<string>();

      if (linkedEventIds.size > 0) {
        const { data: linkedEvents } = await admin
          .from("current_notes")
          .select("id, title, year, year_end, timing_certainty, contributor_id")
          .in("id", [...linkedEventIds]);

        for (const linkedEvent of (linkedEvents ?? []) as Array<{
          id: string;
          title: string;
          year: number;
          year_end: number | null;
          timing_certainty: 'exact' | 'approximate' | 'vague' | null;
          contributor_id: string | null;
        }>) {
          linkedEventsById.set(linkedEvent.id, linkedEvent);
          if (linkedEvent.contributor_id) {
            contributorIds.add(linkedEvent.contributor_id);
          }
        }
      }

      const contributorsById = new Map<string, { name: string; relation: string | null }>();
      if (contributorIds.size > 0) {
        const { data: contributors } = await admin
          .from("contributors")
          .select("id, name, relation")
          .in("id", [...contributorIds]);

        for (const contributor of contributors ?? []) {
          contributorsById.set(contributor.id, {
            name: contributor.name,
            relation: contributor.relation ?? null,
          });
        }
      }

      if (responsesToThis) {
        for (const thread of responsesToThis as ThreadRow[]) {
          if (!thread.response_event_id) continue;
          const responseEvent = linkedEventsById.get(thread.response_event_id);
          if (responseEvent) {
            linkedStories.push({
              id: responseEvent.id,
              title: responseEvent.title,
              year: responseEvent.year,
              year_end: responseEvent.year_end ?? null,
              timing_certainty: responseEvent.timing_certainty ?? null,
              contributor: responseEvent.contributor_id
                ? contributorsById.get(responseEvent.contributor_id) ?? null
                : null,
              relationship: thread.relationship || "perspective",
              threadNote: thread.note,
              isOriginal: false, // this event is the original, linked one is response
            });
          }
        }
      }

      if (originalsForThis) {
        for (const thread of originalsForThis as ThreadRow[]) {
          if (!thread.original_event_id) continue;
          const originalEvent = linkedEventsById.get(thread.original_event_id);
          if (originalEvent) {
            linkedStories.push({
              id: originalEvent.id,
              title: originalEvent.title,
              year: originalEvent.year,
              year_end: originalEvent.year_end ?? null,
              timing_certainty: originalEvent.timing_certainty ?? null,
              contributor: originalEvent.contributor_id
                ? contributorsById.get(originalEvent.contributor_id) ?? null
                : null,
              relationship: thread.relationship || "perspective",
              threadNote: thread.note,
              isOriginal: true, // linked one is the original, this is response
            });
          }
        }
      }
    }
  }

  if (!event) {
    event = (await getEventById(id)) as TimelineEvent | null;
  }

  if (!event) {
    notFound();
  }

  // Check if current viewer is the note owner (via edit session OR auth profile)
  const ownerViaEditSession = isNoteOwner(editSession, event.contributor_id);
  const ownerViaAuth = authContributorId !== null && authContributorId === event.contributor_id;
  const viewerIsOwner = ownerViaEditSession || ownerViaAuth;

  if (event.status !== "published" && !viewerIsOwner) {
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

  // Find "heard from" reference for invite button and attribution
  const heardFromRef = event.references?.find((r) => r.role === "heard_from");
  // Try to get story source from: 1) heard_from reference, 2) source_name "Told to me by X" pattern
  const heardFromName = (() => {
    if (heardFromRef?.render_label) return heardFromRef.render_label;
    if (heardFromRef?.person_display_name) return heardFromRef.person_display_name;
    // Fallback: extract from source_name if it's "Told to me by X"
    const sourceMatch = event.source_name?.match(/told to me by\s+(.+)/i);
    if (sourceMatch) return sourceMatch[1].trim();
    return null;
  })();
  const hasLinkedResponse = linkedStories.some((s) => !s.isOriginal);

  const mediaItems = event.media
    ?.map((item) => item.media)
    .filter((item): item is Database["public"]["Tables"]["media"]["Row"] => Boolean(item));

  const respondLink =
    event.type === "memory" ? `/share?responding_to=${event.id}` : "/share";
  const respondLabel = event.type === "memory" ? "Add your perspective" : "Contribute";

  const promptedEvent = (event as unknown as { prompted_event?: { id: string; title: string; privacy_level?: string | null } | null }).prompted_event;
  const canShowPrompted =
    promptedEvent &&
    promptedEvent.id !== event.id &&
    (promptedEvent.privacy_level === "public" || promptedEvent.privacy_level === event.privacy_level);

  // Mask names in content for non-owners based on visibility preferences
  const displayText = viewerIsOwner
    ? primaryText
    : maskContentWithReferences(primaryText, event.references || [], event.mentions || []);

  // Build edit link - prefer edit session token, fall back to auth-based edit page
  const editLink = viewerIsOwner
    ? editSession?.token
      ? `/edit/${editSession.token}?event_id=${event.id}`
      : `/edit?event_id=${event.id}`
    : null;

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={immersiveBackground}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Nav variant="back" />

        {/* Header: Title + simplified metadata */}
        <div className="mt-8">
          {canShowPrompted && promptedEvent && (
            <PromptedEventLink
              promptedEvent={promptedEvent}
              currentEventId={event.id}
            />
          )}
          <h1 className="text-3xl sm:text-4xl font-serif text-white">
            {event.title}
          </h1>
          <p className="text-sm text-white/50 mt-2">
            {dateLine}
            {event.life_stage && event.life_stage in LIFE_STAGES && (
              <span> · {LIFE_STAGES[event.life_stage as keyof typeof LIFE_STAGES]}</span>
            )}
          </p>
        </div>

        {/* Hero: The memory content */}
        {displayText ? (
          <div
            className="mt-8 text-lg sm:text-xl text-white/80 leading-relaxed prose prose-lg prose-invert max-w-none [&>p:first-child]:mt-0"
            dangerouslySetInnerHTML={{ __html: displayText }}
            data-testid="memory-content"
          />
        ) : (
          <p className="mt-8 text-white/50 italic">
            This note is in the score, but the full text has not been added yet.
          </p>
        )}

        {event.why_included && (
          <div
            className="mt-8 border-l-2 border-[#7080c9] pl-4 text-[#a0b0f0] italic prose prose-sm prose-invert max-w-none [&_p]:text-[#a0b0f0]"
            dangerouslySetInnerHTML={{ __html: event.why_included }}
          />
        )}

        {/* External sources - shown after "why it matters" */}
        {(() => {
          const linkRefs = event.references?.filter((r) => r.type === 'link') || [];
          if (linkRefs.length === 0) return null;
          return (
            <div className="mt-6 flex flex-wrap gap-3">
              {linkRefs.map((ref) => (
                <a
                  key={ref.id}
                  href={ref.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-sm text-white/70 hover:text-white hover:border-white/25 hover:bg-white/10 transition-all"
                >
                  {ref.display_name}
                  <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          );
        })()}

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
                  <p className="text-xs text-white/50 mt-3">{item.caption}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10 space-y-4">
          {/* Attribution */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/50">
              Added by{" "}
              <span className="text-white/70">
                {event.contributor?.name || "Someone who loved her"}
              </span>
              {event.contributor?.relation &&
                event.contributor.relation !== "synthesized" && (
                  <span className="text-white/40">
                    {" "}({event.contributor.relation})
                  </span>
                )}
              {/* Story source attribution - show when story came from someone else */}
              {heardFromName && (
                <>
                  <span className="text-white/30"> · </span>
                  <span className="text-white/50">Story from </span>
                  <span className="text-white/70">{heardFromName}</span>
                </>
              )}
            </p>
            {/* Owner-only: subtle edit link */}
            {viewerIsOwner && editLink && (
              <Link
                href={editLink}
                className="text-white/30 hover:text-white/60 transition-colors"
                title={`${event.status || 'pending'} · ${event.privacy_level || 'family'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            )}
          </div>
          {/* Person references only - link refs shown above content */}
          {(() => {
            const personRefs = event.references?.filter((r) => r.type === 'person') || [];
            if (personRefs.length === 0) return null;
            return (
              <ReferencesList
                references={personRefs}
                viewerIsOwner={viewerIsOwner}
                showBothViews={process.env.NODE_ENV === 'development'}
              />
            );
          })()}

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

        {/* Linked notes */}
        {linkedStories.length > 0 && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">
              Other Notes in this Measure
            </p>
            <div className="space-y-3">
              {linkedStories.map((story) => {
                const relationshipKey = story.relationship as keyof typeof THREAD_RELATIONSHIP_LABELS;
                const relationshipLabel =
                  THREAD_RELATIONSHIP_LABELS[relationshipKey] || "Perspective";

                return (
                  <Link
                    key={story.id}
                    href={`/memory/${story.id}`}
                    className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-white">{story.title}</p>
                          <span className="text-xs uppercase tracking-[0.2em] text-[#e07a5f]">
                            {relationshipLabel}
                          </span>
                        </div>
                        {story.threadNote && (
                          <p className="text-xs text-white/50 mt-1 italic">
                            {story.threadNote}
                          </p>
                        )}
                        <p className="text-xs text-white/50 mt-1">
                          {story.isOriginal ? "Original note" : "Told by"}{" "}
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
                );
              })}
            </div>
          </div>
        )}

        <ShareInvitePanel
          eventId={event.id}
          title={event.title}
          content={event.full_entry || event.preview || ""}
          contributorName={event.contributor?.name || null}
          contributorRelation={event.contributor?.relation || null}
          year={event.year}
          yearEnd={event.year_end ?? null}
          timingCertainty={(event.timing_certainty ?? null) as "exact" | "approximate" | "vague" | null}
          eventType={(event.type ?? null) as "memory" | "milestone" | "origin" | null}
          viewerIsOwner={viewerIsOwner}
        />

        {/* Single CTA - respond/add perspective */}
        <div className="mt-10">
          <Link
            href={respondLink}
            className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-5 py-2.5 text-xs uppercase tracking-[0.2em] hover:bg-[#d06a4f] transition-colors"
          >
            {respondLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
