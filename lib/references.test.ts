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
          visibility: 'approved' as const,
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
          visibility: 'approved' as const,
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
    it('uses more restrictive visibility between reference and person', () => {
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
      expect(result[0].visibility).toBe('blurred');
      expect(result[0].person_display_name).toBe('J.S.');
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

    it('masks contributor name when person is null (defaults to pending)', () => {
      const refs = [{
        id: 'ref-1',
        type: 'person' as const,
        visibility: 'approved' as const,
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
