import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data, error } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .select('id, year, year_end, title, root_event_id, chain_depth, status, privacy_level')
      .eq('status', 'published')
      .in('privacy_level', ['public', 'family'])
      .order('year', { ascending: true })
      .limit(100);

    if (error) {
      console.error('score-peek error:', error);
      return NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
    }

    return NextResponse.json({ events: data || [] });
  } catch (err) {
    console.error('score-peek unexpected error:', err);
    return NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
  }
}
