/**
 * Visibility resolution logic for identity protection.
 *
 * This module centralizes the precedence rules for determining how a person's
 * identity should be displayed. All endpoints that need visibility resolution
 * should use these functions to ensure consistent behavior.
 *
 * Precedence order (highest to lowest):
 *   1. Per-note override (event_references.visibility)
 *   2. Per-author preference (visibility_preferences with contributor_id)
 *   3. Global default (visibility_preferences with contributor_id = null)
 *   4. Person's base visibility (people.visibility)
 *
 * Special rules:
 *   - 'removed' dominates: if any level is 'removed', the result is 'removed'
 *   - 'pending' means "defer to next level" (no override at this level)
 */

export type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed' | 'pending';

const ALLOWED_VISIBILITY = new Set<Visibility>([
  'approved',
  'blurred',
  'anonymized',
  'removed',
  'pending',
]);

/**
 * Privacy ranking for visibility values.
 * Higher rank = more private. Used for enforcing "can only make more private" rules.
 */
export const PRIVACY_RANK: Record<Visibility, number> = {
  approved: 0,
  blurred: 1,
  anonymized: 1,
  pending: 1,
  removed: 2,
};

/**
 * Normalize a visibility value to a valid Visibility type.
 * Invalid or missing values become 'pending' (defer to next level).
 */
export function normalizeVisibility(value: string | null | undefined): Visibility {
  if (!value) return 'pending';
  return ALLOWED_VISIBILITY.has(value as Visibility) ? (value as Visibility) : 'pending';
}

/**
 * Check if a candidate visibility is more private than (or equal to) a base visibility.
 * Used to enforce "per-note overrides can only be more private than default" rules.
 */
export function isMorePrivateOrEqual(candidate: Visibility, base: Visibility): boolean {
  return PRIVACY_RANK[candidate] >= PRIVACY_RANK[base];
}

/**
 * Resolve the effective visibility for a person mentioned in a note.
 *
 * @param referenceVisibility - Per-note override from event_references.visibility
 * @param personVisibility - Base visibility from people.visibility
 * @param contributorPreference - Per-author preference from visibility_preferences
 * @param globalPreference - Global default from visibility_preferences (contributor_id = null)
 * @returns The resolved visibility value
 *
 * Rules:
 *   1. 'removed' dominates: if person, contributor, or global pref is 'removed', return 'removed'
 *   2. Per-note override wins if not 'pending'
 *   3. Then per-author preference if not 'pending'
 *   4. Then global preference if not 'pending'
 *   5. Finally fall back to person's base visibility
 */
export function resolveVisibility(
  referenceVisibility: string | null | undefined,
  personVisibility: string | null | undefined,
  contributorPreference: string | null | undefined,
  globalPreference: string | null | undefined
): Visibility {
  const refVis = normalizeVisibility(referenceVisibility);
  const personVis = normalizeVisibility(personVisibility);
  const contributorPref = normalizeVisibility(contributorPreference);
  const globalPref = normalizeVisibility(globalPreference);

  // 'removed' dominates everything - privacy protection
  if (personVis === 'removed' || contributorPref === 'removed' || globalPref === 'removed') {
    return 'removed';
  }

  // Precedence chain: per-note > per-author > global > person fallback
  // 'pending' means "no override at this level, defer to next"
  if (refVis !== 'pending') return refVis;
  if (contributorPref !== 'pending') return contributorPref;
  if (globalPref !== 'pending') return globalPref;
  return personVis;
}

/**
 * Determine if a person's identity can be revealed.
 *
 * Returns false if:
 *   - No claim exists (claimExists is false)
 *   - Resolved visibility is 'removed'
 *   - Resolved visibility is 'pending' (unclaimed/unset)
 *
 * @param claimExists - Whether the person has a verified claim
 * @param resolvedVisibility - The resolved visibility from resolveVisibility()
 */
export function canRevealIdentity(
  claimExists: boolean,
  resolvedVisibility: Visibility
): boolean {
  if (!claimExists) return false;
  if (resolvedVisibility === 'removed') return false;
  if (resolvedVisibility === 'pending') return false;
  return true;
}

/**
 * Shape a person payload for API responses.
 * Ensures canonical name is only included when visibility allows it.
 *
 * @param options.claimExists - Whether the person has a verified claim
 * @param options.personId - The person's ID
 * @param options.canonicalName - The person's real name (protected)
 * @param options.resolvedVisibility - The resolved visibility
 * @returns A safe person object or null if identity should not be revealed
 */
export function shapePersonPayload(options: {
  claimExists: boolean;
  personId: string;
  canonicalName: string | null;
  resolvedVisibility: Visibility;
}): { id: string; name: string | null; visibility: Visibility } | null {
  const { claimExists, personId, canonicalName, resolvedVisibility } = options;

  // No claim = no person payload (API contract for privacy)
  if (!claimExists) {
    return null;
  }

  // Removed = no person payload
  if (resolvedVisibility === 'removed') {
    return null;
  }

  // Only reveal canonical name if approved
  const safeName = resolvedVisibility === 'approved' ? canonicalName : null;

  return {
    id: personId,
    name: safeName,
    visibility: resolvedVisibility,
  };
}
