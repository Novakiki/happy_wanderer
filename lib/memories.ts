/**
 * Pure business logic for memory submission.
 * Extracted for testability - no database or HTTP dependencies.
 */

import { validateYearRange, validateAgeRange } from './form-validation';
import { hasContent, generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from './html-utils';
import { LIFE_STAGE_YEAR_RANGES, SUBJECT_BIRTH_YEAR } from './terminology';

// =============================================================================
// Types
// =============================================================================

export type TimingCertainty = 'exact' | 'approximate' | 'vague';
export type TimingInputType = 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage';
export type PrivacyLevel = 'public' | 'family';
export type EventType = 'origin' | 'milestone' | 'memory';
export type LifeStage = 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond';
export type WitnessType = 'direct' | 'secondhand' | 'mixed' | 'unsure';
export type Recurrence = 'one_time' | 'repeated' | 'ongoing';

export type MemoryInput = {
  content?: string;
  title?: string;
  why_included?: string;
  source_name?: string;
  year?: string | number;
  year_end?: string | number;
  age_start?: string | number;
  age_end?: string | number;
  life_stage?: string;
  timing_certainty?: string;
  timing_input_type?: string;
  privacy_level?: string;
  entry_type?: string;
};

export type ValidationError = {
  field: string;
  message: string;
};

export type ResolvedTiming = {
  year: number;
  yearEnd: number | null;
  ageStart: number | null;
  ageEnd: number | null;
  lifeStage: LifeStage | null;
  timingCertainty: TimingCertainty;
  timingInputType: TimingInputType;
};

export type ChainInfo = {
  rootEventId: string | null;
  chainDepth: number;
};

export type ParentEventInfo = {
  id: string;
  root_event_id: string | null;
  chain_depth: number | null;
};

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate required fields for memory submission.
 * Returns array of validation errors (empty if valid).
 */
export function validateMemoryInput(input: MemoryInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Use hasContent for HTML-aware validation (handles <p></p>, &nbsp;, etc.)
  if (!input.content || !hasContent(input.content)) {
    errors.push({ field: 'content', message: 'Note content is required' });
  }

  if (!input.title?.trim()) {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  // why_included is optional - it appears as a quote on the timeline if provided

  if (!input.source_name || !String(input.source_name).trim()) {
    errors.push({
      field: 'source_name',
      message: 'Every note needs a source name (use "Personal memory" if it is yours)',
    });
  }

  return errors;
}

// =============================================================================
// Normalization
// =============================================================================

/**
 * Normalize timing certainty to valid enum value.
 * Defaults to 'approximate' for invalid/missing values.
 */
export function normalizeTimingCertainty(value?: string): TimingCertainty {
  if (value === 'exact' || value === 'approximate' || value === 'vague') {
    return value;
  }
  return 'approximate';
}

/**
 * Normalize timing input type to valid enum value.
 * Defaults to 'year' for invalid/missing values.
 */
export function normalizeTimingInputType(value?: string): TimingInputType {
  if (
    value === 'date' ||
    value === 'year' ||
    value === 'year_range' ||
    value === 'age_range' ||
    value === 'life_stage'
  ) {
    return value;
  }
  return 'year';
}

/**
 * Normalize privacy level to valid enum value.
 * Defaults to 'family' for invalid/missing values.
 */
export function normalizePrivacyLevel(value?: string): PrivacyLevel {
  if (value === 'public' || value === 'family') {
    return value;
  }
  // Collapse any legacy values to family by default.
  return 'family';
}

/**
 * Normalize witness type to valid enum value.
 * Defaults to 'direct' for invalid/missing values.
 */
export function normalizeWitnessType(value?: string): WitnessType {
  if (value === 'direct' || value === 'secondhand' || value === 'mixed' || value === 'unsure') {
    return value;
  }
  return 'direct';
}

/**
 * Normalize recurrence to valid enum value.
 * Defaults to 'one_time' for invalid/missing values.
 */
export function normalizeRecurrence(value?: string): Recurrence {
  if (value === 'one_time' || value === 'repeated' || value === 'ongoing') {
    return value;
  }
  return 'one_time';
}

/**
 * Normalize life stage to valid enum value or null.
 */
export function normalizeLifeStage(value?: string): LifeStage | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (
    trimmed === 'childhood' ||
    trimmed === 'teens' ||
    trimmed === 'college' ||
    trimmed === 'young_family' ||
    trimmed === 'beyond'
  ) {
    return trimmed;
  }
  return null;
}

/**
 * Convert entry_type from form to database event type.
 */
export function normalizeEntryType(entryType?: string): EventType {
  const normalized = (entryType || '').trim().toLowerCase();
  if (normalized === 'origin' || normalized === 'synchronicity') return 'origin';
  if (normalized === 'milestone') return 'milestone';
  if (normalized === 'memory') return 'memory';
  return 'memory';
}

// =============================================================================
// Timing Resolution
// =============================================================================

/**
 * Parse a year value from string or number input.
 * Returns null for invalid/missing values.
 */
export function parseYear(value?: string | number): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Get year range for a life stage.
 * Returns null for 'beyond' or invalid stages.
 */
export function getLifeStageYearRange(stage: LifeStage | null): [number, number] | null {
  if (!stage) return null;
  return LIFE_STAGE_YEAR_RANGES[stage] ?? null;
}

/**
 * Convert age to year using subject's birth year.
 */
export function ageToYear(age: number): number {
  return SUBJECT_BIRTH_YEAR + age;
}

/**
 * Resolve timing input to concrete year values.
 * Handles year, year_range, age_range, and life_stage inputs.
 *
 * Returns resolved timing or validation error.
 */
export function resolveTiming(input: {
  year?: string | number;
  yearEnd?: string | number;
  ageStart?: string | number;
  ageEnd?: string | number;
  lifeStage?: string;
  timingCertainty?: string;
  timingInputType?: string;
}): { success: true; data: ResolvedTiming } | { success: false; error: ValidationError } {
  const timingInputType = normalizeTimingInputType(input.timingInputType);
  const timingCertainty = normalizeTimingCertainty(input.timingCertainty);
  const lifeStage = normalizeLifeStage(input.lifeStage);

  let year = parseYear(input.year);
  let yearEnd = parseYear(input.yearEnd);
  const ageStart = parseYear(input.ageStart);
  const ageEnd = parseYear(input.ageEnd);

  // Validate year range
  if (timingInputType === 'year_range') {
    const yearRangeResult = validateYearRange(year, yearEnd);
    if (!yearRangeResult.valid) {
      return {
        success: false,
        error: { field: 'year_end', message: yearRangeResult.error },
      };
    }
  }

  // Validate age range
  const ageRangeResult = validateAgeRange(ageStart, ageEnd);
  if (!ageRangeResult.valid) {
    return {
      success: false,
      error: { field: 'age_end', message: ageRangeResult.error },
    };
  }

  // Convert age_range to years
  if (!year && timingInputType === 'age_range' && ageStart !== null) {
    year = ageToYear(ageStart);
    if (!yearEnd && ageEnd !== null) {
      yearEnd = ageToYear(ageEnd);
    }
  }

  // Convert life_stage to years
  if (!year && timingInputType === 'life_stage') {
    const range = getLifeStageYearRange(lifeStage);
    if (range) {
      year = range[0];
      if (!yearEnd) {
        yearEnd = range[1];
      }
    }
  }

  // Final validation: must have a year
  if (year === null) {
    return {
      success: false,
      error: {
        field: 'year',
        message: 'A valid year or timing range is required',
      },
    };
  }

  return {
    success: true,
    data: {
      year,
      yearEnd,
      ageStart,
      ageEnd,
      lifeStage,
      timingCertainty,
      timingInputType,
    },
  };
}

// =============================================================================
// Content Processing
// =============================================================================

/**
 * Generate preview text from content.
 * Strips HTML tags and truncates to 160 characters with ellipsis if needed.
 */
export function generatePreview(content: string): string {
  return generatePreviewFromHtml(content, PREVIEW_MAX_LENGTH);
}

// =============================================================================
// Story Chains
// =============================================================================

/**
 * Compute chain info for a new event based on parent event.
 * If no parent, returns null rootEventId (caller should set to self after insert).
 */
export function computeChainInfo(parentEvent: ParentEventInfo | null): ChainInfo {
  if (!parentEvent) {
    return {
      rootEventId: null,
      chainDepth: 0,
    };
  }

  return {
    rootEventId: parentEvent.root_event_id || parentEvent.id,
    chainDepth: (parentEvent.chain_depth ?? 0) + 1,
  };
}
