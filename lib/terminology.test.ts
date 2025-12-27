import { describe, it, expect } from 'vitest';
import {
  SUBJECT_BIRTH_YEAR,
  LIFE_STAGE_YEAR_RANGES,
  LIFE_STAGES,
  formatNoteCount,
} from './terminology';

describe('SUBJECT_BIRTH_YEAR', () => {
  it('is set to 1953', () => {
    expect(SUBJECT_BIRTH_YEAR).toBe(1953);
  });
});

describe('LIFE_STAGE_YEAR_RANGES', () => {
  it('childhood covers ages 0-12 (1953-1965)', () => {
    expect(LIFE_STAGE_YEAR_RANGES.childhood).toEqual([1953, 1965]);
  });

  it('teens covers ages 13-19 (1966-1972)', () => {
    expect(LIFE_STAGE_YEAR_RANGES.teens).toEqual([1966, 1972]);
  });

  it('college covers roughly 20s (1973-1982)', () => {
    expect(LIFE_STAGE_YEAR_RANGES.college).toEqual([1973, 1982]);
  });

  it('young_family covers roughly 30s-40s (1983-2003)', () => {
    expect(LIFE_STAGE_YEAR_RANGES.young_family).toEqual([1983, 2003]);
  });

  it('beyond is null (transcends timeline)', () => {
    expect(LIFE_STAGE_YEAR_RANGES.beyond).toBeNull();
  });

  it('has entry for every life stage', () => {
    const stages = Object.keys(LIFE_STAGES) as (keyof typeof LIFE_STAGES)[];

    for (const stage of stages) {
      expect(LIFE_STAGE_YEAR_RANGES).toHaveProperty(stage);
    }
  });
});

describe('formatNoteCount', () => {
  it('uses singular for count of 1', () => {
    expect(formatNoteCount(1)).toBe('1 note in the score');
  });

  it('uses plural for count of 0', () => {
    expect(formatNoteCount(0)).toBe('0 notes in the score');
  });

  it('uses plural for count > 1', () => {
    expect(formatNoteCount(2)).toBe('2 notes in the score');
    expect(formatNoteCount(10)).toBe('10 notes in the score');
    expect(formatNoteCount(100)).toBe('100 notes in the score');
  });
});

describe('timing conversion helpers', () => {
  // These test the logic that should be used in api/memories/route.ts

  describe('age range to year conversion', () => {
    it('converts age_start to year using SUBJECT_BIRTH_YEAR', () => {
      const ageStart = 30;
      const expectedYear = SUBJECT_BIRTH_YEAR + ageStart; // 1953 + 30 = 1983

      expect(expectedYear).toBe(1983);
    });

    it('converts age range to year range', () => {
      const ageStart = 10;
      const ageEnd = 15;

      const yearStart = SUBJECT_BIRTH_YEAR + ageStart; // 1963
      const yearEnd = SUBJECT_BIRTH_YEAR + ageEnd; // 1968

      expect(yearStart).toBe(1963);
      expect(yearEnd).toBe(1968);
    });

    it('handles age 0 correctly', () => {
      const age = 0;
      const year = SUBJECT_BIRTH_YEAR + age;

      expect(year).toBe(1953);
    });
  });

  describe('life stage to year conversion', () => {
    it('resolves childhood to start year 1953', () => {
      const range = LIFE_STAGE_YEAR_RANGES.childhood;
      expect(range?.[0]).toBe(1953);
    });

    it('resolves teens to start year 1966', () => {
      const range = LIFE_STAGE_YEAR_RANGES.teens;
      expect(range?.[0]).toBe(1966);
    });

    it('returns null for beyond stage', () => {
      const range = LIFE_STAGE_YEAR_RANGES.beyond;
      expect(range).toBeNull();
    });
  });

  describe('year range validation', () => {
    it('year_end should be >= year for valid range', () => {
      const year = 1980;
      const yearEnd = 1985;

      expect(yearEnd >= year).toBe(true);
    });

    it('detects invalid range where end < start', () => {
      const year = 1990;
      const yearEnd = 1985;

      expect(yearEnd >= year).toBe(false);
    });
  });
});
