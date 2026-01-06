/**
 * Claim Verify API - Validates claim tokens and processes visibility choices
 * ===========================================================================
 *
 * GET /api/claim/verify?token={token}
 *   - Validates claim token and returns event context for the claim page
 *   - Similar to GET /api/respond flow
 *
 * POST /api/claim/verify
 *   - Processes visibility choice, updates event_references
 *   - Marks token as used
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

type ClaimTokenRow = {
  id: string;
  token: string;
  invite_id: string | null;
  person_id: string | null;
  recipient_name: string;
  event_id: string;
  expires_at: string;
  used_at: string | null;
};

type EventRow = {
  id: string;
  title: string;
  preview: string | null;
  year: number;
  year_end: number | null;
  contributor: { id: string; name: string } | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch claim token
  const { data: claim, error: claimError } = await admin
    .from('claim_tokens')
    .select('id, token, invite_id, person_id, recipient_name, event_id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (claimError || !claim) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const typedClaim = claim as unknown as ClaimTokenRow;

  // Check expiration
  if (typedClaim.expires_at && new Date(typedClaim.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 404 });
  }

  // Fetch event details
  const { data: event, error: eventError } = await admin
    .from('timeline_events')
    .select('id, title, preview, year, year_end, contributor:contributors!timeline_events_contributor_id_fkey(id, name)')
    .eq('id', typedClaim.event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const typedEvent = event as unknown as EventRow;

  return NextResponse.json({
    claim: {
      id: typedClaim.id,
      recipient_name: typedClaim.recipient_name,
      already_used: Boolean(typedClaim.used_at),
    },
    event: {
      id: typedEvent.id,
      title: typedEvent.title,
      preview: typedEvent.preview,
      year: typedEvent.year,
      year_end: typedEvent.year_end,
      contributor_id: typedEvent.contributor?.id || null,
      contributor_name: typedEvent.contributor?.name || 'Someone',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, visibility, scope } = body;

    // Validate inputs
    const allowedVisibility = new Set(['approved', 'blurred', 'anonymized', 'removed']);
    const allowedScope = new Set(['this_note', 'by_author', 'all_notes']);

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!allowedVisibility.has(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    const normalizedScope = allowedScope.has(scope) ? scope : 'this_note';

    const admin = createAdminClient();

    // Fetch and validate claim token
    const { data: claim, error: claimError } = await admin
      .from('claim_tokens')
      .select('id, invite_id, person_id, recipient_name, event_id, expires_at')
      .eq('token', token)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const typedClaim = claim as unknown as ClaimTokenRow;

    // Check expiration
    if (typedClaim.expires_at && new Date(typedClaim.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 404 });
    }

    // Find the matching event_reference for this person
    type RefRow = {
      id: string;
      person_id: string | null;
      display_name: string | null;
      person: { id: string; canonical_name: string | null } | null;
    };

    const { data: refs } = await admin
      .from('event_references')
      .select('id, person_id, display_name, person:people(id, canonical_name)')
      .eq('event_id', typedClaim.event_id)
      .eq('type', 'person');

    if (!refs || refs.length === 0) {
      return NextResponse.json({ error: 'No references found' }, { status: 404 });
    }

    const typedRefs = refs as unknown as RefRow[];

    // Prefer explicit linkage via claim.person_id when available.
    let match: RefRow | undefined;
    if (typedClaim.person_id) {
      match = typedRefs.find((ref) =>
        ref.person_id === typedClaim.person_id || ref.person?.id === typedClaim.person_id
      );
    }

    // Fall back to matching by recipient name.
    if (!match) {
      const recipientLower = typedClaim.recipient_name.trim().toLowerCase();
      const recipientParts = recipientLower.split(/\s+/);

      match = typedRefs.find((ref) => {
        const candidate = (
          ref.person?.canonical_name ||
          ref.display_name ||
          ''
        ).toLowerCase();

        // Exact match
        if (candidate === recipientLower) return true;

        // Partial match: one contains the other
        if (candidate.includes(recipientLower) || recipientLower.includes(candidate)) return true;

        // First name match
        if (recipientParts.length > 0) {
          const candidateParts = candidate.split(/\s+/);
          if (candidateParts.some((part) => recipientParts.includes(part))) return true;
        }

        return false;
      });
    }

    // Last resort: if there is only one person reference on the note, assume it is the intended target.
    if (!match && typedRefs.length === 1) {
      match = typedRefs[0];
    }

    if (!match) {
      return NextResponse.json({ error: 'Reference not found for this recipient' }, { status: 404 });
    }

    const personId = match.person_id || match.person?.id || null;

    // Get contributor_id from the event for by_author scope
    let contributorId: string | null = null;
    if (normalizedScope === 'by_author') {
      const { data: event } = await admin
        .from('timeline_events')
        .select('contributor_id')
        .eq('id', typedClaim.event_id)
        .single();
      contributorId = (event as { contributor_id: string | null } | null)?.contributor_id || null;
    }

    // Handle different scopes (same logic as /api/respond/visibility)
    if (normalizedScope === 'this_note') {
      await admin
        .from('event_references')
        .update({ visibility })
        .eq('id', match.id);
    } else if (normalizedScope === 'by_author' && contributorId && personId) {
      await admin.from('visibility_preferences').upsert(
        {
          person_id: personId,
          contributor_id: contributorId,
          visibility,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'person_id,contributor_id' }
      );

      await admin
        .from('event_references')
        .update({ visibility })
        .eq('id', match.id);
    } else if (normalizedScope === 'all_notes' && personId) {
      // Update people.visibility as fallback default
      await admin.from('people').update({ visibility }).eq('id', personId);

      // Upsert global visibility_preference
      const now = new Date().toISOString();
      const { data: existing } = await admin
        .from('visibility_preferences')
        .select('id')
        .eq('person_id', personId)
        .is('contributor_id', null)
        .limit(1);

      const existingId = (existing as Array<{ id: string }> | null)?.[0]?.id;

      if (existingId) {
        await admin
          .from('visibility_preferences')
          .update({ visibility, updated_at: now })
          .eq('id', existingId);
      } else {
        await admin.from('visibility_preferences').insert({
          person_id: personId,
          contributor_id: null,
          visibility,
          created_at: now,
          updated_at: now,
        });
      }

      await admin
        .from('event_references')
        .update({ visibility })
        .eq('id', match.id);
    }

    // Mark token as used
    await admin
      .from('claim_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', typedClaim.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Claim verify error:', error);
    return NextResponse.json({ error: 'Failed to process claim' }, { status: 500 });
  }
}
