/**
 * Pending Names Handler
 * =====================
 * Detects person names in content using LLM, checks their consent status,
 * and creates pending person references for those without consent.
 *
 * Names without consent appear blurred in the display until the person
 * grants permission to be named.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type ReferenceVisibility = 'approved' | 'pending' | 'anonymized' | 'blurred' | 'removed';

export type PendingNameResult = {
  name: string;
  personId: string;
  status: 'created' | 'existing';
};

export type DetectAndCreateResult = {
  pendingNames: PendingNameResult[];
  consentedNames: string[];
};

/**
 * Construct the name-detection-check edge function URL from SUPABASE_URL.
 */
function getNameDetectionUrl(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  const host = url.hostname.replace('.supabase.co', '.functions.supabase.co');
  return `${url.protocol}//${host}/name-detection-check`;
}

/**
 * Call the name-detection-check edge function to extract names from content.
 */
async function detectNamesViaLlm(content: string): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const token = process.env.LLM_FUNCTION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !token) {
    console.warn('pending-names: Missing SUPABASE_URL or auth token');
    return [];
  }

  try {
    const resp = await fetch(getNameDetectionUrl(supabaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!resp.ok) {
      console.warn('pending-names: name-detection-check failed:', resp.status);
      return [];
    }

    const data = await resp.json();
    return Array.isArray(data?.names) ? data.names : [];
  } catch (err) {
    console.error('pending-names: detectNamesViaLlm error:', err);
    return [];
  }
}

/**
 * Resolve effective visibility using the same precedence as references.ts:
 * 1. Per-contributor preference
 * 2. Global preference (contributor_id = NULL)
 * 3. Person's default
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
 * Look up a person by name (via aliases or canonical_name).
 * Returns the person_id if found, null otherwise.
 */
async function findPersonByName(
  admin: SupabaseClient,
  nameText: string
): Promise<string | null> {
  // Try alias first (case-insensitive)
  const { data: aliasRows } = await admin
    .from('person_aliases')
    .select('person_id')
    .ilike('alias', nameText)
    .limit(1);

  if (aliasRows && aliasRows.length > 0) {
    return (aliasRows[0] as { person_id: string }).person_id;
  }

  // Try canonical name (case-insensitive)
  const { data: personRows } = await admin
    .from('people')
    .select('id')
    .ilike('canonical_name', nameText)
    .limit(1);

  if (personRows && personRows.length > 0) {
    return (personRows[0] as { id: string }).id;
  }

  return null;
}

/**
 * Create a new person record with the given name.
 */
async function createPerson(
  admin: SupabaseClient,
  name: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('people')
    .insert({
      canonical_name: name,
      visibility: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('pending-names: Failed to create person:', error);
    return null;
  }

  return (data as { id: string })?.id ?? null;
}

/**
 * Check if a person has approved visibility for a given contributor.
 */
async function checkPersonConsent(
  admin: SupabaseClient,
  personId: string,
  contributorId: string | null
): Promise<boolean> {
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
      .or(`contributor_id.eq.${contributorId},contributor_id.is.null`);

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
  return effectiveVisibility === 'approved';
}

/**
 * Check if a reference already exists for this event + person.
 */
async function referenceExists(
  admin: SupabaseClient,
  eventId: string,
  personId: string
): Promise<boolean> {
  const { data } = await admin
    .from('event_references')
    .select('id')
    .eq('event_id', eventId)
    .eq('person_id', personId)
    .limit(1);

  return Boolean(data && data.length > 0);
}

/**
 * Create a pending person reference for an event.
 */
async function createPendingReference(
  admin: SupabaseClient,
  eventId: string,
  personId: string,
  contributorId: string | null
): Promise<void> {
  const { error } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
    .insert({
      event_id: eventId,
      type: 'person',
      person_id: personId,
      role: 'witness',  // Auto-detected names treated as witnesses (people present/involved)
      visibility: 'pending',
      added_by: contributorId,
    });

  if (error) {
    console.error('pending-names: Failed to create reference:', error);
  }
}

/**
 * Detect names in content and create pending person references for those
 * without consent.
 *
 * @param content - The content to scan for names
 * @param eventId - The event to attach references to
 * @param admin - Supabase admin client
 * @param contributorId - Current contributor ID (for per-contributor preferences)
 * @returns Object containing arrays of pending and consented names
 */
export async function detectAndCreatePendingReferences(
  content: string,
  eventId: string,
  admin: SupabaseClient,
  contributorId: string | null
): Promise<DetectAndCreateResult> {
  const pendingNames: PendingNameResult[] = [];
  const consentedNames: string[] = [];

  // Detect names using LLM
  const detectedNames = await detectNamesViaLlm(content);

  if (detectedNames.length === 0) {
    return { pendingNames, consentedNames };
  }

  // Process each detected name (limit to 20 for performance)
  const namesToProcess = detectedNames.slice(0, 20);

  for (const nameText of namesToProcess) {
    const trimmedName = nameText.trim();
    if (!trimmedName) continue;

    // Try to find existing person
    let personId = await findPersonByName(admin, trimmedName);
    let isNewPerson = false;

    if (!personId) {
      // Create new person record
      personId = await createPerson(admin, trimmedName);
      isNewPerson = true;
    }

    if (!personId) continue;

    // Check if they have consent
    const hasConsent = isNewPerson ? false : await checkPersonConsent(admin, personId, contributorId);

    if (hasConsent) {
      consentedNames.push(trimmedName);
      continue;
    }

    // Check if reference already exists
    const exists = await referenceExists(admin, eventId, personId);

    if (exists) {
      pendingNames.push({
        name: trimmedName,
        personId,
        status: 'existing',
      });
      continue;
    }

    // Create pending reference
    await createPendingReference(admin, eventId, personId, contributorId);
    pendingNames.push({
      name: trimmedName,
      personId,
      status: 'created',
    });
  }

  return { pendingNames, consentedNames };
}
