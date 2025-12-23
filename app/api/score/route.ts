import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const [{ data: events, error: eventsError }, { data: themes, error: themesError }] =
      await Promise.all([
        admin
          .from('timeline_events')
          .select(
            `
            *,
            contributor:contributors(name, relation),
            themes:event_themes(theme:themes(id, label))
          `
          )
          .eq('status', 'published')
          .order('year', { ascending: true }),
        admin.from('themes').select('*').order('label'),
      ]);

    if (eventsError || themesError) {
      console.error('Score fetch error', { eventsError, themesError });
      return NextResponse.json({ events: [], themes: [] }, { status: 500 });
    }

    return NextResponse.json({ events: events || [], themes: themes || [] });
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json({ events: [], themes: [] }, { status: 500 });
  }
}
