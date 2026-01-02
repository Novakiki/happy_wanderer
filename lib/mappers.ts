import type { Database, EventReferenceWithContributor } from "./database.types";

export type TimelineEvent = {
  id: string;
  year: number;
  yearEnd?: number | null;
  ageStart?: number | null;
  ageEnd?: number | null;
  lifeStage?: 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond' | null;
  timingCertainty?: 'exact' | 'approximate' | 'vague' | null;
  timingInputType?: 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage' | null;
  timingNote?: string | null;
  date?: string | null;
  type: "origin" | "milestone" | "memory";
  title: string;
  preview?: string | null;
  fullEntry?: string | null;
  whyIncluded?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  contributor: string;
  contributorRelation?: string | null;
  location?: string | null;
  peopleInvolved?: string[] | null;
  media?: Database["public"]["Tables"]["media"]["Row"][];
  references?: EventReferenceWithContributor[];
  // Story chain fields
  rootEventId?: string | null;
  chainDepth?: number;
  promptedByEventId?: string | null;
};

// A bundle of related events (perspectives on the same story)
export type StoryBundle = {
  rootEvent: TimelineEvent;
  perspectives: TimelineEvent[];
  totalCount: number;
};

type RawTimelineEvent = Database["public"]["Tables"]["timeline_events"]["Row"] & {
  contributor?: { name: string; relation: string | null } | null;
  media?: { media: Database["public"]["Tables"]["media"]["Row"] | null }[] | null;
  references?: EventReferenceWithContributor[];
};

export function mapTimelineEvent(event: RawTimelineEvent): TimelineEvent {
  const media = Array.isArray(event.media)
    ? event.media
        .map((item) => item?.media)
        .filter(
          (item): item is Database["public"]["Tables"]["media"]["Row"] =>
            Boolean(item)
        )
    : [];

  return {
    id: event.id,
    year: event.year,
    yearEnd: event.year_end ?? null,
    ageStart: event.age_start ?? null,
    ageEnd: event.age_end ?? null,
    lifeStage: event.life_stage as TimelineEvent['lifeStage'],
    timingCertainty: event.timing_certainty as TimelineEvent['timingCertainty'],
    timingInputType: event.timing_input_type as TimelineEvent['timingInputType'],
    timingNote: event.timing_note ?? null,
    date: event.date,
    type: event.type as "origin" | "milestone" | "memory",
    title: event.title,
    preview: event.preview,
    fullEntry: event.full_entry,
    whyIncluded: event.why_included,
    sourceUrl: event.source_url,
    sourceName: event.source_name,
    contributor: event.contributor?.name || "Unknown",
    contributorRelation: event.contributor?.relation ?? null,
    location: event.location,
    peopleInvolved: event.people_involved,
    media,
    references: event.references ?? [],
    rootEventId: event.root_event_id ?? null,
    chainDepth: event.chain_depth ?? 0,
    promptedByEventId: (event as { prompted_by_event_id?: string | null }).prompted_by_event_id ?? null,
  };
}

export function mapTimelineEvents(events: RawTimelineEvent[]) {
  return events.map(mapTimelineEvent);
}

/**
 * Group events by their root_event_id into story bundles.
 * Returns an array of bundles, each containing:
 * - rootEvent: the canonical event to display (lowest chain_depth)
 * - perspectives: all other events in the chain
 * - totalCount: total number of events in the bundle
 */
export function groupEventsIntoBundles(events: TimelineEvent[]): StoryBundle[] {
  const bundleMap = new Map<string, TimelineEvent[]>();

  // Group events by rootEventId (or own id if no root)
  for (const event of events) {
    const rootId = event.rootEventId || event.id;
    const existing = bundleMap.get(rootId) || [];
    existing.push(event);
    bundleMap.set(rootId, existing);
  }

  // Convert to StoryBundle array
  const bundles: StoryBundle[] = [];
  for (const [, eventsInBundle] of bundleMap) {
    // Sort by chain_depth to find the root (depth=0 or lowest)
    // Secondary sort by id for stability when depths are equal
    const sorted = [...eventsInBundle].sort((a, b) => {
      const depthDiff = (a.chainDepth ?? 0) - (b.chainDepth ?? 0);
      if (depthDiff !== 0) return depthDiff;
      return a.id.localeCompare(b.id);
    });

    const rootEvent = sorted[0];
    const perspectives = sorted.slice(1);

    bundles.push({
      rootEvent,
      perspectives,
      totalCount: eventsInBundle.length,
    });
  }

  // Sort bundles by root event year
  bundles.sort((a, b) => a.rootEvent.year - b.rootEvent.year);

  return bundles;
}

/**
 * Flatten bundles back to a single event list, showing only root events.
 * Use this for backward-compatible rendering.
 */
export function flattenBundlesToRoots(bundles: StoryBundle[]): TimelineEvent[] {
  return bundles.map(bundle => ({
    ...bundle.rootEvent,
    // Attach perspective count for UI badge
    _perspectiveCount: bundle.totalCount - 1,
  } as TimelineEvent & { _perspectiveCount: number }));
}

const SCORE_EVENT_OVERRIDES: Record<string, Partial<TimelineEvent>> = {
  // No overrides - use database content
};

/**
 * Apply title-based overrides to an event.
 * @param event - The event to potentially override
 * @param overrides - Optional custom overrides map (for testing). Defaults to SCORE_EVENT_OVERRIDES.
 */
export function applyScoreEventOverrides(
  event: TimelineEvent,
  overrides: Record<string, Partial<TimelineEvent>> = SCORE_EVENT_OVERRIDES
) {
  const override = overrides[event.title];
  return override ? { ...event, ...override } : event;
}
