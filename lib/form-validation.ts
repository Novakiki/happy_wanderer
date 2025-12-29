/**
 * Centralized form validation helpers.
 * Single source of truth for validation logic used across forms and APIs.
 */

/**
 * Year constraints - single source of truth for all year inputs.
 * Max is dynamically calculated to always be 5 years in the future.
 */
export const YEAR_CONSTRAINTS = {
  min: 1900,
  max: new Date().getFullYear() + 5,
} as const;

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type FieldValidationResult =
  | { valid: true }
  | { valid: false; field: string; error: string };

/**
 * Validate that a year is within acceptable bounds.
 */
export function validateYear(year: number | null | undefined): ValidationResult {
  if (year === null || year === undefined) {
    return { valid: true }; // Null is valid (optional year)
  }
  if (year < YEAR_CONSTRAINTS.min) {
    return { valid: false, error: `Year must be ${YEAR_CONSTRAINTS.min} or later` };
  }
  if (year > YEAR_CONSTRAINTS.max) {
    return { valid: false, error: `Year must be ${YEAR_CONSTRAINTS.max} or earlier` };
  }
  return { valid: true };
}

/**
 * Validate that a year range is valid (end >= start).
 * Used in: MemoryForm, EditNotesClient, API routes.
 */
export function validateYearRange(
  year: number | null | undefined,
  yearEnd: number | null | undefined
): ValidationResult {
  if (year === null || year === undefined || yearEnd === null || yearEnd === undefined) {
    return { valid: true }; // Null values are valid (single year or optional)
  }
  if (yearEnd < year) {
    return {
      valid: false,
      error: 'End year must be the same or later than the start year',
    };
  }
  return { valid: true };
}

/**
 * Validate that an age range is valid (end >= start).
 * Used in: memories.ts validation
 */
export function validateAgeRange(
  ageStart: number | null | undefined,
  ageEnd: number | null | undefined
): ValidationResult {
  if (ageStart === null || ageStart === undefined || ageEnd === null || ageEnd === undefined) {
    return { valid: true };
  }
  if (ageEnd < ageStart) {
    return {
      valid: false,
      error: 'Age range end must be the same or older than the start age',
    };
  }
  return { valid: true };
}

/**
 * Validate that a required string field is not empty.
 */
export function validateRequired(
  value: string | null | undefined,
  fieldName: string
): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

/**
 * Parse a string to a number, returning null for empty/invalid.
 * Useful for form inputs that store years as strings.
 */
export function parseYear(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Extract year from ISO date string (YYYY-MM-DD).
 * Used when converting exact dates to years.
 */
export function parseYearFromDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 1) return null;
  const year = parseInt(parts[0], 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Format a year range for display.
 * Returns "1990" for single year, "1990–1995" for range.
 */
export function formatYearRange(year: number, yearEnd?: number | null): string {
  if (yearEnd && yearEnd !== year) {
    return `${year}–${yearEnd}`;
  }
  return String(year);
}

/**
 * Validate timing input and return parsed values.
 * Combines multiple validation checks into a single call.
 */
export function validateTiming(input: {
  timingMode: 'exact' | 'year' | 'chapter' | null;
  exactDate?: string;
  year?: string | number;
  yearEnd?: string | number;
  lifeStage?: string;
}): FieldValidationResult & { year?: number; yearEnd?: number | null } {
  const { timingMode, exactDate, year: yearInput, yearEnd: yearEndInput } = input;

  if (timingMode === 'exact') {
    if (!exactDate) {
      return { valid: false, field: 'exact_date', error: 'Please enter an exact date' };
    }
    const year = parseYearFromDate(exactDate);
    if (!year) {
      return { valid: false, field: 'exact_date', error: 'Invalid date format' };
    }
    return { valid: true, year };
  }

  if (timingMode === 'year') {
    const year = parseYear(yearInput);
    if (!year) {
      return { valid: false, field: 'year', error: 'Please enter a year' };
    }
    const yearValidation = validateYear(year);
    if (!yearValidation.valid) {
      return { valid: false, field: 'year', error: yearValidation.error };
    }
    const yearEnd = parseYear(yearEndInput);
    const rangeValidation = validateYearRange(year, yearEnd);
    if (!rangeValidation.valid) {
      return { valid: false, field: 'year_end', error: rangeValidation.error };
    }
    return { valid: true, year, yearEnd };
  }

  if (timingMode === 'chapter') {
    if (!input.lifeStage) {
      return { valid: false, field: 'life_stage', error: 'Please select a chapter of her life' };
    }
    return { valid: true };
  }

  return { valid: false, field: 'timing', error: 'Please provide timing information' };
}
