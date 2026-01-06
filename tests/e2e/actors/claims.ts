import { adminClient } from './env';

export async function createClaimToken(inviteId: string, eventId: string) {
  if (!adminClient) return null;

  const token = crypto.randomUUID();
  const { data: claim, error } = await adminClient
    .from('claim_tokens')
    .insert({
      token,
      invite_id: inviteId,
      recipient_name: 'E2E Claim Test',
      recipient_phone: '+15551234567',
      event_id: eventId,
      sms_status: 'sent',
    })
    .select('id, token')
    .single();

  if (error || !claim) return null;
  return { id: (claim as { id: string }).id, token: (claim as { token: string }).token };
}

export async function createExpiredClaimToken(inviteId: string, eventId: string) {
  if (!adminClient) return null;

  const token = crypto.randomUUID();
  const { data: claim, error } = await adminClient
    .from('claim_tokens')
    .insert({
      token,
      invite_id: inviteId,
      recipient_name: 'E2E Expired Test',
      recipient_phone: '+15551234567',
      event_id: eventId,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      sms_status: 'sent',
    })
    .select('id, token')
    .single();

  if (error || !claim) return null;
  return { id: (claim as { id: string }).id, token: (claim as { token: string }).token };
}

export async function cleanupClaimToken(claimId: string | null) {
  if (!claimId || !adminClient) return;
  await adminClient.from('claim_tokens').delete().eq('id', claimId);
}
