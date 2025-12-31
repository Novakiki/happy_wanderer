import { describe, it, expect } from 'vitest';
import { redactReferences } from './references';

// =============================================================================
// Visibility Resolution Tests
// =============================================================================

describe('redactReferences', () => {
  describe('link references', () => {
    it('passes through approved link references', () => {
      const refs = [{
        id: 'link-1',
        type: 'link' as const,
        url: 'https://example.com',
        display_name: 'Example',
        visibility: 'approved' as const,
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].display_name).toBe('Example');
    });

    it('filters out removed link references', () => {
      const refs = [{
        id: 'link-1',
        type: 'link' as const,
        url: 'https://example.com',
        visibility: 'removed' as const,
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(0);
    });
  });

  describe('person references - visibility', () => {
    it('shows full name when approved', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].person_display_name).toBe('Julie Smith');
      expect(result[0].visibility).toBe('approved');
    });

    it('shows initials when blurred', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'blurred' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].person_display_name).toBe('J.S.');
      expect(result[0].visibility).toBe('blurred');
    });

    it('shows relationship when pending/anonymized', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'pending' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].person_display_name).toBe('a cousin');
      expect(result[0].visibility).toBe('pending');
    });

    it('shows "someone" when pending with unknown relationship', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'unknown',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'pending' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].person_display_name).toBe('someone');
    });

    it('filters out removed person references', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'removed' as const,
        person: {
          canonical_name: 'Julie Smith',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(0);
    });
  });

  describe('person references - visibility inheritance', () => {
    it('prefers per-note override over person default', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'blurred' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('approved');
      expect(result[0].person_display_name).toBe('Julie Smith');
    });

    it('removes reference when person is removed', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'removed' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(0);
    });
  });

  describe('relationship preservation', () => {
    it('preserves relationship_to_subject in output', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result[0].relationship_to_subject).toBe('cousin');
    });

    it('handles null relationship', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        relationship_to_subject: null,
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
      }];

      const result = redactReferences(refs);

      expect(result[0].relationship_to_subject).toBeNull();
    });
  });

  describe('visibility cascade resolution', () => {
    it('per-note override takes precedence over preferences (when no removal)', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'blurred' as const,
        },
        visibility_preference: {
          contributor_preference: 'anonymized',
          global_preference: 'blurred',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('approved');
      expect(result[0].person_display_name).toBe('Julie Smith');
    });

    it('contributor preference takes precedence over global preference', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'pending' as const,
        },
        visibility_preference: {
          contributor_preference: 'blurred',
          global_preference: 'approved',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('blurred');
      expect(result[0].person_display_name).toBe('J.S.');
    });

    it('global preference takes precedence over person default', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'pending' as const,
        },
        visibility_preference: {
          contributor_preference: null,
          global_preference: 'anonymized',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('anonymized');
      expect(result[0].person_display_name).toBe('a cousin');
    });

    it('falls back to person default when no preferences set', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'blurred' as const,
        },
        visibility_preference: {
          contributor_preference: null,
          global_preference: null,
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('blurred');
    });

    it('removed at person level removes reference regardless of other settings', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'removed' as const,
        },
        visibility_preference: {
          contributor_preference: 'approved',
          global_preference: 'approved',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(0);
    });

    it('removed at contributor preference level removes reference', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
        visibility_preference: {
          contributor_preference: 'removed',
          global_preference: 'approved',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(0);
    });

    it('removed at global preference level removes reference', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
        visibility_preference: {
          contributor_preference: null,
          global_preference: 'removed',
        },
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(0);
    });

    it('handles missing visibility_preference object', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'approved' as const,
        },
        // no visibility_preference
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('approved');
    });

    it('handles empty visibility_preference object', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'cousin',
        person: {
          canonical_name: 'Julie Smith',
          visibility: 'blurred' as const,
        },
        visibility_preference: {},
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('blurred');
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const result = redactReferences([]);
      expect(result).toEqual([]);
    });

    it('handles null/undefined input', () => {
      // @ts-expect-error - testing runtime behavior
      expect(redactReferences(null)).toEqual([]);
      // @ts-expect-error - testing runtime behavior
      expect(redactReferences(undefined)).toEqual([]);
    });

    it('handles missing person object with relationship', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: 'friend',
        person: null,
      }];

      const result = redactReferences(refs);

      expect(result).toHaveLength(1);
      // When pending with relationship, shows relationship label
      expect(result[0].person_display_name).toBe('a friend');
    });

    it('masks contributor name when person is null and pending', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'pending' as const,
        relationship_to_subject: null,
        person: null,
        contributor: {
          name: 'John Doe',
        },
      }];

      const result = redactReferences(refs);

      // When person is null, visibility defaults to pending for safety
      // With no relationship, shows 'someone'
      expect(result[0].person_display_name).toBe('someone');
      expect(result[0].visibility).toBe('pending');
    });
  });
});
