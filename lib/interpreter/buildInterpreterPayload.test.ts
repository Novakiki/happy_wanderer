import { describe, it, expect } from 'vitest';
import { buildInterpreterPayload, type EnrichedMemoryInput } from './buildInterpreterPayload';
import type { DbMotifRow, DbThreadRow } from './types';

describe('buildInterpreterPayload', () => {
  const baseMemory: EnrichedMemoryInput = {
    id: 'mem_001',
    created_at: '2026-01-01T12:00:00Z',
    title: 'Cookies every visit',
    full_entry: 'Val always had fresh cookies ready.',
    preview: 'Cookies were always ready.',
    year: 1985,
    year_end: null,
    life_stage: 'childhood',
    timing_certainty: 'approximate',
    type: 'memory',
    location: "Val's house",
    witness_type: 'direct',
    recurrence: 'repeated',
    why_included: 'It made us feel expected.',
    people_involved: ['Sarah', 'Mike'],
    contributor_id: 'contrib_001',
    contributor: {
      id: 'contrib_001',
      name: 'Sarah',
      relation: 'cousin',
      trusted: true,
    },
    motif_links: [
      {
        motif_id: 'motif_001',
        link_type: 'supports',
        motif: {
          id: 'motif_001',
          label: 'hospitality',
          definition: 'Making others feel welcomed.',
        },
      },
    ],
    event_references: [],
  };

  it('produces correct schema version', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.schema_version).toBe('memory_payload_v1');
  });

  it('maps time fields correctly', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    const memory = payload.memories[0];

    expect(memory.time.year_start).toBe(1985);
    expect(memory.time.year_end).toBe(1985); // Falls back to year when year_end is null
    expect(memory.time.life_stage).toBe('childhood');
    expect(memory.time.timing_certainty).toBe('approximate');
    expect(memory.time.time_label).toBe('~1985'); // Approximate prefix
  });

  it('maps exact timing without prefix', () => {
    const exactMemory: EnrichedMemoryInput = {
      ...baseMemory,
      timing_certainty: 'exact',
    };
    const payload = buildInterpreterPayload({ memories: [exactMemory] });
    expect(payload.memories[0].time.time_label).toBe('1985');
  });

  it('maps year range correctly', () => {
    const rangeMemory: EnrichedMemoryInput = {
      ...baseMemory,
      year: 1985,
      year_end: 1990,
    };
    const payload = buildInterpreterPayload({ memories: [rangeMemory] });
    expect(payload.memories[0].time.time_label).toBe('1985–1990');
  });

  it('maps recurrence correctly', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.memories[0].classification.recurrence).toBe('repeated');
  });

  it('defaults unknown recurrence', () => {
    const unknownMemory: EnrichedMemoryInput = {
      ...baseMemory,
      recurrence: null,
    };
    const payload = buildInterpreterPayload({ memories: [unknownMemory] });
    expect(payload.memories[0].classification.recurrence).toBe('unknown');
  });

  it('maps witness_type correctly', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.memories[0].provenance.witness_type).toBe('direct');
  });

  it('maps submitter trust status (true)', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.memories[0].people.submitter.trusted).toBe(true);
  });

  it('maps submitter trust status (false)', () => {
    const untrustedMemory: EnrichedMemoryInput = {
      ...baseMemory,
      contributor: { ...baseMemory.contributor!, trusted: false },
    };
    const payload = buildInterpreterPayload({ memories: [untrustedMemory] });
    expect(payload.memories[0].people.submitter.trusted).toBe(false);
  });

  it('maps submitter trust status (unknown/null)', () => {
    const unknownTrustMemory: EnrichedMemoryInput = {
      ...baseMemory,
      contributor: { ...baseMemory.contributor!, trusted: null },
    };
    const payload = buildInterpreterPayload({ memories: [unknownTrustMemory] });
    expect(payload.memories[0].people.submitter.trusted).toBe('unknown');
  });

  it('extracts motifs from motif_links', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.memories[0].curation.motifs).toContain('hospitality');
  });

  it('includes motif legend when provided', () => {
    const motifLegend: DbMotifRow[] = [
      { id: 'motif_001', label: 'hospitality', definition: 'Making others feel welcomed.' },
      { id: 'motif_002', label: 'food_as_love', definition: 'Care through food.' },
    ];
    const payload = buildInterpreterPayload({ memories: [baseMemory], motifLegend });
    expect(payload.motif_legend).toHaveLength(2);
    expect(payload.motif_legend[0].motif).toBe('hospitality');
  });

  it('normalizes people_involved from string array', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.memories[0].people.people_involved).toEqual([
      { name: 'Sarah', role: 'involved' },
      { name: 'Mike', role: 'involved' },
    ]);
  });

  it('builds threads from thread data', () => {
    const threads: DbThreadRow[] = [
      {
        id: 'thread_001',
        original_event_id: 'mem_001',
        response_event_id: 'mem_002',
        relationship: 'addition',
        note: 'More about cookies',
      },
    ];
    const payload = buildInterpreterPayload({ memories: [baseMemory], threads });

    expect(payload.threads).toHaveLength(1);
    expect(payload.threads[0].thread_id).toBe('thread_001');
    expect(payload.threads[0].memory_ids).toContain('mem_001');
    expect(payload.threads[0].memory_ids).toContain('mem_002');
  });

  it('links memories to their threads', () => {
    const threads: DbThreadRow[] = [
      {
        id: 'thread_001',
        original_event_id: 'mem_001',
        response_event_id: 'mem_002',
        relationship: 'addition',
        note: null,
      },
    ];
    const payload = buildInterpreterPayload({ memories: [baseMemory], threads });
    expect(payload.memories[0].links.thread_ids).toContain('thread_001');
  });

  it('preserves why_included verbatim', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.memories[0].classification.why_included).toBe('It made us feel expected.');
  });

  it('handles memory with minimal fields', () => {
    const minimalMemory: EnrichedMemoryInput = {
      id: 'mem_minimal',
      created_at: '2026-01-01T00:00:00Z',
      title: 'A brief note',
      full_entry: null,
      preview: null,
      year: null,
      year_end: null,
      life_stage: null,
      timing_certainty: null,
      type: null,
      location: null,
      witness_type: null,
      recurrence: null,
      why_included: null,
      people_involved: null,
      contributor_id: null,
    };

    const payload = buildInterpreterPayload({ memories: [minimalMemory] });
    expect(payload.memories).toHaveLength(1);
    expect(payload.memories[0].time.timing_certainty).toBe('unknown');
    expect(payload.memories[0].provenance.witness_type).toBe('unknown');
    expect(payload.memories[0].classification.recurrence).toBe('unknown');
    expect(payload.memories[0].people.submitter.trusted).toBe('unknown');
  });

  it('filters out memories without content', () => {
    const emptyMemory: EnrichedMemoryInput = {
      ...baseMemory,
      id: 'mem_empty',
      title: null,
      full_entry: null,
      preview: null,
    };

    const payload = buildInterpreterPayload({ memories: [baseMemory, emptyMemory] });
    expect(payload.memories).toHaveLength(1);
    expect(payload.memories[0].memory_id).toBe('mem_001');
  });

  it('includes evidence_controls with correct weights', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });

    expect(payload.evidence_controls.trust_policy.trusted_weight).toBe(1.0);
    expect(payload.evidence_controls.trust_policy.untrusted_weight).toBe(0.6);
    expect(payload.evidence_controls.witness_weight.direct).toBe(1.0);
    expect(payload.evidence_controls.witness_weight.secondhand).toBe(0.7);
    expect(payload.evidence_controls.timing_weight.exact).toBe(1.0);
    expect(payload.evidence_controls.timing_weight.vague).toBe(0.65);
  });

  it('sets task_context mode to interpreter', () => {
    const payload = buildInterpreterPayload({ memories: [baseMemory] });
    expect(payload.task_context.mode).toBe('interpreter');
  });

  it('uses custom subject when provided', () => {
    const payload = buildInterpreterPayload({
      memories: [baseMemory],
      subjectId: 'custom_subject',
      subjectName: 'Custom Name',
      projectContext: 'Custom Project',
    });

    expect(payload.subject.id).toBe('custom_subject');
    expect(payload.subject.display_name).toBe('Custom Name');
    expect(payload.subject.project_context).toBe('Custom Project');
  });
});
