import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const contributorId = body?.contributor_id;
  const trusted = body?.trusted;

  if (!contributorId || typeof contributorId !== 'string') {
    return NextResponse.json({ error: 'Missing contributor id.' }, { status: 400 });
  }

  if (typeof trusted !== 'boolean') {
    return NextResponse.json({ error: 'Invalid trusted value.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('contributors')
    .update({ trusted })
    .eq('id', contributorId);

  if (error) {
    return NextResponse.json({ error: 'Could not update contributor.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
