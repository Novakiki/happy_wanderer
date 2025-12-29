/**
 * Shared person lookup and resolution logic.
 * Used by API routes that handle person references.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Escape SQL wildcards for safe use in ilike queries.
 * Prevents user input containing % or _ from acting as wildcards.
 */
function escapeIlikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

type PersonVisibility = 'approved' | 'pending' | 'anonymized' | 'blurred' | 'removed';

export type PersonLookupHelpers = {
  /**
   * Check if a person ID can be used/referenced by the current contributor.
   * Returns true if:
   * - Person is approved
   * - Person was created by this contributor
   * - Person has an approved claim
   * - Contributor has previously referenced this person
   */
  canUsePersonId: (personId: string) => Promise<boolean>;

  /**
   * Resolve a person ID from a name.
   * Searches aliases first, then canonical names.
   * Creates a new person if no match found.
   */
  resolvePersonIdByName: (name: string) => Promise<string | null>;
};

/**
 * Create person lookup helper functions scoped to a specific contributor.
 *
 * @param admin - Supabase admin client
 * @param contributorId - The contributor making the request (can be null for unauthenticated)
 * @returns Helper functions for person lookup and resolution
 *
 * @example
 * const { canUsePersonId, resolvePersonIdByName } = createPersonLookupHelpers(admin, contributorId);
 * const personId = await resolvePersonIdByName('John Smith');
 */
export function createPersonLookupHelpers(
  admin: SupabaseClient,
  contributorId: string | null
): PersonLookupHelpers {
  // Cache to avoid repeated lookups for the same person
  const canUsePersonIdCache = new Map<string, boolean>();

  const canUsePersonId = async (personId: string): Promise<boolean> => {
    // Return cached result if available
    if (canUsePersonIdCache.has(personId)) {
      return canUsePersonIdCache.get(personId) ?? false;
    }

    // Fetch person record
    const { data: personRows } = await (admin.from('people') as ReturnType<typeof admin.from>)
      .select('id, visibility, created_by')
      .eq('id', personId)
      .limit(1);
    const personRow = personRows?.[0] as { visibility?: string | null; created_by?: string | null } | undefined;

    if (!personRow) {
      canUsePersonIdCache.set(personId, false);
      return false;
    }

    const visibility = (personRow.visibility ?? 'pending') as PersonVisibility;

    // Approved persons can always be used
    if (visibility === 'approved') {
      canUsePersonIdCache.set(personId, true);
      return true;
    }

    // Removed persons can never be used
    if (visibility === 'removed') {
      canUsePersonIdCache.set(personId, false);
      return false;
    }

    // Creator can use their own pending/anonymized/blurred persons
    if (contributorId && personRow.created_by === contributorId) {
      canUsePersonIdCache.set(personId, true);
      return true;
    }

    // Check for approved claims
    const { data: claimRows } = await (admin.from('person_claims') as ReturnType<typeof admin.from>)
      .select('id')
      .eq('person_id', personId)
      .eq('status', 'approved')
      .limit(1);
    if (claimRows && claimRows.length > 0) {
      canUsePersonIdCache.set(personId, true);
      return true;
    }

    // Check if contributor has previously referenced this person
    if (contributorId) {
      const { data: referenceRows } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
        .select('id')
        .eq('person_id', personId)
        .eq('added_by', contributorId)
        .limit(1);
      if (referenceRows && referenceRows.length > 0) {
        canUsePersonIdCache.set(personId, true);
        return true;
      }
    }

    canUsePersonIdCache.set(personId, false);
    return false;
  };

  const resolvePersonIdByName = async (name: string): Promise<string | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    // Search by alias first (case-insensitive exact match)
    const escapedName = escapeIlikePattern(trimmedName);
    const { data: aliasRows } = await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
      .select('person_id')
      .ilike('alias', escapedName)
      .limit(5);
    if (aliasRows && aliasRows.length > 0) {
      for (const row of aliasRows as Array<{ person_id?: string | null }>) {
        if (row.person_id && await canUsePersonId(row.person_id)) {
          return row.person_id;
        }
      }
    }

    // Search by canonical name (case-insensitive exact match)
    const { data: personRows } = await (admin.from('people') as ReturnType<typeof admin.from>)
      .select('id')
      .ilike('canonical_name', escapedName)
      .limit(5);
    if (personRows && personRows.length > 0) {
      for (const row of personRows as Array<{ id?: string | null }>) {
        if (row.id && await canUsePersonId(row.id)) {
          // Add alias for future lookups
          await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
            .insert({
              person_id: row.id,
              alias: trimmedName,
              created_by: contributorId,
            });
          return row.id;
        }
      }
    }

    // Create new person if no match found
    const { data: newPerson } = await (admin.from('people') as ReturnType<typeof admin.from>)
      .insert({
        canonical_name: trimmedName,
        visibility: 'pending',
        created_by: contributorId,
      })
      .select('id')
      .single();

    const newPersonId = (newPerson as { id?: string } | null)?.id ?? null;
    if (!newPersonId) return null;

    // Add alias for new person
    await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
      .insert({
        person_id: newPersonId,
        alias: trimmedName,
        created_by: contributorId,
      });

    return newPersonId;
  };

  return {
    canUsePersonId,
    resolvePersonIdByName,
  };
}
