import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

type PersonNode = {
  id: string;
  name?: string;
  relationship?: string;
  role: 'wrote' | 'responded' | 'invited' | 'mentioned';
};

// GET: Fetch people connected to an event (for the graph)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('event_id');
  const excludeInviteId = searchParams.get('exclude_invite'); // Don't include the current viewer's invite

  if (!eventId) {
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const people: PersonNode[] = [];
  const seenIds = new Set<string>();

  // 1. Get the event author
  type EventWithContributor = {
    contributor_id: string | null;
    contributor: { id: string; name: string } | null;
  };

  const { data: event } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
    .select('contributor_id, contributor:contributors(id, name)')
    .eq('id', eventId)
    .single();

  const typedEvent = event as EventWithContributor | null;
  if (typedEvent?.contributor?.id && typedEvent?.contributor?.name) {
    const authorId = typedEvent.contributor.id;
    if (!seenIds.has(authorId)) {
      seenIds.add(authorId);
      // Check visibility via person_claims -> people
      const visibility = await getContributorVisibility(admin, authorId);
      people.push({
        id: authorId,
        name: visibility === 'approved' ? typedEvent.contributor.name : undefined,
        role: 'wrote',
      });
    }
  }

  // 2. Get responses via memory_threads
  type ThreadWithEvent = {
    response_event_id: string;
    response_event: {
      contributor_id: string | null;
      contributor: { id: string; name: string; relation: string } | null;
    } | null;
  };

  const { data: threads } = await (admin.from('memory_threads') as ReturnType<typeof admin.from>)
    .select(`
      response_event_id,
      response_event:timeline_events!memory_threads_response_event_id_fkey(
        contributor_id,
        contributor:contributors(id, name, relation)
      )
    `)
    .eq('original_event_id', eventId);

  if (threads) {
    for (const thread of threads as ThreadWithEvent[]) {
      const contributor = thread.response_event?.contributor;
      if (contributor && !seenIds.has(contributor.id)) {
        seenIds.add(contributor.id);
        const visibility = await getContributorVisibility(admin, contributor.id);
        people.push({
          id: contributor.id,
          name: visibility === 'approved' ? contributor.name : undefined,
          relationship: contributor.relation || undefined,
          role: 'responded',
        });
      }
    }
  }

  // 3. Get invited people (status = 'contributed' means they responded)
  type InviteRow = {
    id: string;
    recipient_name: string;
    status: string;
  };

  let invitesQuery = (admin.from('invites') as ReturnType<typeof admin.from>)
    .select('id, recipient_name, status')
    .eq('event_id', eventId)
    .in('status', ['contributed', 'opened']);

  // Exclude the current viewer's invite
  if (excludeInviteId) {
    invitesQuery = invitesQuery.neq('id', excludeInviteId);
  }

  const { data: invites } = await invitesQuery;

  if (invites) {
    for (const invite of invites as InviteRow[]) {
      // Use invite id as unique key since we don't have contributor_id yet
      const inviteKey = `invite-${invite.id}`;
      if (!seenIds.has(inviteKey)) {
        seenIds.add(inviteKey);
        // Invited people haven't given visibility permission yet
        // Their relationship comes from event_references if available
        const relationship = await getInviteeRelationship(admin, eventId, invite.recipient_name);
        people.push({
          id: inviteKey,
          // Don't show name for invitees - they haven't given permission
          relationship: relationship || undefined,
          role: invite.status === 'contributed' ? 'responded' : 'invited',
        });
      }
    }
  }

  // 4. Get person references on the event (people mentioned/referenced)
  type RefRow = {
    person_id: string | null;
    relationship_to_subject: string | null;
    person: { id: string; canonical_name: string; visibility: string } | null;
  };

  const { data: refs } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
    .select('person_id, relationship_to_subject, person:people(id, canonical_name, visibility)')
    .eq('event_id', eventId)
    .eq('type', 'person');

  if (refs) {
    for (const ref of refs as RefRow[]) {
      if (ref.person && !seenIds.has(ref.person.id)) {
        seenIds.add(ref.person.id);
        people.push({
          id: ref.person.id,
          name: ref.person.visibility === 'approved' ? ref.person.canonical_name : undefined,
          relationship: ref.relationship_to_subject || undefined,
          role: 'mentioned',
        });
      }
    }
  }

  return NextResponse.json({ people });
}

// Helper: Get visibility status for a contributor via person_claims
async function getContributorVisibility(
  admin: ReturnType<typeof createAdminClient>,
  contributorId: string
): Promise<string> {
  type ClaimWithPerson = {
    person: { visibility: string } | null;
  };

  const { data: claim } = await (admin.from('person_claims') as ReturnType<typeof admin.from>)
    .select('person:people(visibility)')
    .eq('contributor_id', contributorId)
    .single();

  const typedClaim = claim as ClaimWithPerson | null;
  return typedClaim?.person?.visibility || 'pending';
}

// Helper: Get relationship for an invitee from event_references
async function getInviteeRelationship(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  recipientName: string
): Promise<string | null> {
  type RefResult = {
    relationship_to_subject: string | null;
    person: { canonical_name: string } | null;
  };

  const { data: refs } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
    .select('relationship_to_subject, person:people(canonical_name)')
    .eq('event_id', eventId)
    .eq('type', 'person');

  if (refs) {
    const recipientLower = recipientName.toLowerCase();
    for (const ref of refs as RefResult[]) {
      if (ref.person?.canonical_name?.toLowerCase() === recipientLower) {
        return ref.relationship_to_subject;
      }
    }
  }
  return null;
}
