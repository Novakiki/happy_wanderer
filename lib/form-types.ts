/**
 * Shared types for note/memory forms (add and edit)
 * Single source of truth for form data structures
 */

// =============================================================================
// Provenance - How the contributor knows this story
// =============================================================================

export type ProvenanceType = 'firsthand' | 'secondhand' | 'from_references' | 'pattern_observed';

export type ProvenanceData = {
  type: ProvenanceType;
  toldByName?: string;        // For 'secondhand' - who told you
  toldByRelationship?: string | null; // For 'secondhand' - their relationship to Val
  referenceName?: string;     // For 'from_references' - what record/document
  referenceUrl?: string;      // For 'from_references' - link to record
};

// =============================================================================
// Witnessing + recurrence (submission provenance fields)
// =============================================================================

export type WitnessType = 'direct' | 'secondhand' | 'mixed' | 'unsure';
export type Recurrence = 'one_time' | 'repeated' | 'ongoing';

export function provenanceToWitnessType(prov: ProvenanceData): WitnessType {
  switch (prov.type) {
    case 'firsthand':
      return 'direct';
    case 'secondhand':
      return 'secondhand';
    case 'from_references':
      return 'secondhand';
    case 'pattern_observed':
      return 'direct';
    default:
      return 'unsure';
  }
}

export function provenanceToRecurrence(prov: ProvenanceData): Recurrence {
  if (prov.type === 'pattern_observed') {
    return 'repeated';
  }
  return 'one_time';
}

// =============================================================================
// Timing - When this happened
// =============================================================================

export type TimingMode = 'exact' | 'year' | 'year_range' | 'life_stage';
export type TimingCertainty = 'exact' | 'approximate' | 'vague';
export type LifeStage = 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond';

export type TimingData = {
  mode: TimingMode;
  certainty: TimingCertainty;
  exactDate?: string;         // For 'exact' mode - YYYY-MM-DD
  year?: number;              // For 'year' or 'year_range' mode
  yearEnd?: number | null;    // For 'year_range' mode
  ageStart?: number | null;   // For age-based timing
  ageEnd?: number | null;     // For age-based timing
  lifeStage?: LifeStage | null;  // For 'life_stage' mode
  note?: string;              // Optional timing note
};

// =============================================================================
// People - Who else was part of this memory
// =============================================================================

export type PersonRole = 'witness' | 'heard_from' | 'related';

// Identity disclosure ladder
export type IdentityState = 'approved' | 'pending' | 'anonymized' | 'removed';

// Visual/media treatment (applies to images/avatars, not text)
export type MediaPresentation = 'normal' | 'blurred' | 'hidden';

export type PersonReference = {
  id?: string;                // Database ID if existing
  personId?: string | null;   // Linked person record ID
  name: string;
  relationship?: string | null;
  role: PersonRole;
  phone?: string;             // For invitations
  // Visibility
  identityState?: IdentityState;          // optional on form payloads
  mediaPresentation?: MediaPresentation;  // optional on form payloads
};

// =============================================================================
// References - External links and documentation
// =============================================================================

export type Reference = {
  id?: string;
  displayName: string;
  url: string;
};

// =============================================================================
// Entry Types
// =============================================================================

export type EntryType = 'memory' | 'milestone' | 'origin';

// =============================================================================
// Privacy
// =============================================================================

export type PrivacyLevel = 'public' | 'family';

// =============================================================================
// Complete Note Form Data
// =============================================================================

export type NoteFormData = {
  // Core content
  entryType: EntryType;
  title: string;
  content: string;
  whyIncluded?: string;

  // Timing
  timing: TimingData;
  location?: string;

  // Provenance
  provenance: ProvenanceData;

  // People
  people: PersonReference[];

  // References (external links)
  references: Reference[];

  // Privacy
  privacyLevel: PrivacyLevel;

  // Attachments (optional)
  attachment?: {
    type: 'image' | 'audio' | 'link' | 'none';
    url?: string;
    caption?: string;
  };
};

// =============================================================================
// Form Mode - determines UI behavior
// =============================================================================

export type FormMode = 'add' | 'edit';

// =============================================================================
// Default values
// =============================================================================

export const DEFAULT_TIMING: TimingData = {
  mode: 'year',
  certainty: 'approximate',
};

export const DEFAULT_PROVENANCE: ProvenanceData = {
  type: 'firsthand',
};

export const DEFAULT_NOTE_FORM_DATA: NoteFormData = {
  entryType: 'memory',
  title: '',
  content: '',
  timing: DEFAULT_TIMING,
  provenance: DEFAULT_PROVENANCE,
  people: [],
  references: [],
  privacyLevel: 'family',
};

// =============================================================================
// Mapping helpers (for legacy data conversion)
// =============================================================================

/**
 * Maps legacy person roles to canonical roles (for loading)
 */
export function mapLegacyPersonRole(role?: string | null): PersonRole {
  if (role === 'witness' || role === 'was_there') return 'witness';
  if (role === 'heard_from' || role === 'told_me') return 'heard_from';
  if (role === 'related' || role === 'might_remember') return 'related';
  if (role === 'source') return 'heard_from';
  return 'witness'; // default
}

/**
 * Maps canonical person roles back to reference roles (for saving to API)
 */
export function mapToLegacyPersonRole(role: PersonRole): 'witness' | 'heard_from' | 'related' {
  return role;
}

/**
 * Maps legacy provenance types to new unified types
 */
export function mapLegacyProvenance(type?: string | null): ProvenanceType {
  if (type === 'firsthand') return 'firsthand';
  if (type === 'told' || type === 'secondhand' || type === 'mixed') return 'secondhand';
  if (type === 'record' || type === 'from_references') return 'from_references';
  if (type === 'pattern_observed') return 'pattern_observed';
  return 'firsthand'; // default
}

/**
 * Derives provenance data from source_name/source_url (for loading legacy data)
 */
export function deriveProvenanceFromSource(
  sourceName?: string | null,
  sourceUrl?: string | null
): ProvenanceData {
  const name = sourceName?.toLowerCase() || '';

  if (name === 'personal memory' || name === '') {
    return { type: 'firsthand' };
  }
  if (name === 'told to me' || name.startsWith('told')) {
    // Extract "by X" from "Told to me by X" format
    const byMatch = sourceName?.match(/told to me by\s+(.+)/i);
    return { type: 'secondhand', toldByName: byMatch?.[1]?.trim() || '' };
  }
  if (name === 'mixed / not sure' || name.startsWith('mixed')) {
    // Legacy: map mixed to secondhand
    return { type: 'secondhand' };
  }
  // Assume it's a record/reference
  return {
    type: 'from_references',
    referenceName: sourceName || '',
    referenceUrl: sourceUrl || '',
  };
}

/**
 * Converts provenance data to source_name/source_url (for saving)
 */
export function provenanceToSource(prov: ProvenanceData): {
  source_name: string;
  source_url: string;
} {
  switch (prov.type) {
    case 'firsthand':
      return { source_name: 'Personal memory', source_url: '' };
    case 'secondhand':
      // Include "by X" if toldByName is set
      return {
        source_name: prov.toldByName
          ? `Told to me by ${prov.toldByName}`
          : 'Told to me',
        source_url: '',
      };
    case 'from_references':
      return {
        source_name: prov.referenceName || 'Record/document',
        source_url: prov.referenceUrl || '',
      };
    case 'pattern_observed':
      return { source_name: 'Pattern observed', source_url: '' };
    default:
      return { source_name: 'Personal memory', source_url: '' };
  }
}

/**
 * Returns the default provenance type for a given entry type
 */
export function getDefaultProvenanceForEntryType(entryType: EntryType): ProvenanceData {
  switch (entryType) {
    case 'origin':
      return { type: 'pattern_observed' };
    case 'milestone':
      return { type: 'from_references' };
    case 'memory':
    default:
      return { type: 'firsthand' };
  }
}
