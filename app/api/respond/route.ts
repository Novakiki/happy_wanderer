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
import { buildTimingRawText } from '@/lib/form-validation';
import { llmReviewGate } from '@/lib/llm-review';
import { lintNote } from '@/lib/note-lint';
import { detectAndStoreMentions } from '@/lib/pending-names';
import { maskContentWithReferences } from '@/lib/name-detection';
import { redactReferences, type ReferenceRow } from '@/lib/references';
import { upsertInviteIdentityReference } from '@/lib/respond-identity';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  createInviteSessionCookie,
  inviteSessionMatchesInvite,
  INVITE_COOKIE_NAME,
  INVITE_COOKIE_TTL_SECONDS,
  readInviteSession,
} from '@/lib/invite-session';
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
  const { data } = await admin.from('profiles')
    .select('contributor_id')
    .eq('id', userId)
    .single();
  return (data as { contributor_id?: string | null } | null)?.contributor_id ?? null;
}

async function getPersonIdForContributor(admin: ReturnType<typeof createAdminClient>, contributorId: string) {
  const { data } = await admin.from('person_claims')
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
  const inviteSession = await readInviteSession(
    request.cookies.get(INVITE_COOKIE_NAME)?.value
  );
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
        const { data: person } = await admin.from('people')
          .select('visibility')
          .eq('id', personId)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prefs } = await admin.from('visibility_preferences' as any)
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
    max_uses: number | null;
    uses_count: number | null;
    expires_at: string | null;
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
  const { data: invite, error } = await admin.from('invites')
    .select(`
      id,
      recipient_name,
      status,
      max_uses,
      uses_count,
      expires_at,
      event:timeline_events(id, title, type, full_entry, year, year_end, contributor_id, contributor:contributors!timeline_events_contributor_id_fkey(name)),
      sender:contributors!invites_sender_id_fkey(name)
    `)
    .eq('id', inviteId)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const typedInvite = invite as InviteResult;
  const hasInviteSession = await inviteSessionMatchesInvite(inviteSession, inviteId);
  const maxUses = typedInvite.max_uses ?? null;
  const usesCount = typedInvite.uses_count ?? 0;

  // If the invite is expired, allow access only if the viewer has a valid invite
  // session cookie proving they previously accessed this invite.
  if (typedInvite.expires_at && new Date(typedInvite.expires_at) < new Date() && !hasInviteSession) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (maxUses !== null && usesCount >= maxUses && !hasInviteSession) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

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

    const { data: refs } = await admin.from('event_references')
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

  let mentionRows: Array<{
    mention_text: string;
    status: string | null;
    visibility: string | null;
    display_label: string | null;
  }> = [];

  if (eventId) {
    const { data: mentionData, error: mentionError } = await admin
      .from('note_mentions')
      .select('mention_text, status, visibility, display_label')
      .eq('event_id', eventId);
    if (mentionError) {
      if (mentionError.code !== 'PGRST200') {
        console.warn('Error fetching mentions:', mentionError);
      }
    } else {
      mentionRows = (mentionData ?? []) as typeof mentionRows;
    }
  }

  if (eventId && (referenceRows.length > 0 || mentionRows.length > 0)) {
    const personIds = referenceRows
      .map((ref) => ref.person?.id)
      .filter((id): id is string => Boolean(id));

    const preferencesMap: Map<string, { contributor_preference?: string | null; global_preference?: string | null }> = new Map();

    if (personIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prefQuery = admin.from('visibility_preferences' as any)
        .select('person_id, contributor_id, visibility')
        .in('person_id', personIds);

      if (senderId) {
        prefQuery = prefQuery.or(`contributor_id.eq.${senderId},contributor_id.is.null`);
      } else {
        prefQuery = prefQuery.is('contributor_id', null);
      }

      const { data: prefs } = await prefQuery;

      if (prefs) {
        for (const pref of prefs as unknown as { person_id: string; contributor_id: string | null; visibility: string }[]) {
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
    maskedContent = maskContentWithReferences(maskedContent, redactedRefs, mentionRows);
  }

  const statusUpdates: Record<string, unknown> = {};
  if (typedInvite.status === 'pending' || typedInvite.status === 'sent') {
    statusUpdates.status = 'opened';
    statusUpdates.opened_at = new Date().toISOString();
  }

  if (Object.keys(statusUpdates).length > 0) {
    await admin.from('invites')
      .update(statusUpdates)
      .eq('id', inviteId);
  }

  if (!hasInviteSession) {
    // Consume one invite "use" with optimistic concurrency + verification.
    // Without verification, concurrent requests can silently fail the `.eq('uses_count', X)` filter,
    // causing `uses_count` to lag behind reality and allowing effectively unlimited reuse.
    let currentUsesCount = usesCount;
    let didIncrement = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (maxUses !== null && currentUsesCount >= maxUses) {
        // Treat exhausted invites as "not found" to avoid leaking invite existence.
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }

      const updateQuery = admin
        .from('invites')
        .update({ uses_count: currentUsesCount + 1 })
        .eq('id', inviteId)
        .eq('uses_count', currentUsesCount)
        .select('id');

      const { data: updatedRows, error: updateError } = await updateQuery;
      if (updateError) {
        console.warn('Invite uses_count increment failed:', updateError);
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }

      if (updatedRows && updatedRows.length === 1) {
        didIncrement = true;
        break;
      }

      // Another request beat us to it; refresh and retry.
      const { data: freshInvite, error: freshError } = await admin
        .from('invites')
        .select('uses_count, max_uses, expires_at')
        .eq('id', inviteId)
        .single();

      if (freshError || !freshInvite) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }

      if (freshInvite.expires_at && new Date(freshInvite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }

      currentUsesCount = freshInvite.uses_count ?? 0;
      const freshMaxUses = freshInvite.max_uses ?? null;
      if (freshMaxUses !== null && currentUsesCount >= freshMaxUses) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
    }

    if (!didIncrement) {
      // We couldn't reliably consume a use after several retries; fail closed.
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
  }

  const response = NextResponse.json({
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

  if (!hasInviteSession) {
    const cookieValue = await createInviteSessionCookie(inviteId);
    if (cookieValue) {
      response.cookies.set(INVITE_COOKIE_NAME, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: INVITE_COOKIE_TTL_SECONDS,
      });
    }
  }

  return response;
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
    const admin = createAdminClient();

    // LLM review for safety (names are handled separately via pending references)
    const llmGate = await llmReviewGate({
      title: `Re: ${trimmedName}'s note`,
      content,
      why: '',
    });
    if (!llmGate.ok) return llmGate.response;

    const lintWarnings = await lintNote(admin, content);

    type InviteRow = {
      id: string;
      event_id: string;
      recipient_name: string;
      recipient_contact: string | null;
      max_uses: number | null;
      uses_count: number | null;
      expires_at: string | null;
    };
    type EventRow = { year: number; year_end: number | null; life_stage: string | null; location: string | null; subject_id: string | null; privacy_level: string | null };
    type ContributorRow = { id: string };

    // Fetch the invite to get event details
    const { data: invite, error: inviteError } = await admin.from('invites')
      .select('id, event_id, recipient_name, recipient_contact, max_uses, uses_count, expires_at')
      .eq('id', invite_id)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const typedInvite = invite as InviteRow;
    const inviteSession = await readInviteSession(
      request.cookies.get(INVITE_COOKIE_NAME)?.value
    );
    const hasInviteSession = await inviteSessionMatchesInvite(inviteSession, invite_id);

    if (typedInvite.expires_at && new Date(typedInvite.expires_at) < new Date() && !hasInviteSession) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const maxUses = typedInvite.max_uses ?? null;
    const usesCount = typedInvite.uses_count ?? 0;
    if (maxUses !== null && usesCount >= maxUses && !hasInviteSession) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Fetch the original event to get context
    const { data: originalEvent } = await admin.from('timeline_events')
      .select('year, year_end, life_stage, location, subject_id, privacy_level')
      .eq('id', typedInvite.event_id)
      .single();

    const typedEvent = originalEvent as EventRow | null;

    // Create or find contributor for the responder
    let contributorId: string | null = null;

    const recipientContact = typedInvite.recipient_contact?.trim().toLowerCase() || '';
    const recipientEmail = recipientContact.includes('@') ? recipientContact : null;

    if (recipientEmail) {
      const { data: existingContributor } = await admin.from('contributors')
        .select('id')
        .ilike('email', recipientEmail)
        .single();

      if ((existingContributor as ContributorRow | null)?.id) {
        contributorId = (existingContributor as ContributorRow).id;
      }
    }

    if (!contributorId) {
      const { data: newContributor } = await admin.from('contributors')
        .insert({
          name: trimmedName,
          relation: 'family/friend',
          email: recipientEmail,
        })
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
    const timingInputType = typedEvent?.year_end ? 'year_range' : 'year';
    const timingRawText = buildTimingRawText({
      timingInputType,
      year: typedEvent?.year ?? null,
      yearEnd: typedEvent?.year_end ?? null,
    });

    // Create the response as a new event linked to the original
    const previewText = generatePreviewFromHtml(content, PREVIEW_MAX_LENGTH);
    const { data: newEvent, error: eventError } = await admin.from('timeline_events')
      .insert({
        title: `Re: ${trimmedName}'s note`,
        full_entry: content.trim(),
        preview: previewText,
        type: 'memory',
        status: 'pending',
        year: typedEvent?.year || new Date().getFullYear(),
        year_end: typedEvent?.year_end,
        life_stage: typedEvent?.life_stage,
        location: typedEvent?.location,
        contributor_id: contributorId,
        subject_id: typedEvent?.subject_id,
        prompted_by_event_id: typedInvite.event_id,
        privacy_level: typedEvent?.privacy_level || 'family',
        source_name: 'Invited response',
        timing_certainty: 'approximate',
        timing_raw_text: timingRawText,
        witness_type: 'direct',
        recurrence: 'one_time',
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
    await admin.from('memory_threads').insert({
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
    await admin.from('invites')
      .update({
        status: 'contributed',
        contributed_at: new Date().toISOString(),
      })
      .eq('id', invite_id);

    // Detect names in content and create pending references for those without consent
    const nameResult = await detectAndStoreMentions(
      content.trim(),
      typedNewEvent.id,
      admin,
      contributorId
    );

    return NextResponse.json({
      success: true,
      event_id: typedNewEvent.id,
      contributor_id: contributorId,
      mentionCandidates: nameResult.mentions,
      lintWarnings,
    });
  } catch (error) {
    console.error('Respond API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}
