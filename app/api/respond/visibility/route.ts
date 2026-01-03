/**
 * Visibility Update API - Lets invitees change how their name appears
 * ====================================================================
 *
 * POST /api/respond/visibility
 *   - Updates identity visibility for an invite recipient
 *   - Uses invite_id as authentication (they have the link)
 *   - Supports different scopes:
 *     - this_note: just this note's event_reference
 *     - by_author: trust this contributor (visibility_preferences)
 *     - all_notes: global default (people.visibility + visibility_preferences)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invite_id, identity_visibility, scope, contributor_id } = body;

    if (!invite_id) {
      return NextResponse.json({ error: 'Missing invite ID' }, { status: 400 });
    }

    const allowedVisibility = new Set(['approved', 'blurred', 'anonymized', 'removed']);
    if (!allowedVisibility.has(identity_visibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    const allowedScope = new Set(['this_note', 'by_author', 'all_notes']);
    const normalizedScope = allowedScope.has(scope) ? scope : 'this_note';

    const admin = createAdminClient();

    // Fetch the invite to get event_id and recipient_name
    type InviteRow = {
      id: string;
      event_id: string;
      recipient_name: string;
    };

    const { data: invite, error: inviteError } = await admin.from('invites')
      .select('id, event_id, recipient_name')
      .eq('id', invite_id)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const typedInvite = invite as InviteRow;

    // Find the matching reference on the original event (we need the person_id)
    type RefRow = {
      id: string;
      person_id: string | null;
      display_name: string | null;
      person: { id: string; canonical_name: string | null } | null;
      contributor: { name: string | null } | null;
    };

    const { data: refs } = await admin.from('event_references')
      .select('id, person_id, display_name, person:people(id, canonical_name), contributor:contributors(name)')
      .eq('event_id', typedInvite.event_id)
      .eq('type', 'person');

    if (!refs || refs.length === 0) {
      return NextResponse.json({ error: 'No references found' }, { status: 404 });
    }

    // Find matching reference using flexible name matching
    const recipientLower = typedInvite.recipient_name.trim().toLowerCase();
    const recipientParts = recipientLower.split(/\s+/);

    const match = (refs as unknown as RefRow[]).find((ref) => {
      const candidate = (
        ref.person?.canonical_name ||
        ref.display_name ||
        ref.contributor?.name ||
        ''
      ).toLowerCase();

      // Exact match
      if (candidate === recipientLower) return true;

      // Partial match: one contains the other
      if (candidate.includes(recipientLower) || recipientLower.includes(candidate)) return true;

      // First name match (if recipient has multiple parts)
      if (recipientParts.length > 0) {
        const candidateParts = candidate.split(/\s+/);
        if (candidateParts.some(part => recipientParts.includes(part))) return true;
      }

      return false;
    });

    if (!match) {
      return NextResponse.json({ error: 'Reference not found for this recipient' }, { status: 404 });
    }

    const personId = match.person_id || match.person?.id;

    // Handle different scopes
    if (normalizedScope === 'this_note') {
      // Just update this note's reference
      const { error: updateError } = await admin.from('event_references')
        .update({ visibility: identity_visibility })
        .eq('id', match.id);

      if (updateError) {
        console.error('Failed to update visibility:', updateError);
        return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 });
      }
    } else if (normalizedScope === 'by_author' && contributor_id && personId) {
      // Trust this specific contributor
      // Upsert into visibility_preferences
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: prefError } = await admin.from('visibility_preferences' as any)
        .upsert({
          person_id: personId,
          contributor_id: contributor_id,
          visibility: identity_visibility,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'person_id,contributor_id',
        });

      if (prefError) {
        console.error('Failed to save contributor preference:', prefError);
        return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 });
      }

      // Also update this note's reference to match
      await admin.from('event_references')
        .update({ visibility: identity_visibility })
        .eq('id', match.id);

    } else if (normalizedScope === 'all_notes' && personId) {
      // Set global default
      // 1. Update people.visibility as the fallback default
      await admin.from('people')
        .update({ visibility: identity_visibility })
        .eq('id', personId);

      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: defaultRows, error: defaultLookupError } = await admin.from('visibility_preferences' as any)
        .select('id')
        .eq('person_id', personId)
        .is('contributor_id', null)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (defaultLookupError) {
        console.error('Failed to load default preference:', defaultLookupError);
        return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 });
      }

      const existingDefault = (defaultRows as Array<{ id?: string }> | null)?.[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultQuery = admin.from('visibility_preferences' as any);
      const { error: prefError } = existingDefault?.id
        ? await defaultQuery
            .update({ visibility: identity_visibility, updated_at: now })
            .eq('id', existingDefault.id)
        : await defaultQuery
            .insert({
              person_id: personId,
              contributor_id: null,
              visibility: identity_visibility,
              created_at: now,
              updated_at: now,
            });

      if (prefError) {
        console.error('Failed to save global preference:', prefError);
        // Don't fail - we already updated people.visibility
      }

      // 3. Also update this note's reference to match
      await admin.from('event_references')
        .update({ visibility: identity_visibility })
        .eq('id', match.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visibility update error:', error);
    return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 });
  }
}
