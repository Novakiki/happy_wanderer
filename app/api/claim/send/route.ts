/**
 * Claim Send API - Sends SMS claim notifications
 * ===============================================
 *
 * POST /api/claim/send
 *   - Sends SMS claim notifications for invites with phone numbers
 *   - Called after memory creation when invites are created
 *   - Creates claim_token records and sends via Twilio
 *
 * Input: { invite_ids: string[] }
 * Output: { sent: number, failed: number, results: [...] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendSms, buildClaimSmsMessage, generateClaimToken, isTwilioConfigured } from '@/lib/twilio';

type InviteRow = {
  id: string;
  recipient_name: string;
  recipient_contact: string;
  event_id: string;
  method: string;
};

export async function POST(request: NextRequest) {
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: 'SMS not configured' }, { status: 503 });
  }

  const body = await request.json();
  const { invite_ids } = body;

  if (!Array.isArray(invite_ids) || invite_ids.length === 0) {
    return NextResponse.json({ error: 'No invites provided' }, { status: 400 });
  }

  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://happywanderer.app';

  const results: Array<{ invite_id: string; success: boolean; error?: string }> = [];

  for (const inviteId of invite_ids) {
    // Fetch invite details
    const { data: invite, error: inviteError } = await admin
      .from('invites')
      .select('id, recipient_name, recipient_contact, event_id, method')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      results.push({ invite_id: inviteId, success: false, error: 'Invalid invite' });
      continue;
    }

    const typedInvite = invite as InviteRow;

    if (typedInvite.method !== 'sms') {
      results.push({ invite_id: inviteId, success: false, error: 'Not an SMS invite' });
      continue;
    }

    // Generate claim token
    const token = generateClaimToken();

    // Create claim_token record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await admin.from('claim_tokens' as any).insert({
      token,
      invite_id: inviteId,
      recipient_name: typedInvite.recipient_name,
      recipient_phone: typedInvite.recipient_contact,
      event_id: typedInvite.event_id,
      sms_status: 'pending',
    });

    if (insertError) {
      console.error('Failed to create claim token:', insertError);
      results.push({ invite_id: inviteId, success: false, error: 'Token creation failed' });
      continue;
    }

    // Send SMS
    const message = buildClaimSmsMessage(typedInvite.recipient_name, token, baseUrl);
    const smsResult = await sendSms(typedInvite.recipient_contact, message);

    // Update token with SMS result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await admin
      .from('claim_tokens' as any)
      .update({
        sms_status: smsResult.success ? 'sent' : 'failed',
        sms_sent_at: smsResult.success ? new Date().toISOString() : null,
        sms_sid: smsResult.sid || null,
      })
      .eq('token', token);

    results.push({
      invite_id: inviteId,
      success: smsResult.success,
      error: smsResult.error,
    });
  }

  return NextResponse.json({
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
