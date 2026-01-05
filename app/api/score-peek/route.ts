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

    // Public endpoint:
    // - Unauthenticated visitors can browse published public notes.
    // - Authenticated users or valid invite sessions can also browse published family notes.
    // If an invite cookie exists but is invalid/expired, clear it and fall back to public.
    const allowFamily = Boolean(user || inviteAccess);
    const privacyLevels: Array<Database['public']['Views']['current_notes']['Row']['privacy_level']> =
      allowFamily ? ['public', 'family'] : ['public'];

    const { data, error } = await admin.from('current_notes')
      .select('id, year, year_end, title, root_event_id, chain_depth, status, privacy_level')
      .eq('status', 'published')
      .in('privacy_level', privacyLevels)
      .order('year', { ascending: true })
      .limit(100);

    if (error) {
      console.error('score-peek error:', error);
      const response = NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
      if (inviteCookieValue && !inviteAccess) {
        response.cookies.set(INVITE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return response;
    }

    const response = NextResponse.json({ events: data || [] });
    if (inviteCookieValue && !inviteAccess) {
      response.cookies.set(INVITE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    }
    return response;
  } catch (err) {
    console.error('score-peek unexpected error:', err);
    return NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
  }
}
