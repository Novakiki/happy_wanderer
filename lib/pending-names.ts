/**
 * Mention Detection Handler
 * =========================
 * Detects person-like names in content using an LLM and stores them as
 * mention candidates (note_mentions). Mentions never create people or
 * references without explicit promotion.
 *
 * Private names are stored as pending mentions for review.
 * Public figures are skipped (kept as plain text).
 * Fictional names are skipped.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSubjectName } from '@/lib/subject-names';

export type MentionResult = {
  name: string;
  mentionId: string;
  status: 'created' | 'existing';
};

export type DetectAndStoreResult = {
  mentions: MentionResult[];
};

type DetectedNamesPayload = {
  names: string[];
  publicNames: string[];
  fictionalNames: string[];
};

type MentionVisibility = 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed';
type MentionStatus = 'pending' | 'context' | 'ignored' | 'promoted';

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

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function isFictionalCharacter(name: string): boolean {
  return FICTIONAL_CHARACTERS.has(normalizeName(name));
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
async function detectNamesViaLlm(content: string): Promise<DetectedNamesPayload> {
  if (process.env.E2E_SKIP_NAME_DETECTION === 'true') {
    return { names: [], publicNames: [], fictionalNames: [] };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const token = process.env.LLM_FUNCTION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !token) {
    console.warn('pending-names: Missing SUPABASE_URL or auth token');
    return { names: [], publicNames: [], fictionalNames: [] };
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
      return { names: [], publicNames: [], fictionalNames: [] };
    }

    const data = await resp.json();
    return {
      names: Array.isArray(data?.names) ? data.names : [],
      publicNames: Array.isArray(data?.public_names) ? data.public_names : [],
      fictionalNames: Array.isArray(data?.fictional_names) ? data.fictional_names : [],
    };
  } catch (err) {
    console.error('pending-names: detectNamesViaLlm error:', err);
    return { names: [], publicNames: [], fictionalNames: [] };
  }
}

type MentionMatch = {
  id: string;
  status: MentionStatus;
  mention_text: string;
};

/**
 * Check if a mention already exists for this event + normalized text.
 */
async function mentionExists(
  admin: SupabaseClient,
  eventId: string,
  normalizedText: string
): Promise<MentionMatch | null> {
  const { data } = await admin
    .from('note_mentions')
    .select('id, status, mention_text')
    .eq('event_id', eventId)
    .eq('normalized_text', normalizedText)
    .eq('source', 'llm')
    .limit(1);

  if (!data || data.length === 0) return null;
  const row = data[0] as { id: string; status?: MentionStatus | null; mention_text?: string | null };
  return {
    id: row.id,
    status: (row.status ?? 'pending') as MentionStatus,
    mention_text: row.mention_text ?? '',
  };
}

/**
 * Create a new mention record for an event.
 */
async function createMention(
  admin: SupabaseClient,
  eventId: string,
  mentionText: string,
  normalizedText: string,
  contributorId: string | null,
  visibility: MentionVisibility
): Promise<string | null> {
  const { data, error } = await admin
    .from('note_mentions')
    .insert({
      event_id: eventId,
      mention_text: mentionText,
      normalized_text: normalizedText,
      visibility,
      status: 'pending',
      source: 'llm',
      created_by: contributorId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('mentions: Failed to create mention:', error);
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Detect names in content and store pending mention candidates.
 *
 * Note: We store pending mentions for private names without creating People.
 * Public figures and fictional names are skipped.
 *
 * @param content - The content to scan for names
 * @param eventId - The event to attach mentions to
 * @param admin - Supabase admin client
 * @param contributorId - Current contributor ID
 * @returns Object containing array of mentions
 */
export async function detectAndStoreMentions(
  content: string,
  eventId: string,
  admin: SupabaseClient,
  contributorId: string | null
): Promise<DetectAndStoreResult> {
  const mentions: MentionResult[] = [];

  // Detect names using LLM
  const detectedNames = await detectNamesViaLlm(content);

  if (detectedNames.names.length === 0) {
    return { mentions };
  }

  // Process each detected name (limit to 20 for performance)
  const namesToProcess = detectedNames.names.slice(0, 20);
  const publicNameSet = new Set(detectedNames.publicNames.map(normalizeName));
  const fictionalNameSet = new Set(detectedNames.fictionalNames.map(normalizeName));

  for (const nameText of namesToProcess) {
    const trimmedName = nameText.trim();
    if (!trimmedName) continue;

    const nameKey = normalizeName(trimmedName);

    // Skip fictional characters (Santa, Easter Bunny, etc.)
    if (fictionalNameSet.has(nameKey) || isFictionalCharacter(trimmedName)) continue;

    // Skip subject name variants (Valerie) — always allowed and not stored
    if (isSubjectName(nameKey)) continue;

    const isPublicFigure = publicNameSet.has(nameKey);
    if (isPublicFigure) continue;

    const visibility: MentionVisibility = 'pending';

    const existing = await mentionExists(admin, eventId, nameKey);
    if (existing) {
      mentions.push({
        name: existing.mention_text || trimmedName,
        mentionId: existing.id,
        status: 'existing',
      });
      continue;
    }

    const mentionId = await createMention(
      admin,
      eventId,
      trimmedName,
      nameKey,
      contributorId,
      visibility
    );

    if (!mentionId) continue;

    mentions.push({
      name: trimmedName,
      mentionId,
      status: 'created',
    });
  }

  return { mentions };
}
