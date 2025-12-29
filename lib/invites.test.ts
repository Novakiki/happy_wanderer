import { describe, it, expect } from 'vitest';
import {
  validatePersonReference,
  shouldCreateInvite,
  buildInviteData,
  buildSmsLink,
  getInvitableRefs,
  formatRelationshipContext,
} from './invites';
import { RELATIONSHIP_OPTIONS } from './terminology';

// =============================================================================
// Validation Tests
// =============================================================================

describe('validatePersonReference', () => {
  it('returns valid for complete reference', () => {
    const ref = { name: 'Julie', relationship: 'cousin' };
    const result = validatePersonReference(ref);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns error for missing name', () => {
    const ref = { relationship: 'cousin' };
    const result = validatePersonReference(ref);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Name is required');
  });

  it('returns error for empty name', () => {
    const ref = { name: '   ', relationship: 'cousin' };
    const result = validatePersonReference(ref);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Name is required');
  });

  it('returns error for missing relationship', () => {
    const ref = { name: 'Julie' };
    const result = validatePersonReference(ref);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Relationship is required');
  });

  it('returns error for empty relationship', () => {
    const ref = { name: 'Julie', relationship: '' };
    const result = validatePersonReference(ref);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Relationship is required');
  });

  it('returns multiple errors when both missing', () => {
    const ref = {};
    const result = validatePersonReference(ref);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

// =============================================================================
// Invite Creation Tests
// =============================================================================

describe('shouldCreateInvite', () => {
  it('returns true when phone is provided', () => {
    const ref = { name: 'Julie', relationship: 'cousin', phone: '8015551234' };
    expect(shouldCreateInvite(ref)).toBe(true);
  });

  it('returns false when phone is missing', () => {
    const ref = { name: 'Julie', relationship: 'cousin' };
    expect(shouldCreateInvite(ref)).toBe(false);
  });

  it('returns false when phone is empty string', () => {
    const ref = { name: 'Julie', relationship: 'cousin', phone: '' };
    expect(shouldCreateInvite(ref)).toBe(false);
  });

  it('returns false when phone is whitespace', () => {
    const ref = { name: 'Julie', relationship: 'cousin', phone: '   ' };
    expect(shouldCreateInvite(ref)).toBe(false);
  });
});

describe('buildInviteData', () => {
  it('builds SMS invite for phone number', () => {
    const ref = { name: 'Julie', relationship: 'cousin', phone: '8015551234' };
    const result = buildInviteData(ref, 'Sarah');

    expect(result).toEqual({
      recipient_name: 'Julie',
      recipient_contact: '8015551234',
      method: 'sms',
      message: 'Sarah shared a memory of Val that includes you. Want to add to it or share your version?',
    });
  });

  it('builds email invite for email address', () => {
    const ref = { name: 'Julie', relationship: 'cousin', phone: 'julie@example.com' };
    const result = buildInviteData(ref, 'Sarah');

    expect(result).toEqual({
      recipient_name: 'Julie',
      recipient_contact: 'julie@example.com',
      method: 'email',
      message: 'Sarah shared a memory of Val that includes you. Want to add to it or share your version?',
    });
  });

  it('returns null when no phone', () => {
    const ref = { name: 'Julie', relationship: 'cousin' };
    const result = buildInviteData(ref, 'Sarah');

    expect(result).toBeNull();
  });

  it('trims whitespace from name and contact', () => {
    const ref = { name: '  Julie  ', relationship: 'cousin', phone: '  8015551234  ' };
    const result = buildInviteData(ref, 'Sarah');

    expect(result?.recipient_name).toBe('Julie');
    expect(result?.recipient_contact).toBe('8015551234');
  });
});

describe('buildSmsLink', () => {
  it('builds correct SMS link', () => {
    const result = buildSmsLink(
      '8015551234',
      'Julie',
      'invite-123',
      'https://example.com'
    );

    expect(result).toContain('sms:8015551234');
    expect(result).toContain('body=');
    expect(result).toContain(encodeURIComponent('Hey Julie!'));
    expect(result).toContain(
      encodeURIComponent(
        'A memory of Val includes you. Want to add to it or share your version?'
      )
    );
    expect(result).toContain(encodeURIComponent('https://example.com/respond/invite-123'));
  });

  it('encodes special characters', () => {
    const result = buildSmsLink(
      '8015551234',
      "Julie O'Connor",
      'invite-123',
      'https://example.com'
    );

    // Should be URL encoded
    expect(result).toContain(encodeURIComponent("Julie O'Connor"));
  });
});

describe('getInvitableRefs', () => {
  it('filters to only refs with phones', () => {
    const refs = [
      { name: 'Julie', relationship: 'cousin', phone: '8015551234' },
      { name: 'John', relationship: 'friend' },
      { name: 'Jane', relationship: 'sibling', phone: '8015559999' },
    ];

    const result = getInvitableRefs(refs);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Julie');
    expect(result[1].name).toBe('Jane');
  });

  it('returns empty array when none have phones', () => {
    const refs = [
      { name: 'Julie', relationship: 'cousin' },
      { name: 'John', relationship: 'friend' },
    ];

    const result = getInvitableRefs(refs);

    expect(result).toEqual([]);
  });
});

// =============================================================================
// Relationship Display Tests
// =============================================================================

describe('formatRelationshipContext', () => {
  it('formats known relationship', () => {
    const result = formatRelationshipContext('cousin', RELATIONSHIP_OPTIONS);
    expect(result).toBe("as Val's cousin");
  });

  it('formats multi-word relationship', () => {
    const result = formatRelationshipContext('aunt_uncle', RELATIONSHIP_OPTIONS);
    expect(result).toBe("as Val's aunt/uncle");
  });

  it('returns null for unknown relationship', () => {
    const result = formatRelationshipContext('unknown', RELATIONSHIP_OPTIONS);
    expect(result).toBeNull();
  });

  it('returns null for empty relationship', () => {
    const result = formatRelationshipContext('', RELATIONSHIP_OPTIONS);
    expect(result).toBeNull();
  });

  it('returns null for null relationship', () => {
    const result = formatRelationshipContext(null, RELATIONSHIP_OPTIONS);
    expect(result).toBeNull();
  });

  it('returns null for undefined relationship', () => {
    const result = formatRelationshipContext(undefined, RELATIONSHIP_OPTIONS);
    expect(result).toBeNull();
  });

  it('returns null for unrecognized relationship key', () => {
    const result = formatRelationshipContext('made_up_relation', RELATIONSHIP_OPTIONS);
    expect(result).toBeNull();
  });
});
