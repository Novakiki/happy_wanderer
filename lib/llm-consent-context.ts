/**
 * LLM Consent Context Builder
 * ===========================
 * Builds context about consented people to pass to LLM review.
 * Detects names in content and looks up their consent status + relationship to Valerie.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectNames } from './name-detection';

type ReferenceVisibility = 'approved' | 'pending' | 'anonymized' | 'blurred' | 'removed';

export type ConsentedPerson = {
  name: string;
  relationship: string | null;
};

export type LlmConsentContext = {
  consentedNames: ConsentedPerson[];
};

/**
 * Resolve effective visibility using the same precedence as references.ts:
 * 1. Per-contributor preference
 * 2. Global preference (contributor_id = NULL)
 * 3. Person's default
 *
 * Note: We skip per-note override since we're checking before the note exists.
 */
function resolveVisibility(
  personVisibility: ReferenceVisibility | null,
  contributorPreference: ReferenceVisibility | null,
  globalPreference: ReferenceVisibility | null
): ReferenceVisibility {
  const personVis = personVisibility ?? 'pending';
  const contributorPref = contributorPreference ?? 'pending';
  const globalPref = globalPreference ?? 'pending';

  // Check for removal at any level
  if (personVis === 'removed' || contributorPref === 'removed' || globalPref === 'removed') {
    return 'removed';
  }

  // 1. Per-contributor preference
  if (contributorPref !== 'pending') return contributorPref;

  // 2. Global preference
  if (globalPref !== 'pending') return globalPref;

  // 3. Person's default
  return personVis;
}

/**
 * Build consent context for LLM review by detecting names and looking up their status.
 *
 * @param content - The content to scan for names
 * @param admin - Supabase admin client
 * @param contributorId - Current contributor ID (for per-contributor preferences)
 * @returns Object containing array of consented people with their relationships
 */
export async function buildLlmConsentContext(
  content: string,
  admin: SupabaseClient,
  contributorId: string | null
): Promise<LlmConsentContext> {
  const consentedNames: ConsentedPerson[] = [];

  // Detect names in content using NLP
  const detectedNames = detectNames(content);

  if (detectedNames.length === 0) {
    return { consentedNames };
  }

  // Process each detected name (limit to 20 for performance)
  const namesToProcess = detectedNames.slice(0, 20);

  for (const detected of namesToProcess) {
    const nameText = detected.text.trim();
    if (!nameText) continue;

    // Try to find person by alias first (case-insensitive)
    const { data: aliasRows } = await admin
      .from('person_aliases')
      .select('person_id')
      .ilike('alias', nameText)
      .limit(1);

    let personId: string | null = null;

    if (aliasRows && aliasRows.length > 0) {
      personId = (aliasRows[0] as { person_id: string }).person_id;
    } else {
      // Try canonical name (case-insensitive)
      const { data: personRows } = await admin
        .from('people')
        .select('id')
        .ilike('canonical_name', nameText)
        .limit(1);

      if (personRows && personRows.length > 0) {
        personId = (personRows[0] as { id: string }).id;
      }
    }

    // Name not found in database - skip
    if (!personId) continue;

    // Fetch person's default visibility
    const { data: person } = await admin
      .from('people')
      .select('visibility')
      .eq('id', personId)
      .single();

    const personVisibility = ((person as { visibility?: string } | null)?.visibility ?? 'pending') as ReferenceVisibility;

    // Fetch visibility preferences
    let contributorPref: ReferenceVisibility | null = null;
    let globalPref: ReferenceVisibility | null = null;

    if (contributorId) {
      // Get both contributor-specific and global preferences
      const { data: prefs } = await admin
        .from('visibility_preferences')
        .select('contributor_id, visibility')
        .eq('person_id', personId)
        .or(`contributor_id.eq."${contributorId}",contributor_id.is.null`);

      if (prefs) {
        for (const pref of prefs as Array<{ contributor_id: string | null; visibility: string }>) {
          if (pref.contributor_id === contributorId) {
            contributorPref = pref.visibility as ReferenceVisibility;
          } else if (pref.contributor_id === null) {
            globalPref = pref.visibility as ReferenceVisibility;
          }
        }
      }
    } else {
      // Only get global preferences
      const { data: prefs } = await admin
        .from('visibility_preferences')
        .select('visibility')
        .eq('person_id', personId)
        .is('contributor_id', null)
        .limit(1);

      if (prefs && prefs.length > 0) {
        globalPref = (prefs[0] as { visibility: string }).visibility as ReferenceVisibility;
      }
    }

    const effectiveVisibility = resolveVisibility(personVisibility, contributorPref, globalPref);

    // Only include if approved
    if (effectiveVisibility !== 'approved') continue;

    // Get relationship from most recent event_references
    let relationship: string | null = null;
    const { data: refs } = await admin
      .from('event_references')
      .select('relationship_to_subject')
      .eq('person_id', personId)
      .not('relationship_to_subject', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (refs && refs.length > 0) {
      relationship = (refs[0] as { relationship_to_subject: string }).relationship_to_subject;
    }

    consentedNames.push({
      name: nameText,
      relationship,
    });
  }

  return { consentedNames };
}
