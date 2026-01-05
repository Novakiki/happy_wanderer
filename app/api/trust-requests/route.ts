import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { readEditSession } from '@/lib/edit-session';

const MAX_MESSAGE_LENGTH = 400;

async function getContributorId(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('contributor_id')
      .eq('id', user.id)
      .single();

    if (profile?.contributor_id) {
      return profile.contributor_id as string;
    }
  }

  const editCookie = request.cookies.get('vals-memory-edit')?.value;
  const editSession = readEditSession(editCookie);
  if (!editSession?.token) return null;

  const admin = createAdminClient();
  const { data: tokenRow } = await ((admin.from('edit_tokens') as unknown) as ReturnType<typeof admin.from>)
    .select('contributor_id, expires_at')
    .eq('token', editSession.token)
    .single();

  if (!tokenRow?.contributor_id) return null;
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return null;
  }

  return tokenRow.contributor_id as string;
}

export async function POST(request: NextRequest) {
  try {
    const contributorId = await getContributorId(request);
    if (!contributorId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawMessage = typeof body?.message === 'string' ? body.message.trim() : '';
    const message = rawMessage ? rawMessage.slice(0, MAX_MESSAGE_LENGTH) : null;

    const admin = createAdminClient();

    const { data: contributor } = await admin
      .from('contributors')
      .select('trusted')
      .eq('id', contributorId)
      .single();

    if (contributor?.trusted) {
      return NextResponse.json({ error: 'Already trusted' }, { status: 400 });
    }

    const { data: pendingRows } = await ((admin.from('trust_requests') as unknown) as ReturnType<typeof admin.from>)
      .select('id, status')
      .eq('contributor_id', contributorId)
      .eq('status', 'pending')
      .limit(1);

    const pending = Array.isArray(pendingRows) ? pendingRows[0] : null;
    if (pending?.id) {
      return NextResponse.json({ ok: true, id: pending.id, status: pending.status });
    }

    const { data: requestRow, error } = await ((admin.from('trust_requests') as unknown) as ReturnType<typeof admin.from>)
      .insert({
        contributor_id: contributorId,
        message,
      })
      .select('id, status')
      .single();

    if (error) {
      console.error('Trust request insert error:', error);
      return NextResponse.json({ error: 'Could not create request' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: requestRow?.id, status: requestRow?.status });
  } catch (error) {
    console.error('Trust request error:', error);
    return NextResponse.json({ error: 'Could not create request' }, { status: 500 });
  }
}
