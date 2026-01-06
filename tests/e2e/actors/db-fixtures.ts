import { adminClient } from './env';

// NOTE:
// - `actors/db-fixtures.ts` uses the Supabase admin client to insert/delete rows directly (fast, flexible).
// - `actors/fixtures.ts` uses the app's test-only HTTP endpoints (more "end-to-end", but requires fixture key setup).

export async function createContributorFixture(input: {
  name: string;
  relation: string;
  email: string;
  trusted?: boolean;
}) {
  if (!adminClient) return null;

  const { data: contributor } = await adminClient
    .from('contributors')
    .insert({
      name: input.name,
      relation: input.relation,
      email: input.email,
      trusted: input.trusted ?? false,
    })
    .select('id')
    .single();

  const contributorId = (contributor as { id?: string } | null)?.id ?? null;
  return contributorId ? { id: contributorId } : null;
}

export async function cleanupContributor(contributorId: string | null) {
  if (!adminClient || !contributorId) return;
  await adminClient.from('contributors').delete().eq('id', contributorId);
}

export async function createPendingNoteFixture(input: {
  contributorId: string;
  year: number;
  title: string;
  preview: string;
  full_entry: string;
  why_included: string;
}) {
  if (!adminClient) return null;

  const { data: note } = await adminClient
    .from('timeline_events')
    .insert({
      year: input.year,
      type: 'memory',
      title: input.title,
      preview: input.preview,
      full_entry: input.full_entry,
      why_included: input.why_included,
      status: 'pending',
      privacy_level: 'family',
      contributor_id: input.contributorId,
    })
    .select('id')
    .single();

  const noteId = (note as { id?: string } | null)?.id ?? null;
  return noteId ? { id: noteId } : null;
}

export async function cleanupNote(noteId: string | null) {
  if (!adminClient || !noteId) return;
  await adminClient.from('timeline_events').delete().eq('id', noteId);
}

export async function createEditTokenFixture(input: {
  contributorId: string;
  hoursValid?: number;
}) {
  if (!adminClient) return null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + (input.hoursValid ?? 24) * 60 * 60 * 1000
  ).toISOString();

  const { data: editToken } = await adminClient
    .from('edit_tokens')
    .insert({
      token,
      contributor_id: input.contributorId,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  const editTokenId = (editToken as { id?: string } | null)?.id ?? null;
  return editTokenId ? { id: editTokenId, token } : null;
}

export async function cleanupEditToken(editTokenId: string | null) {
  if (!adminClient || !editTokenId) return;
  await adminClient.from('edit_tokens').delete().eq('id', editTokenId);
}

export async function cleanupTrustRequests(contributorId: string | null) {
  if (!adminClient || !contributorId) return;
  await adminClient.from('trust_requests').delete().eq('contributor_id', contributorId);
}

export async function createInviteCodeFixture(input: {
  code: string;
  usesRemaining?: number | null;
  expiresAt?: string | null;
}) {
  if (!adminClient) return null;

  const { data: inviteCode } = await adminClient
    .from('invite_codes')
    .insert({
      code: input.code,
      uses_remaining: input.usesRemaining ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select('id')
    .single();

  const id = (inviteCode as { id?: string } | null)?.id ?? null;
  return id ? { id, code: input.code } : null;
}

export async function cleanupInviteCode(inviteCodeId: string | null) {
  if (!adminClient || !inviteCodeId) return;
  await adminClient.from('invite_codes').delete().eq('id', inviteCodeId);
}

export async function createTrustRequestFixture(input: {
  contributorId: string;
  message?: string | null;
}) {
  if (!adminClient) return null;

  const { data: request } = await adminClient
    .from('trust_requests')
    .insert({
      contributor_id: input.contributorId,
      status: 'pending',
      message: input.message ?? null,
    })
    .select('id')
    .single();

  const id = (request as { id?: string } | null)?.id ?? null;
  return id ? { id } : null;
}

export async function cleanupTrustRequest(trustRequestId: string | null) {
  if (!adminClient || !trustRequestId) return;
  await adminClient.from('trust_requests').delete().eq('id', trustRequestId);
}
