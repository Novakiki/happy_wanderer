import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, event_id } = body;

    if (!token || !event_id) {
      return NextResponse.json({ error: 'Missing token or event' }, { status: 400 });
    }

    // Validate the edit token
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

    // Verify the event belongs to this contributor
    const { data: event }: { data: { id: string; contributor_id: string | null } | null } = await admin
      .from('timeline_events')
      .select('id, contributor_id')
      .eq('id', event_id)
      .single();

    if (!event?.id || event.contributor_id !== tokenRow.contributor_id) {
      return NextResponse.json({ error: 'Not authorized to delete this note' }, { status: 403 });
    }

    // Delete related records first (foreign key constraints)
    await admin.from('event_references').delete().eq('event_id', event_id);

    // Delete the event itself
    const { error: deleteError } = await admin
      .from('timeline_events')
      .delete()
      .eq('id', event_id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
