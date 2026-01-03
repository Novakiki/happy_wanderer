import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { upsertInviteIdentityReference } from '@/lib/respond-identity';
import { getInviteExpiryDate } from '@/lib/invites';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      event_id,
      recipient_name,
      recipient_contact,
      method,
      message,
      witnesses = [],
      relationship_to_subject,
    } = body;

    if (!event_id || !recipient_name || !method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check that the event is a memory (not milestone or synchronicity)
    const { data: event, error: eventError } = await admin.from('current_notes')
      .select('type, contributor_id')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const typedEvent = event as { type: string; contributor_id: string | null };
    const eventType = typedEvent.type;
    if (eventType !== 'memory') {
      const typeLabel = eventType === 'origin' ? 'synchronicity' : eventType;
      return NextResponse.json(
        { error: `Invites can only be sent for memories, not ${typeLabel}s` },
        { status: 400 }
      );
    }

    // Insert invite
    const { data: invite, error: inviteError } = await admin.from('invites')
      .insert({
        event_id,
        recipient_name,
        recipient_contact,
        method,
        message,
        sender_id: typedEvent.contributor_id ?? null,
        expires_at: getInviteExpiryDate(),
      })
      .select('id')
      .single();

    if (inviteError || !invite) {
      console.error('Invite insert error:', inviteError);
      return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
    }

    const trimmedRelationship =
      typeof relationship_to_subject === 'string' ? relationship_to_subject.trim() : '';

    await upsertInviteIdentityReference({
      admin,
      eventId: event_id,
      recipientName: recipient_name,
      relationshipToSubject: trimmedRelationship || null,
      contributorId: typedEvent.contributor_id ?? null,
    });

    // Optionally record witnesses
    if (Array.isArray(witnesses) && witnesses.length) {
      const witnessRows = witnesses
        .filter((name: string) => !!name?.trim())
        .map((name: string) => ({
          event_id,
          name: name.trim(),
          contact_method: null,
          contact_info: null,
          status: 'invited' as const,
        }));

      if (witnessRows.length) {
        const { error: witnessError } = await admin.from('witnesses').insert(witnessRows);
        if (witnessError) {
          console.warn('Witness insert error (continuing):', witnessError);
        }
      }
    }

    return NextResponse.json({ success: true, invite_id: (invite as { id: string }).id });
  } catch (error) {
    console.error('Invite API error:', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}
