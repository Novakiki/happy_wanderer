import { describe, it, expect } from 'vitest';
import {
  normalizeVisibility,
  isMorePrivateOrEqual,
  resolveVisibility,
  canRevealIdentity,
  shapePersonPayload,
  PRIVACY_RANK,
} from './resolve-visibility';

describe('normalizeVisibility', () => {
  it('returns valid visibility values unchanged', () => {
    expect(normalizeVisibility('approved')).toBe('approved');
    expect(normalizeVisibility('blurred')).toBe('blurred');
    expect(normalizeVisibility('anonymized')).toBe('anonymized');
    expect(normalizeVisibility('removed')).toBe('removed');
    expect(normalizeVisibility('pending')).toBe('pending');
  });

  it('returns pending for null/undefined/invalid values', () => {
    expect(normalizeVisibility(null)).toBe('pending');
    expect(normalizeVisibility(undefined)).toBe('pending');
    expect(normalizeVisibility('')).toBe('pending');
    expect(normalizeVisibility('invalid')).toBe('pending');
  });
});

describe('isMorePrivateOrEqual', () => {
  it('correctly ranks approved as least private', () => {
    expect(isMorePrivateOrEqual('approved', 'approved')).toBe(true);
    expect(isMorePrivateOrEqual('blurred', 'approved')).toBe(true);
    expect(isMorePrivateOrEqual('anonymized', 'approved')).toBe(true);
    expect(isMorePrivateOrEqual('removed', 'approved')).toBe(true);
  });

  it('correctly ranks removed as most private', () => {
    expect(isMorePrivateOrEqual('approved', 'removed')).toBe(false);
    expect(isMorePrivateOrEqual('blurred', 'removed')).toBe(false);
    expect(isMorePrivateOrEqual('anonymized', 'removed')).toBe(false);
    expect(isMorePrivateOrEqual('removed', 'removed')).toBe(true);
  });

  it('treats blurred, anonymized, pending as equivalent privacy level', () => {
    expect(PRIVACY_RANK.blurred).toBe(PRIVACY_RANK.anonymized);
    expect(PRIVACY_RANK.blurred).toBe(PRIVACY_RANK.pending);
  });
});

describe('resolveVisibility - precedence chain', () => {
  it('per-note override wins when not pending', () => {
    expect(resolveVisibility('approved', 'anonymized', 'blurred', 'removed')).toBe('removed');
    // Note: removed dominates, so let's test without removed
    expect(resolveVisibility('approved', 'anonymized', 'blurred', 'pending')).toBe('approved');
    expect(resolveVisibility('blurred', 'anonymized', 'approved', 'pending')).toBe('blurred');
  });

  it('per-author preference wins when per-note is pending', () => {
    expect(resolveVisibility('pending', 'anonymized', 'blurred', 'pending')).toBe('blurred');
    expect(resolveVisibility('pending', 'anonymized', 'approved', 'pending')).toBe('approved');
  });

  it('global preference wins when per-note and per-author are pending', () => {
    expect(resolveVisibility('pending', 'anonymized', 'pending', 'approved')).toBe('approved');
    expect(resolveVisibility('pending', 'anonymized', 'pending', 'blurred')).toBe('blurred');
  });

  it('falls back to person visibility when all preferences are pending', () => {
    expect(resolveVisibility('pending', 'approved', 'pending', 'pending')).toBe('approved');
    expect(resolveVisibility('pending', 'anonymized', 'pending', 'pending')).toBe('anonymized');
    expect(resolveVisibility('pending', 'blurred', 'pending', 'pending')).toBe('blurred');
  });

  it('handles null/undefined inputs gracefully', () => {
    expect(resolveVisibility(null, null, null, null)).toBe('pending');
    expect(resolveVisibility(undefined, 'approved', undefined, undefined)).toBe('approved');
  });
});

describe('resolveVisibility - removed dominates', () => {
  /**
   * BREAKGLASS TEST: "removed" should always win, regardless of other settings.
   * This prevents accidental identity revelation when a person has opted out.
   */

  it('removed in person visibility dominates everything', () => {
    expect(resolveVisibility('approved', 'removed', 'approved', 'approved')).toBe('removed');
  });

  it('removed in contributor preference dominates everything', () => {
    expect(resolveVisibility('approved', 'approved', 'removed', 'approved')).toBe('removed');
  });

  it('removed in global preference dominates everything', () => {
    expect(resolveVisibility('approved', 'approved', 'approved', 'removed')).toBe('removed');
  });

  it('removed dominates even when per-note is approved', () => {
    // This is the critical breakglass test
    // Even if someone sets per-note visibility to "approved",
    // if global or contributor pref is "removed", it should still be removed
    expect(resolveVisibility('approved', 'pending', 'pending', 'removed')).toBe('removed');
    expect(resolveVisibility('approved', 'pending', 'removed', 'pending')).toBe('removed');
  });
});

describe('canRevealIdentity', () => {
  it('returns false when no claim exists', () => {
    expect(canRevealIdentity(false, 'approved')).toBe(false);
    expect(canRevealIdentity(false, 'blurred')).toBe(false);
    expect(canRevealIdentity(false, 'anonymized')).toBe(false);
  });

  it('returns false when visibility is removed', () => {
    expect(canRevealIdentity(true, 'removed')).toBe(false);
  });

  it('returns false when visibility is pending', () => {
    expect(canRevealIdentity(true, 'pending')).toBe(false);
  });

  it('returns true when claim exists and visibility allows', () => {
    expect(canRevealIdentity(true, 'approved')).toBe(true);
    expect(canRevealIdentity(true, 'blurred')).toBe(true);
    expect(canRevealIdentity(true, 'anonymized')).toBe(true);
  });
});

describe('shapePersonPayload - privacy protection', () => {
  /**
   * BREAKGLASS TEST: Unclaimed person never leaks canonical name.
   * Even if preferences exist that would otherwise show them as "approved",
   * no claim = no person payload.
   */

  it('returns null when no claim exists (unclaimed person never leaks)', () => {
    const result = shapePersonPayload({
      claimExists: false,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: 'approved', // Even if prefs say approved!
    });

    expect(result).toBeNull();
  });

  it('returns null when visibility is removed', () => {
    const result = shapePersonPayload({
      claimExists: true,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: 'removed',
    });

    expect(result).toBeNull();
  });

  it('only includes canonical name when visibility is approved', () => {
    const approved = shapePersonPayload({
      claimExists: true,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: 'approved',
    });

    expect(approved).toEqual({
      id: 'test-id',
      name: 'Real Name',
      visibility: 'approved',
    });
  });

  it('excludes canonical name for non-approved visibility', () => {
    const blurred = shapePersonPayload({
      claimExists: true,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: 'blurred',
    });

    expect(blurred).toEqual({
      id: 'test-id',
      name: null, // Name not revealed
      visibility: 'blurred',
    });

    const anonymized = shapePersonPayload({
      claimExists: true,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: 'anonymized',
    });

    expect(anonymized).toEqual({
      id: 'test-id',
      name: null, // Name not revealed
      visibility: 'anonymized',
    });
  });

  it('handles null canonical name gracefully', () => {
    const result = shapePersonPayload({
      claimExists: true,
      personId: 'test-id',
      canonicalName: null,
      resolvedVisibility: 'approved',
    });

    expect(result).toEqual({
      id: 'test-id',
      name: null,
      visibility: 'approved',
    });
  });
});

describe('integration scenarios', () => {
  /**
   * These tests combine resolution + payload shaping to verify
   * end-to-end privacy protection.
   */

  it('unclaimed person with approved prefs still returns null payload', () => {
    // Setup: preferences exist that would show "approved"
    const visibility = resolveVisibility('approved', 'approved', 'approved', 'approved');
    expect(visibility).toBe('approved');

    // But no claim = no payload
    const payload = shapePersonPayload({
      claimExists: false,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: visibility,
    });

    expect(payload).toBeNull();
  });

  it('removed at any level prevents name reveal', () => {
    // Per-note says approved, but global says removed
    const visibility = resolveVisibility('approved', 'pending', 'pending', 'removed');
    expect(visibility).toBe('removed');

    const payload = shapePersonPayload({
      claimExists: true,
      personId: 'test-id',
      canonicalName: 'Real Name',
      resolvedVisibility: visibility,
    });

    expect(payload).toBeNull();
  });
});
