import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { INVITE_COOKIE_NAME, validateInviteSession } from '@/lib/invite-session';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const inviteCookieValue = request.cookies.get(INVITE_COOKIE_NAME)?.value;
    const inviteAccess = !user && inviteCookieValue
      ? await validateInviteSession(inviteCookieValue)
      : null;

    if (!user && !inviteAccess) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (inviteCookieValue) {
        response.cookies.set(INVITE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return response;
    }

    const { data, error } = await admin.from('current_notes')
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
