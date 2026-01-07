import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';

const ALLOWED_STATUS = new Set(['approved', 'declined']);

export async function PATCH(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const status = body?.status;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing request id.' }, { status: 400 });
  }

  if (!status || typeof status !== 'string' || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: requestRow, error: requestError } = await admin
    .from('trust_requests')
    .select('id, contributor_id')
    .eq('id', id)
    .single();

  if (requestError || !requestRow?.id) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('contributor_id')
    .eq('id', adminUser.id)
    .single();

  const resolvedBy = profile?.contributor_id || null;

  const { error: updateError } = await admin
    .from('trust_requests')
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('id', id);

  if (updateError) {
    console.error('Trust request update error:', updateError);
    return NextResponse.json({ error: 'Could not update request.' }, { status: 500 });
  }

  if (status === 'approved' && requestRow.contributor_id) {
    const { error: contributorError } = await admin
      .from('contributors')
      .update({ trusted: true })
      .eq('id', requestRow.contributor_id);

    if (contributorError) {
      console.error('Contributor trust update error:', contributorError);
      return NextResponse.json({ error: 'Could not update contributor.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
