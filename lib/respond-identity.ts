import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { createPersonLookupHelpers } from '@/lib/person-lookup';

type Visibility = 'approved' | 'blurred' | 'anonymized' | 'pending' | 'removed';

type IdentityUpdateInput = {
  admin: SupabaseClient<Database>;
  eventId: string;
  recipientName: string;
  responderName?: string | null;
  relationshipToSubject?: string | null;
  visibility?: Visibility | null;
  contributorId?: string | null;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function splitNameParts(value: string) {
  return normalizeName(value).split(/\s+/).filter(Boolean);
}

function matchesName(candidate: string, target: string) {
  const candidateLower = normalizeName(candidate);
  const targetLower = normalizeName(target);
  if (!candidateLower || !targetLower) return false;

  if (candidateLower === targetLower) return true;
  if (candidateLower.includes(targetLower) || targetLower.includes(candidateLower)) return true;

  const candidateParts = splitNameParts(candidateLower);
  const targetParts = splitNameParts(targetLower);
  return candidateParts.some((part) => targetParts.includes(part));
}

export async function upsertInviteIdentityReference({
  admin,
  eventId,
  recipientName,
  responderName,
  relationshipToSubject,
  visibility,
  contributorId,
}: IdentityUpdateInput): Promise<void> {
  const trimmedRecipient = recipientName.trim();
  if (!eventId || !trimmedRecipient) return;

  const allowedVisibility = new Set<Visibility>([
    'approved',
    'blurred',
    'anonymized',
    'pending',
    'removed',
  ]);
  const normalizedVisibility = visibility && allowedVisibility.has(visibility) ? visibility : null;
  const trimmedRelationship =
    typeof relationshipToSubject === 'string' ? relationshipToSubject.trim() : '';
  const nameCandidates = [recipientName, responderName]
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean);

  type RefRow = {
    id: string;
    display_name: string | null;
    relationship_to_subject: string | null;
    person: { id: string; canonical_name: string | null } | null;
    contributor: { name: string | null } | null;
  };

  const { data: refs } = await admin.from('event_references')
    .select('id, display_name, relationship_to_subject, person:people(id, canonical_name), contributor:contributors(name)')
    .eq('event_id', eventId)
    .eq('type', 'person');

  const match = (refs as unknown as RefRow[] | null)?.find((ref) => {
    const candidate =
      ref.person?.canonical_name ||
      ref.display_name ||
      ref.contributor?.name ||
      '';
    if (!candidate) return false;
    return nameCandidates.some((target) => matchesName(candidate, target));
  });

  if (match?.id) {
    const updatePayload: Record<string, string | null> = {};
    if (normalizedVisibility) {
      updatePayload.visibility = normalizedVisibility;
    }
    if (trimmedRelationship) {
      updatePayload.relationship_to_subject = trimmedRelationship;
    }

    if (Object.keys(updatePayload).length > 0) {
      await admin.from('event_references')
        .update(updatePayload)
        .eq('id', match.id);
    }
    return;
  }

  const canonicalName = (responderName || trimmedRecipient).trim();
  const { resolvePersonIdByName } = createPersonLookupHelpers(admin, contributorId ?? null);
  const personId = await resolvePersonIdByName(canonicalName);

  if (!personId) return;

  await admin.from('event_references').insert({
    event_id: eventId,
    type: 'person',
    person_id: personId,
    role: 'witness',
    relationship_to_subject: trimmedRelationship || null,
    visibility: normalizedVisibility ?? 'pending',
    added_by: contributorId ?? null,
  });
}
