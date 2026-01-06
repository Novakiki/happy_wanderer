import type { APIRequestContext } from '@playwright/test';
import { adminClient, fixtureEnabled, fixtureKey } from './env';

export async function createInvite(eventId: string) {
  if (!adminClient) return null;

  const { data: invite, error } = await adminClient
    .from('invites')
    .insert({
      event_id: eventId,
      recipient_name: 'Roleplay Browser',
      recipient_contact: 'roleplay@example.com',
      method: 'link',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !invite) return null;
  return (invite as { id?: string } | null)?.id ?? null;
}

export async function cleanupInvite(request: APIRequestContext, inviteId: string | null) {
  if (!inviteId || !fixtureEnabled || !fixtureKey) return;

  await request.post('/api/test/fixtures/cleanup', {
    data: { inviteIds: [inviteId] },
    headers: {
      'x-e2e-fixture-key': fixtureKey,
    },
  });
}
