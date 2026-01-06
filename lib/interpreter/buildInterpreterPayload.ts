/**
 * Builds the enriched interpreter payload from database records.
 *
 * This transforms flat database rows into the structured payload shape
 * that enables the Interpreter LLM to find patterns across time,
 * recurrence, provenance, and multi-voice perspectives.
 */

import type {
  InterpreterPayload,
  EnrichedMemory,
  MemoryThread,
  MotifDefinition,
  TimingCertainty,
  WitnessType,
  Recurrence,
  MemoryType,
  TrustStatus,
  ThreadRelationship,
  PersonInvolved,
  EventReference,
  DbMemoryRow,
  DbContributorRow,
  DbMotifLinkRow,
  DbEventReferenceRow,
  DbThreadRow,
  DbMotifRow,
} from './types';

// === Type Coercion Helpers ===

function asTimingCertainty(v: unknown): TimingCertainty {
  if (v === 'exact' || v === 'approximate' || v === 'vague') return v;
  return 'unknown';
}

function asWitnessType(v: unknown): WitnessType {
  if (v === 'direct' || v === 'secondhand' || v === 'mixed') return v;
  return 'unknown';
}

function asRecurrence(v: unknown): Recurrence {
  if (v === 'one_time' || v === 'repeated' || v === 'ongoing') return v;
  return 'unknown';
}

function asMemoryType(v: unknown): MemoryType {
  if (v === 'memory' || v === 'milestone' || v === 'origin') return v;
  return 'unknown';
}

function asTrustStatus(v: unknown): TrustStatus {
  if (v === true) return true;
  if (v === false) return false;
  return 'unknown';
}

function asThreadRelationship(v: unknown): ThreadRelationship {
  if (v === 'perspective' || v === 'addition' || v === 'correction' || v === 'related') {
    return v;
  }
  return 'addition';
}

// === Time Label Generation ===

function buildTimeLabel(
  yearStart: number | null,
  yearEnd: number | null,
  certainty: TimingCertainty
): string | null {
  if (!yearStart) return null;

  if (yearEnd && yearEnd !== yearStart) {
    return `${yearStart}–${yearEnd}`;
  }

  if (certainty === 'approximate' || certainty === 'vague') {
    return `~${yearStart}`;
  }

  return `${yearStart}`;
}

// === Data Normalization Helpers ===

function normalizePeopleInvolved(raw: string[] | null): PersonInvolved[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name) => ({ name: name.trim(), role: 'involved' }));
}

function normalizeEventReferences(refs: DbEventReferenceRow[] | undefined): EventReference[] {
  if (!refs || !Array.isArray(refs)) return [];
  return refs
    .filter((r) => r.type === 'person' && r.person?.name)
    .map((r) => ({
      name: r.person?.name ?? null,
      role: r.role ?? 'witness',
      witness_type: asWitnessType('direct'), // Default; could be enriched
    }));
}

// === Enriched Memory Input Type ===

export type EnrichedMemoryInput = DbMemoryRow & {
  contributor?: DbContributorRow | null;
  motif_links?: DbMotifLinkRow[];
  event_references?: DbEventReferenceRow[];
};

// === Main Builder ===

export type BuildInterpreterPayloadArgs = {
  subjectId?: string;
  subjectName?: string;
  projectContext?: string;
  memories: EnrichedMemoryInput[];
  motifLegend?: DbMotifRow[];
  threads?: DbThreadRow[];
};

export function buildInterpreterPayload(
  args: BuildInterpreterPayloadArgs
): InterpreterPayload {
  const {
    subjectId = 'valerie',
    subjectName = 'Valerie',
    projectContext = 'Happy Wanderer memory archive',
    memories,
    motifLegend = [],
    threads = [],
  } = args;

  // Build motif legend
  const formattedMotifLegend: MotifDefinition[] = motifLegend
    .filter((m) => m.label && m.definition)
    .map((m) => ({
      motif: m.label,
      definition: m.definition!,
    }));

  // Build thread lookup: memory_id -> thread_ids
  const memoryToThreads = new Map<string, Set<string>>();
  const threadById = new Map<string, MemoryThread>();

  for (const t of threads) {
    // Add both original and response events to thread membership
    for (const memId of [t.original_event_id, t.response_event_id]) {
      if (!memId) continue;
      if (!memoryToThreads.has(memId)) {
        memoryToThreads.set(memId, new Set());
      }
      memoryToThreads.get(memId)!.add(t.id);
    }

    // Build or update thread object
    if (!threadById.has(t.id)) {
      threadById.set(t.id, {
        thread_id: t.id,
        topic: t.note || null,
        memory_ids: [],
        entries: [],
      });
    }

    const thread = threadById.get(t.id)!;
    if (t.original_event_id && !thread.memory_ids.includes(t.original_event_id)) {
      thread.memory_ids.push(t.original_event_id);
    }
    if (t.response_event_id && !thread.memory_ids.includes(t.response_event_id)) {
      thread.memory_ids.push(t.response_event_id);
    }
  }

  // Transform memories
  const enrichedMemories: EnrichedMemory[] = memories
    .filter((m) => m.full_entry || m.preview || m.title)
    .map((m) => {
      const timingCertainty = asTimingCertainty(m.timing_certainty);
      const witnessType = asWitnessType(m.witness_type);
      const recurrence = asRecurrence(m.recurrence);
      const memoryType = asMemoryType(m.type);

      // Extract motifs from links
      const motifs: string[] = (m.motif_links ?? [])
        .filter((link) => link.motif?.label)
        .map((link) => link.motif!.label);

      // Get thread IDs for this memory
      const threadIds = Array.from(memoryToThreads.get(m.id) ?? []);

      const enriched: EnrichedMemory = {
        memory_id: m.id,
        created_at: m.created_at,
        content: {
          title: m.title,
          full_entry: m.full_entry || m.preview || m.title || '',
          preview: m.preview,
        },
        time: {
          year_start: m.year,
          year_end: m.year_end ?? m.year,
          time_label: buildTimeLabel(m.year, m.year_end, timingCertainty),
          life_stage: m.life_stage,
          timing_certainty: timingCertainty,
        },
        place: {
          raw: m.location,
          normalized: { city: null, region: null, country: null },
        },
        classification: {
          type: memoryType,
          recurrence: recurrence,
          why_included: m.why_included,
          tags_freeform: [],
        },
        people: {
          submitter: {
            name: m.contributor?.name ?? null,
            relationship_to_subject: m.contributor?.relation ?? null,
            trusted: asTrustStatus(m.contributor?.trusted),
          },
          people_involved: normalizePeopleInvolved(m.people_involved),
          event_references: normalizeEventReferences(m.event_references),
        },
        provenance: {
          witness_type: witnessType,
          source_notes: null,
        },
        curation: {
          motifs,
          motif_confidence: motifs.length > 0 ? 'medium' : 'unknown',
        },
        links: {
          thread_ids: threadIds,
          related_memory_ids: [],
        },
      };

      return enriched;
    });

  // Build final payload
  const payload: InterpreterPayload = {
    schema_version: 'memory_payload_v1',
    subject: {
      id: subjectId,
      display_name: subjectName,
      project_context: projectContext,
    },
    task_context: {
      mode: 'interpreter',
      goal: 'Identify durable patterns with evidence across time, recurrence, and perspectives; avoid overclaiming.',
      output_preferences: {
        cite_memory_ids: true,
        separate_facts_from_inference: true,
        highlight_disagreements: true,
      },
    },
    evidence_controls: {
      trust_policy: {
        trusted_weight: 1.0,
        untrusted_weight: 0.6,
        unknown_weight: 0.8,
      },
      witness_weight: {
        direct: 1.0,
        mixed: 0.85,
        secondhand: 0.7,
        unknown: 0.75,
      },
      timing_weight: {
        exact: 1.0,
        approximate: 0.85,
        vague: 0.65,
        unknown: 0.75,
      },
    },
    motif_legend: formattedMotifLegend,
    memories: enrichedMemories,
    threads: Array.from(threadById.values()),
  };

  return payload;
}

// === Lightweight Payload (for token-constrained contexts) ===

export function buildLightweightPayload(
  args: BuildInterpreterPayloadArgs
): InterpreterPayload {
  const full = buildInterpreterPayload(args);

  // Strip less-essential fields to save tokens
  const lightMemories = full.memories.map((m) => ({
    ...m,
    place: { raw: m.place.raw, normalized: { city: null, region: null, country: null } },
    classification: {
      ...m.classification,
      tags_freeform: [], // Drop freeform tags
    },
  }));

  return {
    ...full,
    memories: lightMemories,
  };
}
