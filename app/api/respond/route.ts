/**
 * Respond API - Handles Invited User Responses
 * =============================================
 *
 * PURPOSE:
 * This API powers the "chain mail" invite system, allowing invited users
 * to respond to memories they were mentioned in WITHOUT authentication.
 *
 * ENDPOINTS:
 *
 * GET /api/respond?id={inviteId}
 *   - Fetches invite details for the respond page
 *   - Returns: original memory, sender name, recipient's relationship to Val
 *   - Marks invite as "opened" on first access
 *
 * POST /api/respond
 *   - Submits a response to an invite
 *   - Creates: contributor record (if new), timeline_event, memory_thread link
 *   - Marks invite as "contributed"
 *   - Returns: contributor_id (for optional email capture)
 *
 * FLOW CONTEXT:
 * This is the backend for /respond/[id]/page.tsx. Invited users:
 * 1. Click SMS link → GET loads context
 * 2. Submit response → POST creates linked memory
 * 3. See success with signup prompt (handled by frontend)
 *
 * The response creates a FULL timeline_event (not a comment) that is:
 * - Linked to original via memory_threads table
 * - Marked with prompted_by_event_id
 * - Inherits year/location from original for timeline placement
 *
 * DESIGN DECISIONS:
 * - No auth required: Friction reduction for first-time responders
 * - Simple input: Only name + content (not full MemoryForm fields)
 * - Creates real memory: Shows in timeline, can be built upon
 * - Contributor record: Enables future identity claim via signup
 *
 * RELATED FILES:
 * - /app/respond/[id]/page.tsx - Frontend respond page
 * - /lib/invites.ts - Invite creation helpers
 * - /app/api/memories/route.ts - Where invites are created during memory submission
 */
import { generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from '@/lib/html-utils';
import { runLlmReview, type LlmReviewResult } from '@/lib/llm-review';
import { maskContentWithReferences } from '@/lib/name-detection';
import { redactReferences, type ReferenceRow } from '@/lib/references';
import { upsertInviteIdentityReference } from '@/lib/respond-identity';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed' | 'pending';

const ALLOWED_VISIBILITY = new Set<Visibility>([
  'approved',
  'blurred',
  'anonymized',
  'removed',
  'pending',
]);

function normalizeVisibility(value: string | null | undefined): Visibility {
  if (!value) return 'pending';
  return ALLOWED_VISIBILITY.has(value as Visibility) ? (value as Visibility) : 'pending';
}

async function getContributorId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await (admin.from('profiles') as ReturnType<typeof admin.from>)
    .select('contributor_id')
    .eq('id', userId)
    .single();
  return (data as { contributor_id?: string | null } | null)?.contributor_id ?? null;
}

async function getPersonIdForContributor(admin: ReturnType<typeof createAdminClient>, contributorId: string) {
  const { data } = await (admin.from('person_claims') as ReturnType<typeof admin.from>)
    .select('person_id, status')
    .eq('contributor_id', contributorId);

  const claims = (data as Array<{ person_id: string; status: string }> | null) ?? [];
  if (!claims.length) return null;

  const approved = claims.find((claim) => claim.status === 'approved');
  return (approved ?? claims[0]).person_id;
}

/**
 * GET: Fetch invite details for the response page
 * Returns the original memory context so responder knows what they're responding to.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get('id');

  if (!inviteId) {
    return NextResponse.json({ error: 'Missing invite ID' }, { status: 400 });
  }

  const admin = createAdminClient();
  const viewerIdentity = {
    is_authenticated: false,
    has_identity: false,
    default_visibility: 'pending' as Visibility,
    default_source: 'unknown' as 'preference' | 'person' | 'unknown',
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    viewerIdentity.is_authenticated = true;
    const contributorId = await getContributorId(admin, user.id);
    if (contributorId) {
      const personId = await getPersonIdForContributor(admin, contributorId);
      if (personId) {
        viewerIdentity.has_identity = true;
        const { data: person } = await (admin.from('people') as ReturnType<typeof admin.from>)
          .select('visibility')
          .eq('id', personId)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prefs } = await (admin.from('visibility_preferences' as any) as any)
          .select('visibility')
          .eq('person_id', personId)
          .is('contributor_id', null);

        const globalPref = (prefs as Array<{ visibility: string }> | null)?.[0]?.visibility ?? null;
        const defaultVisibility = normalizeVisibility(globalPref ?? (person as { visibility?: string | null } | null)?.visibility);
        viewerIdentity.default_visibility = defaultVisibility;
        viewerIdentity.default_source = globalPref ? 'preference' : 'person';
      }
    }
  }

  type InviteResult = {
    id: string;
    recipient_name: string;
    status: string;
    event: {
      id: string;
      title: string;
      type: string;
      content: string;
      year: number;
      year_end: number | null;
      contributor_id: string | null;
      contributor: { name: string | null } | null;
    } | null;
    sender: { name: string } | null;
  };

  // Fetch the invite with related event and sender info
  const { data: invite, error } = await (admin.from('invites') as ReturnType<typeof admin.from>)
    .select(`
      id,
      recipient_name,
      status,
      event:timeline_events(id, title, type, full_entry, year, year_end, contributor_id, contributor:contributors!timeline_events_contributor_id_fkey(name)),
      sender:contributors!invites_sender_id_fkey(name)
    `)
    .eq('id', inviteId)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const typedInvite = invite as InviteResult;

  // Look up relationship + identity visibility from event_references
  // This tells us *the recipient's* relationship to Val
  let relationshipToSubject: string | null = null;
  let identityVisibility: string | null = null;
  const eventId = (typedInvite.event as { id?: string } | null)?.id;
  const senderId = typedInvite.event?.contributor_id || null;
  let referenceRows: ReferenceRow[] = [];
  if (eventId) {
    type RefResult = {
      id: string;
      type: string;
      url?: string | null;
      display_name?: string | null;
      role?: string | null;
      note?: string | null;
      relationship_to_subject: string | null;
      visibility: string | null;
      person: { id?: string; canonical_name: string | null; visibility?: string | null } | null;
      contributor: { name: string | null } | null;
      visibility_preference?: {
        contributor_preference?: string | null;
        global_preference?: string | null;
      } | null;
    };

    const { data: refs } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
      .select('id, type, url, display_name, role, note, visibility, relationship_to_subject, person:people(id, canonical_name, visibility), contributor:contributors!event_references_contributor_id_fkey(name)')
      .eq('event_id', eventId)
      .eq('type', 'person');

    if (refs && refs.length > 0) {
      referenceRows = refs as RefResult[];
      // Find reference matching recipient name using flexible matching
      const recipientLower = typedInvite.recipient_name?.toLowerCase() || '';
      const recipientParts = recipientLower.split(/\s+/).filter(Boolean);

      for (const ref of referenceRows) {
        const candidate = (
          ref.person?.canonical_name ||
          ref.display_name ||
          ref.contributor?.name ||
          ''
        ).toLowerCase();

        // Exact match
        if (candidate === recipientLower) {
          relationshipToSubject = ref.relationship_to_subject ?? null;
          identityVisibility = ref.visibility ?? null;
          break;
        }

        // Partial match: one contains the other
        if (candidate.includes(recipientLower) || recipientLower.includes(candidate)) {
          relationshipToSubject = ref.relationship_to_subject ?? null;
          identityVisibility = ref.visibility ?? null;
          break;
        }

        // First name match
        if (recipientParts.length > 0) {
          const candidateParts = candidate.split(/\s+/).filter(Boolean);
          if (candidateParts.some(part => recipientParts.includes(part))) {
            relationshipToSubject = ref.relationship_to_subject ?? null;
            identityVisibility = ref.visibility ?? null;
            break;
          }
        }
      }
    }
  }

  let maskedContent =
    (typedInvite.event as unknown as { full_entry?: string })?.full_entry || '';

  if (eventId && referenceRows.length > 0) {
    const personIds = referenceRows
      .map((ref) => ref.person?.id)
      .filter((id): id is string => Boolean(id));

    let preferencesMap: Map<string, { contributor_preference?: string | null; global_preference?: string | null }> = new Map();

    if (personIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prefQuery = (admin.from('visibility_preferences' as any) as any)
        .select('person_id, contributor_id, visibility')
        .in('person_id', personIds);

      if (senderId) {
        prefQuery = prefQuery.or(`contributor_id.eq.${senderId},contributor_id.is.null`);
      } else {
        prefQuery = prefQuery.is('contributor_id', null);
      }

      const { data: prefs } = await prefQuery;

      if (prefs) {
        for (const pref of prefs as { person_id: string; contributor_id: string | null; visibility: string }[]) {
          const existing = preferencesMap.get(pref.person_id) || {};
          if (pref.contributor_id === senderId) {
            existing.contributor_preference = pref.visibility;
          } else if (pref.contributor_id === null) {
            existing.global_preference = pref.visibility;
          }
          preferencesMap.set(pref.person_id, existing);
        }
      }
    }

    const enrichedRefs = referenceRows.map((ref) => ({
      ...ref,
      visibility_preference: ref.person?.id ? preferencesMap.get(ref.person.id) : null,
    }));

    const redactedRefs = redactReferences(enrichedRefs as ReferenceRow[], { includeAuthorPayload: true });
    maskedContent = maskContentWithReferences(maskedContent, redactedRefs);
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
      sender_name: typedInvite.sender?.name || typedInvite.event?.contributor?.name || 'Someone',
      sender_id: senderId,
      relationship_to_subject: relationshipToSubject,
      identity_visibility: identityVisibility,
      event: typedInvite.event
        ? {
            ...typedInvite.event,
            content: maskedContent,
          }
        : null,
    },
    viewer_identity: viewerIdentity,
  });
}

/**
 * POST: Submit a response to an invite
 *
 * Creates a new timeline_event linked to the original memory via memory_threads.
 * This is intentionally a simplified submission - full MemoryForm access requires signup.
 *
 * Input: { invite_id, name, content, relationship?, relationship_note? }
 * Output: { success, event_id, contributor_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      invite_id,
      name,
      content,
      relationship,
      relationship_note,
      relationship_to_subject,
      identity_visibility,
    } = body;

    if (!invite_id || !name?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    let llmResult: LlmReviewResult;
    try {
      llmResult = await runLlmReview({
        title: `Re: ${trimmedName}'s note`,
        content,
        why: '',
      });
    } catch (llmError) {
      console.error('LLM review error:', llmError);
      return NextResponse.json(
        { error: 'LLM review unavailable. Please try again.' },
        { status: 503 }
      );
    }
    if (!llmResult.approve) {
      return NextResponse.json(
        {
          error: 'LLM review blocked submission.',
          reasons: llmResult.reasons,
        },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    type InviteRow = { id: string; event_id: string; recipient_name: string; recipient_contact: string | null };
    type EventRow = { year: number; year_end: number | null; life_stage: string | null; location: string | null; subject_id: string | null; privacy_level: string | null };
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
      .select('year, year_end, life_stage, location, subject_id, privacy_level')
      .eq('id', typedInvite.event_id)
      .single();

    const typedEvent = originalEvent as EventRow | null;

    // Create or find contributor for the responder
    let contributorId: string | null = null;

    const { data: existingContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
      .select('id')
      .ilike('name', trimmedName)
      .single();

    if ((existingContributor as ContributorRow | null)?.id) {
      contributorId = (existingContributor as ContributorRow).id;
    } else {
      const { data: newContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .insert({ name: trimmedName, relation: 'family/friend' })
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

    const allowedRelationships = new Set(['perspective', 'addition', 'correction', 'related']);
    const normalizedRelationship = allowedRelationships.has(relationship) ? relationship : 'perspective';
    const trimmedRelationshipNote = typeof relationship_note === 'string' ? relationship_note.trim() : '';
    const allowedVisibility = new Set(['approved', 'blurred', 'anonymized', 'removed']);
    const normalizedVisibility = allowedVisibility.has(identity_visibility) ? identity_visibility : null;
    const trimmedRelationshipToSubject =
      typeof relationship_to_subject === 'string' ? relationship_to_subject.trim() : '';

    // Create the response as a new event linked to the original
    const previewText = generatePreviewFromHtml(content, PREVIEW_MAX_LENGTH);
    const { data: newEvent, error: eventError } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .insert({
        title: `Re: ${trimmedName}'s note`,
        full_entry: content.trim(),
        preview: previewText,
        type: 'memory',
        status: 'published',
        year: typedEvent?.year || new Date().getFullYear(),
        year_end: typedEvent?.year_end,
        life_stage: typedEvent?.life_stage,
        location: typedEvent?.location,
        contributor_id: contributorId,
        subject_id: typedEvent?.subject_id,
        prompted_by_event_id: typedInvite.event_id,
        trigger_event_id: typedInvite.event_id,
        privacy_level: typedEvent?.privacy_level || 'family',
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
      relationship: normalizedRelationship,
      note: trimmedRelationshipNote ? trimmedRelationshipNote : null,
    });

    await upsertInviteIdentityReference({
      admin,
      eventId: typedInvite.event_id,
      recipientName: typedInvite.recipient_name,
      responderName: name,
      relationshipToSubject: trimmedRelationshipToSubject || null,
      visibility: normalizedVisibility,
      contributorId,
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
