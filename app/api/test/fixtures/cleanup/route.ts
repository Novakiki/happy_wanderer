import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
const fixtureKey = process.env.E2E_FIXTURE_KEY;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

const admin = supabaseUrl && supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey)
  : null;

function isAuthorized(request: Request) {
  const key = request.headers.get('x-e2e-fixture-key');
  return fixtureEnabled && fixtureKey && key === fixtureKey;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!admin) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const noteIds = Array.isArray(body?.noteIds) ? body.noteIds : [];
    const inviteIds = Array.isArray(body?.inviteIds) ? body.inviteIds : [];
    const titlePrefix = typeof body?.titlePrefix === 'string' ? body.titlePrefix.trim() : '';

    let resolvedNoteIds = noteIds.slice();

    if (titlePrefix) {
      const { data: rows, error: titleError } = await admin
        .from('timeline_events')
        .select('id')
        .ilike('title', `${titlePrefix}%`);

      if (titleError) {
        return NextResponse.json({ error: 'Failed to resolve note fixtures' }, { status: 500 });
      }

      const idsFromTitle = (rows || [])
        .map((row) => (row as { id?: string } | null)?.id)
        .filter(Boolean) as string[];

      resolvedNoteIds = Array.from(new Set([...resolvedNoteIds, ...idsFromTitle]));
    }

    if (resolvedNoteIds.length === 0 && inviteIds.length === 0) {
      return NextResponse.json({ error: 'noteIds, titlePrefix, or inviteIds required' }, { status: 400 });
    }

    if (inviteIds.length > 0) {
      const { error: inviteError } = await admin
        .from('invites')
        .delete()
        .in('id', inviteIds);

      if (inviteError) {
        return NextResponse.json({ error: 'Failed to delete invite fixtures' }, { status: 500 });
      }
    }

    if (resolvedNoteIds.length > 0) {
      // Delete references first (should also cascade, but this avoids constraint issues if schema changes).
      const { error: referencesError } = await admin
        .from('event_references')
        .delete()
        .in('event_id', resolvedNoteIds);

      if (referencesError) {
        return NextResponse.json(
          { error: 'Failed to delete note reference fixtures' },
          { status: 500 }
        );
      }

      const { error: noteError } = await admin
        .from('timeline_events')
        .delete()
        .in('id', resolvedNoteIds);

      if (noteError) {
        return NextResponse.json({ error: 'Failed to delete note fixtures' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      deleted: {
        notes: resolvedNoteIds.length,
        invites: inviteIds.length,
      },
    });
  } catch (error) {
    console.error('Fixture cleanup error:', error);
    return NextResponse.json({ error: 'Failed to cleanup fixtures' }, { status: 500 });
  }
}
