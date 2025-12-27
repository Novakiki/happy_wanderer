import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { redactReferences } from '@/lib/references';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Disambiguate contributor relationship (timeline_events has multiple FKs to contributors)
    const baseSelect = `
      *,
      contributor:contributors!timeline_events_contributor_id_fkey(name, relation),
      media:event_media(media:media(*))
    `;
    const selectWithReferences = `
      ${baseSelect},
      references:event_references(id, type, url, display_name, role, note, visibility, relationship_to_subject, person:people(id, canonical_name, visibility), contributor:contributors!event_references_contributor_id_fkey(name))
    `;

    const eventsResult = await admin
      .from('timeline_events')
      .select(selectWithReferences)
      .eq('status', 'published')
      .order('year', { ascending: true });

    if (eventsResult.error?.code === 'PGRST200') {
      const fallback = await admin
        .from('timeline_events')
        .select(baseSelect)
        .eq('status', 'published')
        .order('year', { ascending: true });
      if (fallback.error) {
        console.error('Score fetch error', { eventsError: fallback.error });
        return NextResponse.json({ events: [] }, { status: 500 });
      }
      return NextResponse.json({ events: fallback.data || [] });
    }

    if (eventsResult.error) {
      console.error('Score fetch error', { eventsError: eventsResult.error });
      return NextResponse.json({ events: [] }, { status: 500 });
    }

    // Redact private names before sending to client
    const events = (eventsResult.data || []).map((event: any) => ({
      ...event,
      references: redactReferences(event.references),
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
