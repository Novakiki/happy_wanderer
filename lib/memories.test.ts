import { describe, it, expect } from 'vitest';
import {
  validateMemoryInput,
  normalizeTimingCertainty,
  normalizeTimingInputType,
  normalizePrivacyLevel,
  normalizeLifeStage,
  normalizeEntryType,
  parseYear,
  getLifeStageYearRange,
  ageToYear,
  resolveTiming,
  generatePreview,
  computeChainInfo,
} from './memories';
import { SUBJECT_BIRTH_YEAR } from './terminology';

// =============================================================================
// Validation Tests
// =============================================================================

describe('validateMemoryInput', () => {
  it('returns no errors for valid input', () => {
    const input = {
      content: 'A great memory',
      title: 'Summer of 1985',
      why_included: 'This shaped who she became',
      source_name: 'Personal memory',
    };

    const errors = validateMemoryInput(input);

    expect(errors).toEqual([]);
  });

  it('returns error for missing content', () => {
    const input = {
      title: 'Test',
      why_included: 'Reason',
      source_name: 'Personal memory',
    };

    const errors = validateMemoryInput(input);

    expect(errors).toContainEqual({
      field: 'content',
      message: 'Note content is required',
    });
  });

  it('returns error for whitespace-only content', () => {
    const input = {
      content: '   ',
      title: 'Test',
      why_included: 'Reason',
      source_name: 'Personal memory',
    };

    const errors = validateMemoryInput(input);

    expect(errors).toContainEqual({
      field: 'content',
      message: 'Note content is required',
    });
  });

  it('returns error for missing title', () => {
    const input = {
      content: 'Content here',
      why_included: 'Reason',
      source_name: 'Personal memory',
    };

    const errors = validateMemoryInput(input);

    expect(errors).toContainEqual({
      field: 'title',
      message: 'Title is required',
    });
  });

  it('allows missing why_included (optional field)', () => {
    const input = {
      content: 'Content',
      title: 'Title',
      source_name: 'Personal memory',
    };

    const errors = validateMemoryInput(input);

    expect(errors).toEqual([]);
  });

  it('returns multiple errors when multiple fields missing', () => {
    const input = {};

    const errors = validateMemoryInput(input);

    expect(errors).toHaveLength(3);
    expect(errors.map(e => e.field)).toContain('content');
    expect(errors.map(e => e.field)).toContain('title');
    expect(errors.map(e => e.field)).toContain('source_name');
  });
});

// =============================================================================
// Normalization Tests
// =============================================================================

describe('normalizeTimingCertainty', () => {
  it('returns exact for "exact"', () => {
    expect(normalizeTimingCertainty('exact')).toBe('exact');
  });

  it('returns approximate for "approximate"', () => {
    expect(normalizeTimingCertainty('approximate')).toBe('approximate');
  });

  it('returns vague for "vague"', () => {
    expect(normalizeTimingCertainty('vague')).toBe('vague');
  });

  it('defaults to approximate for invalid value', () => {
    expect(normalizeTimingCertainty('invalid')).toBe('approximate');
  });

  it('defaults to approximate for undefined', () => {
    expect(normalizeTimingCertainty(undefined)).toBe('approximate');
  });

  it('defaults to approximate for empty string', () => {
    expect(normalizeTimingCertainty('')).toBe('approximate');
  });
});

describe('normalizeTimingInputType', () => {
  it('returns date for "date"', () => {
    expect(normalizeTimingInputType('date')).toBe('date');
  });

  it('returns year for "year"', () => {
    expect(normalizeTimingInputType('year')).toBe('year');
  });

  it('returns year_range for "year_range"', () => {
    expect(normalizeTimingInputType('year_range')).toBe('year_range');
  });

  it('returns age_range for "age_range"', () => {
    expect(normalizeTimingInputType('age_range')).toBe('age_range');
  });

  it('returns life_stage for "life_stage"', () => {
    expect(normalizeTimingInputType('life_stage')).toBe('life_stage');
  });

  it('defaults to year for invalid value', () => {
    expect(normalizeTimingInputType('invalid')).toBe('year');
  });

  it('defaults to year for undefined', () => {
    expect(normalizeTimingInputType(undefined)).toBe('year');
  });
});

describe('normalizePrivacyLevel', () => {
  it('returns public for "public"', () => {
    expect(normalizePrivacyLevel('public')).toBe('public');
  });

  it('returns family for "family"', () => {
    expect(normalizePrivacyLevel('family')).toBe('family');
  });

  it('returns kids-only for "kids-only"', () => {
    expect(normalizePrivacyLevel('kids-only')).toBe('kids-only');
  });

  it('defaults to family for invalid value', () => {
    expect(normalizePrivacyLevel('invalid')).toBe('family');
  });

  it('defaults to family for undefined', () => {
    expect(normalizePrivacyLevel(undefined)).toBe('family');
  });
});

describe('normalizeLifeStage', () => {
  it('returns childhood for "childhood"', () => {
    expect(normalizeLifeStage('childhood')).toBe('childhood');
  });

  it('returns teens for "teens"', () => {
    expect(normalizeLifeStage('teens')).toBe('teens');
  });

  it('returns college for "college"', () => {
    expect(normalizeLifeStage('college')).toBe('college');
  });

  it('returns young_family for "young_family"', () => {
    expect(normalizeLifeStage('young_family')).toBe('young_family');
  });

  it('returns beyond for "beyond"', () => {
    expect(normalizeLifeStage('beyond')).toBe('beyond');
  });

  it('returns null for invalid value', () => {
    expect(normalizeLifeStage('invalid')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeLifeStage(undefined)).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeLifeStage('  childhood  ')).toBe('childhood');
  });
});

describe('normalizeEntryType', () => {
  it('converts synchronicity to origin', () => {
    expect(normalizeEntryType('synchronicity')).toBe('origin');
  });

  it('defaults to memory for other values', () => {
    expect(normalizeEntryType('memory')).toBe('memory');
    expect(normalizeEntryType('note')).toBe('memory');
    expect(normalizeEntryType(undefined)).toBe('memory');
  });
});

// =============================================================================
// Timing Resolution Tests
// =============================================================================

describe('parseYear', () => {
  it('parses valid integer string', () => {
    expect(parseYear('1985')).toBe(1985);
  });

  it('parses number input', () => {
    expect(parseYear(1985)).toBe(1985);
  });

  it('returns null for empty string', () => {
    expect(parseYear('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseYear(undefined)).toBeNull();
  });

  it('returns null for NaN-producing string', () => {
    expect(parseYear('not-a-number')).toBeNull();
  });

  it('truncates decimal numbers', () => {
    expect(parseYear('1985.7')).toBe(1985);
  });
});

describe('getLifeStageYearRange', () => {
  it('returns correct range for childhood', () => {
    expect(getLifeStageYearRange('childhood')).toEqual([1953, 1965]);
  });

  it('returns correct range for teens', () => {
    expect(getLifeStageYearRange('teens')).toEqual([1966, 1972]);
  });

  it('returns correct range for college', () => {
    expect(getLifeStageYearRange('college')).toEqual([1973, 1982]);
  });

  it('returns correct range for young_family', () => {
    expect(getLifeStageYearRange('young_family')).toEqual([1983, 2003]);
  });

  it('returns null for beyond', () => {
    expect(getLifeStageYearRange('beyond')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getLifeStageYearRange(null)).toBeNull();
  });
});

describe('ageToYear', () => {
  it('converts age 0 to birth year', () => {
    expect(ageToYear(0)).toBe(SUBJECT_BIRTH_YEAR);
  });

  it('converts age to correct year', () => {
    expect(ageToYear(10)).toBe(SUBJECT_BIRTH_YEAR + 10);
    expect(ageToYear(30)).toBe(SUBJECT_BIRTH_YEAR + 30);
  });

  it('uses correct birth year (1953)', () => {
    expect(ageToYear(20)).toBe(1973);
  });
});

describe('resolveTiming', () => {
  describe('with direct year input', () => {
    it('accepts valid year', () => {
      const result = resolveTiming({ year: 1985 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1985);
      }
    });

    it('accepts year as string', () => {
      const result = resolveTiming({ year: '1985' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1985);
      }
    });

    it('fails when year is missing', () => {
      const result = resolveTiming({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe('year');
      }
    });
  });

  describe('with year_range input', () => {
    it('accepts valid year range', () => {
      const result = resolveTiming({
        year: 1980,
        yearEnd: 1985,
        timingInputType: 'year_range',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1980);
        expect(result.data.yearEnd).toBe(1985);
      }
    });

    it('fails when yearEnd < year', () => {
      const result = resolveTiming({
        year: 1990,
        yearEnd: 1985,
        timingInputType: 'year_range',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe('year_end');
        expect(result.error.message).toContain('later');
      }
    });

    it('allows equal year and yearEnd', () => {
      const result = resolveTiming({
        year: 1985,
        yearEnd: 1985,
        timingInputType: 'year_range',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('with age_range input', () => {
    it('converts age range to years', () => {
      const result = resolveTiming({
        ageStart: 10,
        ageEnd: 15,
        timingInputType: 'age_range',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1963); // 1953 + 10
        expect(result.data.yearEnd).toBe(1968); // 1953 + 15
        expect(result.data.ageStart).toBe(10);
        expect(result.data.ageEnd).toBe(15);
      }
    });

    it('fails when ageEnd < ageStart', () => {
      const result = resolveTiming({
        ageStart: 20,
        ageEnd: 15,
        timingInputType: 'age_range',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe('age_end');
      }
    });

    it('handles single age (start only)', () => {
      const result = resolveTiming({
        ageStart: 25,
        timingInputType: 'age_range',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1978); // 1953 + 25
        expect(result.data.yearEnd).toBeNull();
      }
    });

    it('prefers explicit year over age conversion', () => {
      const result = resolveTiming({
        year: 2000,
        ageStart: 10,
        timingInputType: 'age_range',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2000); // Uses explicit year
      }
    });
  });

  describe('with life_stage input', () => {
    it('converts childhood to year range', () => {
      const result = resolveTiming({
        lifeStage: 'childhood',
        timingInputType: 'life_stage',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1953);
        expect(result.data.yearEnd).toBe(1965);
        expect(result.data.lifeStage).toBe('childhood');
      }
    });

    it('converts teens to year range', () => {
      const result = resolveTiming({
        lifeStage: 'teens',
        timingInputType: 'life_stage',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(1966);
        expect(result.data.yearEnd).toBe(1972);
      }
    });

    it('handles beyond (no year range)', () => {
      const result = resolveTiming({
        lifeStage: 'beyond',
        timingInputType: 'life_stage',
      });

      // beyond has no year range, so this should fail
      expect(result.success).toBe(false);
    });

    it('prefers explicit year over life stage', () => {
      const result = resolveTiming({
        year: 2000,
        lifeStage: 'childhood',
        timingInputType: 'life_stage',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2000);
      }
    });
  });

  describe('timing certainty normalization', () => {
    it('normalizes timing certainty', () => {
      const result = resolveTiming({
        year: 1985,
        timingCertainty: 'vague',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timingCertainty).toBe('vague');
      }
    });

    it('defaults timing certainty to approximate', () => {
      const result = resolveTiming({ year: 1985 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timingCertainty).toBe('approximate');
      }
    });
  });
});

// =============================================================================
// Content Processing Tests
// =============================================================================

describe('generatePreview', () => {
  it('returns content unchanged if <= 160 chars', () => {
    const content = 'A short memory.';

    expect(generatePreview(content)).toBe('A short memory.');
  });

  it('returns exactly 160 chars unchanged', () => {
    const content = 'x'.repeat(160);

    expect(generatePreview(content)).toBe(content);
  });

  it('truncates to 160 chars with ellipsis for longer content', () => {
    const content = 'x'.repeat(200);

    const preview = generatePreview(content);

    expect(preview).toHaveLength(163); // 160 + "..."
    expect(preview.endsWith('...')).toBe(true);
  });

  it('trims trailing whitespace before adding ellipsis', () => {
    const content = 'x'.repeat(155) + '     ' + 'y'.repeat(50);

    const preview = generatePreview(content);

    // Should not have trailing spaces before ...
    expect(preview).not.toMatch(/\s\.\.\.$/);
    expect(preview.endsWith('...')).toBe(true);
  });

  it('trims leading/trailing whitespace from input', () => {
    const content = '   Short content   ';

    expect(generatePreview(content)).toBe('Short content');
  });
});

// =============================================================================
// Story Chain Tests
// =============================================================================

describe('computeChainInfo', () => {
  it('returns null rootEventId and depth 0 for no parent', () => {
    const result = computeChainInfo(null);

    expect(result.rootEventId).toBeNull();
    expect(result.chainDepth).toBe(0);
  });

  it('uses parent id as root when parent has no root_event_id', () => {
    const parent = {
      id: 'parent-123',
      root_event_id: null,
      chain_depth: 0,
    };

    const result = computeChainInfo(parent);

    expect(result.rootEventId).toBe('parent-123');
    expect(result.chainDepth).toBe(1);
  });

  it('inherits root_event_id from parent', () => {
    const parent = {
      id: 'parent-123',
      root_event_id: 'original-root',
      chain_depth: 2,
    };

    const result = computeChainInfo(parent);

    expect(result.rootEventId).toBe('original-root');
    expect(result.chainDepth).toBe(3);
  });

  it('handles null chain_depth in parent', () => {
    const parent = {
      id: 'parent-123',
      root_event_id: 'root',
      chain_depth: null,
    };

    const result = computeChainInfo(parent);

    expect(result.chainDepth).toBe(1); // null treated as 0, then +1
  });

  it('increments chain depth correctly through multiple levels', () => {
    // Simulate: root -> child1 -> child2
    const root = { id: 'root', root_event_id: null, chain_depth: 0 };
    const child1Info = computeChainInfo(root);

    const child1 = {
      id: 'child1',
      root_event_id: child1Info.rootEventId,
      chain_depth: child1Info.chainDepth,
    };
    const child2Info = computeChainInfo(child1);

    expect(child1Info.rootEventId).toBe('root');
    expect(child1Info.chainDepth).toBe(1);
    expect(child2Info.rootEventId).toBe('root');
    expect(child2Info.chainDepth).toBe(2);
  });
});
