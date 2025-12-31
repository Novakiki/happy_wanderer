/**
 * Pending Names Handler
 * =====================
 * Detects person names in content using LLM and creates pending person
 * references. Names appear as [person] in the display until the person
 * grants permission to be named.
 *
 * We always create pending references for detected names, even if someone
 * with that name has previously consented - this handles the case where
 * two different people share the same name.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type PendingNameResult = {
  name: string;
  personId: string;
  status: 'created' | 'existing';
};

export type DetectAndCreateResult = {
  pendingNames: PendingNameResult[];
};

/**
 * Common fictional characters to filter out from name detection.
 * These are names that commonly appear in family stories but aren't real people.
 */
const FICTIONAL_CHARACTERS = new Set([
  // Holiday figures
  'santa', 'santa claus', 'father christmas', 'st nick', 'saint nick',
  'easter bunny', 'tooth fairy', 'jack frost', 'cupid',
  // Common fictional references
  'god', 'jesus', 'jesus christ', 'christ',
  'devil', 'satan',
  // Fairy tale characters
  'cinderella', 'snow white', 'sleeping beauty', 'rapunzel',
  'peter pan', 'tinkerbell', 'pinocchio',
  // Other common fictional names in stories
  'boogeyman', 'sandman', 'mother nature',
]);

function isFictionalCharacter(name: string): boolean {
  return FICTIONAL_CHARACTERS.has(name.toLowerCase().trim());
}

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
 * Detect names in content and create pending person references.
 *
 * Note: We always create pending references for detected names, even if
 * someone with that name has previously consented. This handles the case
 * where two different people share the same name (e.g., "Amy" could be the
 * contributor or Amy's cousin).
 *
 * @param content - The content to scan for names
 * @param eventId - The event to attach references to
 * @param admin - Supabase admin client
 * @param contributorId - Current contributor ID
 * @returns Object containing array of pending names
 */
export async function detectAndCreatePendingReferences(
  content: string,
  eventId: string,
  admin: SupabaseClient,
  contributorId: string | null
): Promise<DetectAndCreateResult> {
  const pendingNames: PendingNameResult[] = [];

  // Detect names using LLM
  const detectedNames = await detectNamesViaLlm(content);

  if (detectedNames.length === 0) {
    return { pendingNames };
  }

  // Process each detected name (limit to 20 for performance)
  const namesToProcess = detectedNames.slice(0, 20);

  for (const nameText of namesToProcess) {
    const trimmedName = nameText.trim();
    if (!trimmedName) continue;

    // Skip fictional characters (Santa, Easter Bunny, etc.)
    if (isFictionalCharacter(trimmedName)) continue;

    // Try to find existing person
    let personId = await findPersonByName(admin, trimmedName);

    if (!personId) {
      // Create new person record
      personId = await createPerson(admin, trimmedName);
    }

    if (!personId) continue;

    // Check if reference already exists for this event
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

  return { pendingNames };
}
