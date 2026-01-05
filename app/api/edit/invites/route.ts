import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { buildInviteData, buildSmsLink, buildSmsMessage, getInviteExpiryDate, INVITE_MAX_USES } from '@/lib/invites';
import { resolveInviteGraphContext } from '@/lib/invite-graph';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

type InviteRow = {
  id: string;
  recipient_name: string;
  recipient_contact: string;
  method: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  contributed_at: string | null;
};

async function validateTokenForEvent(token: string, eventId: string) {
  const { data: tokenRow }: {
    data: { id: string; contributor_id: string | null; expires_at: string | null } | null;
  } = await admin
    .from('edit_tokens')
    .select('id, contributor_id, expires_at')
    .eq('token', token)
    .single();

  if (!tokenRow?.contributor_id) {
    return { ok: false as const, status: 401, error: 'Invalid token' };
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return { ok: false as const, status: 401, error: 'Token expired' };
  }

  const { data: event }: { data: { id: string; contributor_id: string | null; type: string | null } | null } = await admin
    .from('timeline_events')
    .select('id, contributor_id, type')
    .eq('id', eventId)
    .single();

  if (!event?.id || event.contributor_id !== tokenRow.contributor_id) {
    return { ok: false as const, status: 403, error: 'Not authorized' };
  }

  return { ok: true as const, contributorId: tokenRow.contributor_id, eventType: event.type ?? 'memory' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const eventId = searchParams.get('event_id');

  if (!token || !eventId) {
    return NextResponse.json({ error: 'Missing token or event_id' }, { status: 400 });
  }

  const validation = await validateTokenForEvent(token, eventId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const { data: invites, error } = await admin.from('invites')
    .select('id, recipient_name, recipient_contact, method, status, sent_at, opened_at, contributed_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Invite fetch error:', error);
    return NextResponse.json({ error: 'Failed to load invites' }, { status: 500 });
  }

  return NextResponse.json({
    invites: (invites as InviteRow[] | null) ?? [],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      token,
      event_id,
      recipient_name,
      recipient_contact,
      relationship_to_subject,
      parent_invite_id,
    } = body || {};

    if (!token || !event_id || !recipient_name || !recipient_contact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validation = await validateTokenForEvent(token, event_id);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    if (validation.eventType !== 'memory') {
      const typeLabel = validation.eventType === 'origin' ? 'synchronicity' : validation.eventType;
      return NextResponse.json(
        { error: `Invites can only be sent for memories, not ${typeLabel}s` },
        { status: 400 }
      );
    }

    // Build invite data (deduces sms/email)
    const senderName = 'A family member';
    const inviteData = buildInviteData(
      { name: recipient_name, relationship: relationship_to_subject || '', phone: recipient_contact },
      senderName
    );

    const method = inviteData?.method ?? (recipient_contact.includes('@') ? 'email' : 'sms');
    const message = inviteData?.message ?? 'A memory of Val includes you. Want to add your version?';

    // Dedupe by event + contact
    const { data: existingInvite } = await admin.from('invites')
      .select('id')
      .eq('event_id', event_id)
      .eq('recipient_contact', recipient_contact)
      .limit(1);

    let inviteId: string | null = null;
    if (existingInvite && existingInvite.length > 0) {
      inviteId = (existingInvite[0] as { id: string }).id;
      await admin.from('invites')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          message,
          method,
          expires_at: getInviteExpiryDate(),
          uses_count: 0,
          max_uses: INVITE_MAX_USES,
        })
        .eq('id', inviteId);
    } else {
      const graphResult = await resolveInviteGraphContext(
        admin,
        typeof parent_invite_id === 'string' ? parent_invite_id : null
      );
      if (!graphResult.ok) {
        return NextResponse.json({ error: graphResult.error }, { status: 400 });
      }

      const { data: inserted, error } = await admin.from('invites')
        .insert({
          event_id,
          recipient_name,
          recipient_contact,
          method,
          message,
          sender_id: validation.contributorId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          expires_at: getInviteExpiryDate(),
          parent_invite_id: graphResult.context.parent_invite_id,
          depth: graphResult.context.depth,
          max_uses: graphResult.context.max_uses,
        })
        .select('id')
        .single();

      if (error || !inserted) {
        console.error('Invite insert error:', error);
        return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
      }
      inviteId = (inserted as { id: string }).id;
    }

    const baseUrl = new URL(request.url).origin.replace(/\/api$/, '');
    const smsLink = method === 'sms' && inviteId
      ? buildSmsLink(recipient_contact, recipient_name, inviteId, baseUrl)
      : null;

    return NextResponse.json({
      success: true,
      invite_id: inviteId,
      status: 'sent',
      sms_link: smsLink,
      message: method === 'sms' && inviteId
        ? buildSmsMessage(recipient_name, inviteId, baseUrl)
        : message,
    });
  } catch (error) {
    console.error('Invite API error:', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}
