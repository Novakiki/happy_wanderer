import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';

const ALLOWED_STATUS = new Set(['pending', 'published', 'private']);

export async function PATCH(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const status = body?.status;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing note id.' }, { status: 400 });
  }

  if (!status || typeof status !== 'string' || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('timeline_events')
    .update({ status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Could not update note.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
