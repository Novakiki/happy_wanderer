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

    if (noteIds.length === 0) {
      return NextResponse.json({ error: 'noteIds required' }, { status: 400 });
    }

    const { error } = await admin
      .from('timeline_events')
      .delete()
      .in('id', noteIds);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete fixtures' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: noteIds.length });
  } catch (error) {
    console.error('Fixture cleanup error:', error);
    return NextResponse.json({ error: 'Failed to cleanup fixtures' }, { status: 500 });
  }
}
