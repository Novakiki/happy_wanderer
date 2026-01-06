/**
 * Enriched Interpreter Payload Types
 *
 * These types define the structured data shape passed to the Interpreter LLM
 * for pattern-finding across memories. The enriched payload includes temporal
 * structure, provenance, recurrence signals, and curator-tagged motifs.
 */

// === Enums / Constrained Types ===

export type TimingCertainty = 'exact' | 'approximate' | 'vague' | 'unknown';
export type WitnessType = 'direct' | 'secondhand' | 'mixed' | 'unknown';
export type Recurrence = 'one_time' | 'repeated' | 'ongoing' | 'unknown';
export type MemoryType = 'memory' | 'milestone' | 'origin' | 'unknown';
export type TrustStatus = true | false | 'unknown';
export type ThreadRelationship = 'perspective' | 'addition' | 'correction' | 'related';

// === Memory Substructures ===

export type MemoryContent = {
  title: string | null;
  full_entry: string;
  preview: string | null;
};

export type MemoryTime = {
  year_start: number | null;
  year_end: number | null;
  time_label: string | null;
  life_stage: string | null;
  timing_certainty: TimingCertainty;
};

export type MemoryPlace = {
  raw: string | null;
  normalized: {
    city: string | null;
    region: string | null;
    country: string | null;
  };
};

export type MemoryClassification = {
  type: MemoryType;
  recurrence: Recurrence;
  why_included: string | null;
  tags_freeform: string[];
};

export type MemorySubmitter = {
  name: string | null;
  relationship_to_subject: string | null;
  trusted: TrustStatus;
};

export type PersonInvolved = {
  name: string;
  role: string;
};

export type EventReference = {
  name: string | null;
  role: string;
  witness_type: WitnessType;
};

export type MemoryPeople = {
  submitter: MemorySubmitter;
  people_involved: PersonInvolved[];
  event_references: EventReference[];
};

export type MemoryProvenance = {
  witness_type: WitnessType;
  source_notes: string | null;
};

export type MemoryCuration = {
  motifs: string[];
  motif_confidence: 'high' | 'medium' | 'low' | 'unknown';
};

export type MemoryLinks = {
  thread_ids: string[];
  related_memory_ids: string[];
};

// === Full Memory Object ===

export type EnrichedMemory = {
  memory_id: string;
  created_at: string;
  content: MemoryContent;
  time: MemoryTime;
  place: MemoryPlace;
  classification: MemoryClassification;
  people: MemoryPeople;
  provenance: MemoryProvenance;
  curation: MemoryCuration;
  links: MemoryLinks;
};

// === Thread Types ===

export type ThreadEntry = {
  entry_id: string;
  created_at: string;
  author_name: string | null;
  author_relationship: string | null;
  trusted: TrustStatus;
  type: ThreadRelationship;
  witness_type: WitnessType;
  timing_certainty: TimingCertainty;
  time_label: string | null;
  content: string;
  motifs_suggested: string[];
};

export type MemoryThread = {
  thread_id: string;
  topic: string | null;
  memory_ids: string[];
  entries: ThreadEntry[];
};

// === Motif Legend ===

export type MotifDefinition = {
  motif: string;
  definition: string;
};

// === Evidence Controls ===

export type EvidenceControls = {
  trust_policy: {
    trusted_weight: number;
    untrusted_weight: number;
    unknown_weight: number;
  };
  witness_weight: Record<WitnessType, number>;
  timing_weight: Record<TimingCertainty, number>;
};

// === Task Context ===

export type TaskContext = {
  mode: 'interpreter';
  goal: string;
  output_preferences: {
    cite_memory_ids: boolean;
    separate_facts_from_inference: boolean;
    highlight_disagreements: boolean;
  };
};

// === Subject Context ===

export type SubjectContext = {
  id: string;
  display_name: string;
  project_context: string;
};

// === Full Payload ===

export type InterpreterPayload = {
  schema_version: 'memory_payload_v1';
  subject: SubjectContext;
  task_context: TaskContext;
  evidence_controls: EvidenceControls;
  motif_legend: MotifDefinition[];
  memories: EnrichedMemory[];
  threads: MemoryThread[];
};

// === Database Input Types ===

/**
 * Raw memory data from the database before transformation.
 * This represents what we fetch from Supabase.
 */
export type DbMemoryRow = {
  id: string;
  created_at: string;
  title: string | null;
  full_entry: string | null;
  preview: string | null;
  year: number | null;
  year_end: number | null;
  life_stage: string | null;
  timing_certainty: string | null;
  type: string | null;
  location: string | null;
  witness_type: string | null;
  recurrence: string | null;
  why_included: string | null;
  people_involved: string[] | null;
  contributor_id: string | null;
};

export type DbContributorRow = {
  id: string;
  name: string | null;
  relation: string | null;
  trusted: boolean | null;
};

export type DbMotifLinkRow = {
  motif_id: string;
  link_type: string;
  motif: {
    id: string;
    label: string;
    definition: string | null;
  } | null;
};

export type DbEventReferenceRow = {
  id: string;
  type: string;
  role: string | null;
  person_id: string | null;
  person?: {
    id: string;
    name: string | null;
  } | null;
};

export type DbThreadRow = {
  id: string;
  original_event_id: string;
  response_event_id: string;
  relationship: string | null;
  note: string | null;
};

export type DbMotifRow = {
  id: string;
  label: string;
  definition: string | null;
};

// === Interpretation Output Types ===

/**
 * Structured interpretation output for machine-usable results.
 * Even if the UI renders prose, this enables:
 * - Comparison across sessions
 * - Pattern evolution tracking
 * - Persistent interpretation storage
 */

export type PatternStrength = 'high' | 'medium' | 'low';

export type InterpretedPattern = {
  pattern_id: string;
  name: string;
  summary: string;
  evidence_ids: string[];
  life_stages: string[];
  motifs: string[];
  strength: PatternStrength;
  notes: string;
};

export type InterpretedTension = {
  tension_id: string;
  description: string;
  memory_ids: string[];
  unresolved: boolean;
};

export type InterpretationOutput = {
  interpretation_id: string;
  created_at: string;
  query: string;
  patterns: InterpretedPattern[];
  tensions: InterpretedTension[];
  timeline_anchors: Array<{
    year_or_stage: string;
    description: string;
    memory_ids: string[];
  }>;
  open_questions: string[];
  metadata: {
    memories_analyzed: number;
    motifs_referenced: string[];
    response_tokens: number;
  };
};
