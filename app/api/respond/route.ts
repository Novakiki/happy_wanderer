import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET: Fetch invite details for the response page
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get('id');

  if (!inviteId) {
    return NextResponse.json({ error: 'Missing invite ID' }, { status: 400 });
  }

  const admin = createAdminClient();

  type InviteResult = {
    id: string;
    recipient_name: string;
    status: string;
    event: { id: string; title: string; content: string; year: number; year_end: number | null } | null;
    sender: { name: string } | null;
  };

  // Fetch the invite with related event and sender info
  const { data: invite, error } = await (admin.from('invites') as ReturnType<typeof admin.from>)
    .select(`
      id,
      recipient_name,
      status,
      event:timeline_events(id, title, full_entry, year, year_end),
      sender:contributors!invites_sender_id_fkey(name)
    `)
    .eq('id', inviteId)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const typedInvite = invite as InviteResult;

  // Look up relationship from event_references
  // This tells us *the recipient's* relationship to Val
  let relationshipToSubject: string | null = null;
  const eventId = (typedInvite.event as { id?: string } | null)?.id;
  if (eventId) {
    type RefResult = {
      relationship_to_subject: string | null;
      person: { canonical_name: string } | null
    };

    const { data: refs } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
      .select('relationship_to_subject, person:people(canonical_name)')
      .eq('event_id', eventId)
      .eq('type', 'person')
      .not('relationship_to_subject', 'is', null);

    if (refs && refs.length > 0) {
      // Find reference matching recipient name (case-insensitive)
      const recipientLower = typedInvite.recipient_name?.toLowerCase() || '';
      for (const ref of refs as RefResult[]) {
        if (ref.person?.canonical_name?.toLowerCase() === recipientLower) {
          relationshipToSubject = ref.relationship_to_subject;
          break;
        }
      }
    }
  }

  // Mark as opened if first time
  if (typedInvite.status === 'pending' || typedInvite.status === 'sent') {
    await (admin.from('invites') as ReturnType<typeof admin.from>)
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', inviteId);
  }

  return NextResponse.json({
    invite: {
      id: typedInvite.id,
      recipient_name: typedInvite.recipient_name,
      sender_name: typedInvite.sender?.name || 'Someone',
      relationship_to_subject: relationshipToSubject,
      event: typedInvite.event ? {
        ...typedInvite.event,
        content: (typedInvite.event as unknown as { full_entry?: string }).full_entry || '',
      } : null,
    },
  });
}

// POST: Submit a response to an invite
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invite_id, name, content } = body;

    if (!invite_id || !name?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    type InviteRow = { id: string; event_id: string; recipient_name: string; recipient_contact: string | null };
    type EventRow = { year: number; year_end: number | null; life_stage: string | null; location: string | null; subject_id: string | null };
    type ContributorRow = { id: string };

    // Fetch the invite to get event details
    const { data: invite, error: inviteError } = await (admin.from('invites') as ReturnType<typeof admin.from>)
      .select('id, event_id, recipient_name, recipient_contact')
      .eq('id', invite_id)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const typedInvite = invite as InviteRow;

    // Fetch the original event to get context
    const { data: originalEvent } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .select('year, year_end, life_stage, location, subject_id')
      .eq('id', typedInvite.event_id)
      .single();

    const typedEvent = originalEvent as EventRow | null;

    // Create or find contributor for the responder
    let contributorId: string | null = null;

    const { data: existingContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
      .select('id')
      .ilike('name', name.trim())
      .single();

    if ((existingContributor as ContributorRow | null)?.id) {
      contributorId = (existingContributor as ContributorRow).id;
    } else {
      const { data: newContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .insert({ name: name.trim(), relation: 'family/friend' })
        .select('id')
        .single();
      contributorId = (newContributor as ContributorRow | null)?.id || null;
    }

    if (!contributorId) {
      return NextResponse.json(
        { error: 'Failed to create contributor' },
        { status: 500 }
      );
    }

    // Create the response as a new event linked to the original
    const { data: newEvent, error: eventError } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .insert({
        title: `Re: ${name.trim()}'s perspective`,
        full_entry: content.trim(),
        preview: content.trim().slice(0, 200),
        type: 'memory',
        status: 'published',
        year: typedEvent?.year || new Date().getFullYear(),
        year_end: typedEvent?.year_end,
        life_stage: typedEvent?.life_stage,
        location: typedEvent?.location,
        contributor_id: contributorId,
        subject_id: typedEvent?.subject_id,
        prompted_by_event_id: typedInvite.event_id,
        source_name: 'Invited response',
        timing_certainty: 'approximate',
      })
      .select('id')
      .single();

    if (eventError || !newEvent) {
      console.error('Failed to create response event:', eventError);
      return NextResponse.json(
        { error: 'Failed to save response' },
        { status: 500 }
      );
    }

    const typedNewEvent = newEvent as { id: string };

    // Create a memory thread linking the response to the original
    // TODO: After inserting, check if original contributor has email and send notification
    await (admin.from('memory_threads') as ReturnType<typeof admin.from>).insert({
      original_event_id: typedInvite.event_id,
      response_event_id: typedNewEvent.id,
      relationship: 'perspective',
    });

    // Mark invite as contributed
    await (admin.from('invites') as ReturnType<typeof admin.from>)
      .update({
        status: 'contributed',
        contributed_at: new Date().toISOString(),
      })
      .eq('id', invite_id);

    return NextResponse.json({
      success: true,
      event_id: typedNewEvent.id,
      contributor_id: contributorId,
    });
  } catch (error) {
    console.error('Respond API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}
