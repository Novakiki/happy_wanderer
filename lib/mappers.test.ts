import { describe, it, expect } from 'vitest';
import {
  mapTimelineEvent,
  mapTimelineEvents,
  groupEventsIntoBundles,
  flattenBundlesToRoots,
  applyScoreEventOverrides,
  type TimelineEvent,
} from './mappers';

// Helper to create a minimal raw event for testing
function createRawEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-id',
    year: 2000,
    year_end: null,
    age_start: null,
    age_end: null,
    life_stage: null,
    timing_certainty: 'approximate' as const,
    timing_input_type: 'year' as const,
    timing_note: null,
    date: null,
    type: 'memory' as const,
    title: 'Test Event',
    preview: 'Test preview',
    full_entry: 'Test full entry',
    why_included: null,
    source_url: null,
    source_name: null,
    location: null,
    people_involved: null,
    contributor_id: 'contributor-1',
    subject_id: null,
    status: 'published' as const,
    privacy_level: 'family' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    prompted_by_event_id: null,
    root_event_id: null,
    chain_depth: 0,
    contributor: null,
    media: null,
    references: [],
    ...overrides,
  };
}

// Helper to create a TimelineEvent for testing
function createTimelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'test-id',
    year: 2000,
    type: 'memory',
    title: 'Test Event',
    contributor: 'Test Contributor',
    media: [],
    references: [],
    chainDepth: 0,
    ...overrides,
  };
}

describe('mapTimelineEvent', () => {
  it('maps basic fields correctly', () => {
    const raw = createRawEvent({
      id: 'event-1',
      year: 1985,
      title: 'Birthday Party',
      preview: 'A great day',
      full_entry: 'A great day with everyone',
    });

    const result = mapTimelineEvent(raw);

    expect(result.id).toBe('event-1');
    expect(result.year).toBe(1985);
    expect(result.title).toBe('Birthday Party');
    expect(result.preview).toBe('A great day');
    expect(result.fullEntry).toBe('A great day with everyone');
  });

  it('maps contributor name from nested object', () => {
    const raw = createRawEvent({
      contributor: { name: 'Amy', relation: 'cousin' },
    });

    const result = mapTimelineEvent(raw);

    expect(result.contributor).toBe('Amy');
    expect(result.contributorRelation).toBe('cousin');
  });

  it('uses "Unknown" when contributor is null', () => {
    const raw = createRawEvent({ contributor: null });

    const result = mapTimelineEvent(raw);

    expect(result.contributor).toBe('Unknown');
    expect(result.contributorRelation).toBeNull();
  });

  it('extracts media from nested structure', () => {
    const mediaItem = {
      id: 'media-1',
      type: 'photo',
      url: 'https://example.com/photo.jpg',
      caption: 'A photo',
      year: 1985,
      uploaded_by: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
    };

    const raw = createRawEvent({
      media: [{ media: mediaItem }, { media: null }],
    });

    const result = mapTimelineEvent(raw);

    expect(result.media).toHaveLength(1);
    expect(result.media?.[0]).toEqual(mediaItem);
  });

  it('maps timing fields correctly', () => {
    const raw = createRawEvent({
      year_end: 1990,
      age_start: 30,
      age_end: 35,
      life_stage: 'young_family',
      timing_certainty: 'approximate',
      timing_input_type: 'age_range',
      timing_note: 'Sometime in her thirties',
    });

    const result = mapTimelineEvent(raw);

    expect(result.yearEnd).toBe(1990);
    expect(result.ageStart).toBe(30);
    expect(result.ageEnd).toBe(35);
    expect(result.lifeStage).toBe('young_family');
    expect(result.timingCertainty).toBe('approximate');
    expect(result.timingInputType).toBe('age_range');
    expect(result.timingNote).toBe('Sometime in her thirties');
  });

  it('maps story chain fields', () => {
    const raw = createRawEvent({
      root_event_id: 'root-1',
      chain_depth: 2,
    });

    const result = mapTimelineEvent(raw);

    expect(result.rootEventId).toBe('root-1');
    expect(result.chainDepth).toBe(2);
  });

  it('defaults chain_depth to 0 when null', () => {
    const raw = createRawEvent({ chain_depth: null });

    const result = mapTimelineEvent(raw);

    expect(result.chainDepth).toBe(0);
  });
});

describe('mapTimelineEvents', () => {
  it('maps an array of events', () => {
    const events = [
      createRawEvent({ id: 'event-1', title: 'Event 1' }),
      createRawEvent({ id: 'event-2', title: 'Event 2' }),
    ];

    const result = mapTimelineEvents(events);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('event-1');
    expect(result[1].id).toBe('event-2');
  });

  it('returns empty array for empty input', () => {
    const result = mapTimelineEvents([]);

    expect(result).toEqual([]);
  });
});

describe('groupEventsIntoBundles', () => {
  it('groups events by rootEventId', () => {
    const events: TimelineEvent[] = [
      createTimelineEvent({ id: 'root-1', rootEventId: 'root-1', chainDepth: 0, year: 1980 }),
      createTimelineEvent({ id: 'child-1', rootEventId: 'root-1', chainDepth: 1, year: 1980 }),
      createTimelineEvent({ id: 'root-2', rootEventId: 'root-2', chainDepth: 0, year: 1990 }),
    ];

    const bundles = groupEventsIntoBundles(events);

    expect(bundles).toHaveLength(2);
    expect(bundles[0].rootEvent.id).toBe('root-1');
    expect(bundles[0].perspectives).toHaveLength(1);
    expect(bundles[0].perspectives[0].id).toBe('child-1');
    expect(bundles[0].totalCount).toBe(2);
  });

  it('uses event id as root when rootEventId is null', () => {
    const events: TimelineEvent[] = [
      createTimelineEvent({ id: 'standalone', rootEventId: null, year: 2000 }),
    ];

    const bundles = groupEventsIntoBundles(events);

    expect(bundles).toHaveLength(1);
    expect(bundles[0].rootEvent.id).toBe('standalone');
    expect(bundles[0].perspectives).toHaveLength(0);
    expect(bundles[0].totalCount).toBe(1);
  });

  it('selects event with lowest chainDepth as root', () => {
    const events: TimelineEvent[] = [
      createTimelineEvent({ id: 'depth-2', rootEventId: 'root-1', chainDepth: 2, year: 2000 }),
      createTimelineEvent({ id: 'depth-0', rootEventId: 'root-1', chainDepth: 0, year: 2000 }),
      createTimelineEvent({ id: 'depth-1', rootEventId: 'root-1', chainDepth: 1, year: 2000 }),
    ];

    const bundles = groupEventsIntoBundles(events);

    expect(bundles[0].rootEvent.id).toBe('depth-0');
    expect(bundles[0].perspectives.map(p => p.id)).toEqual(['depth-1', 'depth-2']);
  });

  it('sorts bundles by root event year', () => {
    const events: TimelineEvent[] = [
      createTimelineEvent({ id: 'later', rootEventId: 'later', year: 2000 }),
      createTimelineEvent({ id: 'earlier', rootEventId: 'earlier', year: 1980 }),
      createTimelineEvent({ id: 'middle', rootEventId: 'middle', year: 1990 }),
    ];

    const bundles = groupEventsIntoBundles(events);

    expect(bundles[0].rootEvent.id).toBe('earlier');
    expect(bundles[1].rootEvent.id).toBe('middle');
    expect(bundles[2].rootEvent.id).toBe('later');
  });

  it('handles empty input', () => {
    const bundles = groupEventsIntoBundles([]);

    expect(bundles).toEqual([]);
  });

  it('handles events with undefined chainDepth', () => {
    const events: TimelineEvent[] = [
      createTimelineEvent({ id: 'no-depth', rootEventId: 'root', chainDepth: undefined, year: 2000 }),
      createTimelineEvent({ id: 'has-depth', rootEventId: 'root', chainDepth: 1, year: 2000 }),
    ];

    const bundles = groupEventsIntoBundles(events);

    // undefined should be treated as 0
    expect(bundles[0].rootEvent.id).toBe('no-depth');
  });

  it('uses stable secondary sort by id when chainDepth ties', () => {
    const events: TimelineEvent[] = [
      createTimelineEvent({ id: 'z-event', rootEventId: 'root', chainDepth: 0, year: 2000 }),
      createTimelineEvent({ id: 'a-event', rootEventId: 'root', chainDepth: 0, year: 2000 }),
      createTimelineEvent({ id: 'm-event', rootEventId: 'root', chainDepth: 0, year: 2000 }),
    ];

    const bundles = groupEventsIntoBundles(events);

    // Should sort alphabetically by id when depth is equal
    expect(bundles[0].rootEvent.id).toBe('a-event');
    expect(bundles[0].perspectives.map(p => p.id)).toEqual(['m-event', 'z-event']);
  });

  it('produces deterministic order regardless of input order', () => {
    const eventsOrderA: TimelineEvent[] = [
      createTimelineEvent({ id: 'c', rootEventId: 'root', chainDepth: 1, year: 2000 }),
      createTimelineEvent({ id: 'a', rootEventId: 'root', chainDepth: 1, year: 2000 }),
      createTimelineEvent({ id: 'b', rootEventId: 'root', chainDepth: 0, year: 2000 }),
    ];

    const eventsOrderB: TimelineEvent[] = [
      createTimelineEvent({ id: 'a', rootEventId: 'root', chainDepth: 1, year: 2000 }),
      createTimelineEvent({ id: 'b', rootEventId: 'root', chainDepth: 0, year: 2000 }),
      createTimelineEvent({ id: 'c', rootEventId: 'root', chainDepth: 1, year: 2000 }),
    ];

    const bundlesA = groupEventsIntoBundles(eventsOrderA);
    const bundlesB = groupEventsIntoBundles(eventsOrderB);

    // Same result regardless of input order
    expect(bundlesA[0].rootEvent.id).toBe(bundlesB[0].rootEvent.id);
    expect(bundlesA[0].perspectives.map(p => p.id)).toEqual(bundlesB[0].perspectives.map(p => p.id));
  });
});

describe('flattenBundlesToRoots', () => {
  it('extracts root events from bundles', () => {
    const bundles = [
      {
        rootEvent: createTimelineEvent({ id: 'root-1' }),
        perspectives: [createTimelineEvent({ id: 'child-1' })],
        totalCount: 2,
      },
      {
        rootEvent: createTimelineEvent({ id: 'root-2' }),
        perspectives: [],
        totalCount: 1,
      },
    ];

    const result = flattenBundlesToRoots(bundles);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('root-1');
    expect(result[1].id).toBe('root-2');
  });

  it('attaches perspective count', () => {
    const bundles = [
      {
        rootEvent: createTimelineEvent({ id: 'root-1' }),
        perspectives: [
          createTimelineEvent({ id: 'child-1' }),
          createTimelineEvent({ id: 'child-2' }),
        ],
        totalCount: 3,
      },
    ];

    const result = flattenBundlesToRoots(bundles);

    expect((result[0] as TimelineEvent & { _perspectiveCount: number })._perspectiveCount).toBe(2);
  });

  it('returns empty array for empty input', () => {
    const result = flattenBundlesToRoots([]);

    expect(result).toEqual([]);
  });
});

describe('applyScoreEventOverrides', () => {
  it('returns event unchanged when no override exists', () => {
    const event = createTimelineEvent({
      title: 'No Override Event',
      preview: 'Original preview',
    });

    const result = applyScoreEventOverrides(event);

    expect(result).toEqual(event);
  });

  it('preserves all original properties when no override', () => {
    const event = createTimelineEvent({
      id: 'test-123',
      year: 1985,
      title: 'Test Title',
      contributor: 'Test Person',
    });

    const result = applyScoreEventOverrides(event);

    expect(result.id).toBe('test-123');
    expect(result.year).toBe(1985);
    expect(result.title).toBe('Test Title');
    expect(result.contributor).toBe('Test Person');
  });

  it('applies override when title matches', () => {
    const event = createTimelineEvent({
      title: 'Override Me',
      preview: 'Original preview',
      year: 1980,
    });

    const customOverrides = {
      'Override Me': {
        preview: 'Overridden preview',
        whyIncluded: 'Added via override',
      },
    };

    const result = applyScoreEventOverrides(event, customOverrides);

    expect(result.preview).toBe('Overridden preview');
    expect(result.whyIncluded).toBe('Added via override');
    // Original properties preserved
    expect(result.title).toBe('Override Me');
    expect(result.year).toBe(1980);
  });

  it('override takes precedence over original values', () => {
    const event = createTimelineEvent({
      title: 'Test Event',
      year: 1980,
      preview: 'Original',
    });

    const customOverrides = {
      'Test Event': {
        year: 1990,
        preview: 'Overridden',
      },
    };

    const result = applyScoreEventOverrides(event, customOverrides);

    expect(result.year).toBe(1990);
    expect(result.preview).toBe('Overridden');
  });

  it('does not mutate the original event', () => {
    const event = createTimelineEvent({
      title: 'Immutable Test',
      preview: 'Original',
    });

    const customOverrides = {
      'Immutable Test': { preview: 'Changed' },
    };

    applyScoreEventOverrides(event, customOverrides);

    expect(event.preview).toBe('Original');
  });
});
