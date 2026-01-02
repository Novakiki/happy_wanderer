import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { createPersonLookupHelpers } from '@/lib/person-lookup';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

type MentionAction = 'context' | 'ignore' | 'promote';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, mention_id, action, display_label } = body as {
      token?: string;
      mention_id?: string;
      action?: MentionAction;
      display_label?: string | null;
    };

    if (!token || !mention_id || !action) {
      return NextResponse.json({ error: 'Missing token, mention_id, or action' }, { status: 400 });
    }

    const { data: tokenRow }: {
      data: { id: string; contributor_id: string | null; expires_at: string | null } | null;
    } = await admin
      .from('edit_tokens')
      .select('id, contributor_id, expires_at')
      .eq('token', token)
      .single();

    if (!tokenRow?.contributor_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    const { data: mentionRow }: {
      data: {
        id: string;
        event_id: string;
        mention_text: string;
        status: string | null;
        visibility: string | null;
        display_label: string | null;
        promoted_person_id: string | null;
      } | null;
    } = await admin
      .from('note_mentions')
      .select('id, event_id, mention_text, status, visibility, display_label, promoted_person_id')
      .eq('id', mention_id)
      .single();

    if (!mentionRow) {
      return NextResponse.json({ error: 'Mention not found' }, { status: 404 });
    }

    const { data: eventRow }: { data: { contributor_id: string | null } | null } = await admin
      .from('timeline_events')
      .select('contributor_id')
      .eq('id', mentionRow.event_id)
      .single();

    if (!eventRow?.contributor_id || eventRow.contributor_id !== tokenRow.contributor_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (action === 'context') {
      const { data: updated, error } = await admin
        .from('note_mentions')
        .update({
          status: 'context',
          visibility: 'anonymized',
          display_label: display_label?.trim() || null,
        })
        .eq('id', mentionRow.id)
        .select('id, mention_text, status, visibility, display_label, promoted_person_id')
        .single();

      if (error) {
        console.error('Mention context update error:', error);
        return NextResponse.json({ error: 'Failed to update mention' }, { status: 500 });
      }

      return NextResponse.json({ success: true, mention: updated });
    }

    if (action === 'ignore') {
      const { data: updated, error } = await admin
        .from('note_mentions')
        .update({
          status: 'ignored',
        })
        .eq('id', mentionRow.id)
        .select('id, mention_text, status, visibility, display_label, promoted_person_id')
        .single();

      if (error) {
        console.error('Mention ignore update error:', error);
        return NextResponse.json({ error: 'Failed to update mention' }, { status: 500 });
      }

      return NextResponse.json({ success: true, mention: updated });
    }

    if (action === 'promote') {
      const { resolvePersonIdByName } = createPersonLookupHelpers(admin, tokenRow.contributor_id);
      const personId = await resolvePersonIdByName(mentionRow.mention_text);

      if (!personId) {
        return NextResponse.json({ error: 'Could not resolve person' }, { status: 400 });
      }

      const { data: existingRef } = await admin
        .from('event_references')
        .select('id, person_id, role, visibility, relationship_to_subject, person:people(id, canonical_name)')
        .eq('event_id', mentionRow.event_id)
        .eq('person_id', personId)
        .limit(1);

      let reference = existingRef && existingRef.length > 0 ? existingRef[0] : null;

      if (!reference) {
        const { data: refRow, error: refError } = await admin
          .from('event_references')
          .insert({
            event_id: mentionRow.event_id,
            type: 'person',
            person_id: personId,
            role: 'related',
            visibility: 'pending',
            added_by: tokenRow.contributor_id,
          })
          .select('id, person_id, role, visibility, relationship_to_subject, person:people(id, canonical_name)')
          .single();

        if (refError) {
          console.error('Mention promote reference error:', refError);
          return NextResponse.json({ error: 'Failed to promote mention' }, { status: 500 });
        }

        reference = refRow;
      }

      const { data: updated, error: updateError } = await admin
        .from('note_mentions')
        .update({
          status: 'promoted',
          promoted_person_id: personId,
          promoted_reference_id: reference?.id ?? null,
        })
        .eq('id', mentionRow.id)
        .select('id, mention_text, status, visibility, display_label, promoted_person_id')
        .single();

      if (updateError) {
        console.error('Mention promote update error:', updateError);
        return NextResponse.json({ error: 'Failed to update mention' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        mention: updated,
        reference: reference
          ? {
              id: reference.id,
              person: {
                id: reference.person?.id ?? reference.person_id,
                name: reference.person?.canonical_name,
              },
            }
          : null,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Mention API error:', error);
    return NextResponse.json({ error: 'Failed to update mention' }, { status: 500 });
  }
}
