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
  const name = body?.name;
  const relation = body?.relation;
  const email = body?.email;
  const phone = body?.phone;
  const disabled = body?.disabled;

  if (!contributorId || typeof contributorId !== 'string') {
    return NextResponse.json({ error: 'Missing contributor id.' }, { status: 400 });
  }

  const hasTrustedUpdate = typeof trusted === 'boolean';
  const hasDisabledUpdate = typeof disabled === 'boolean';
  const hasNameUpdate = typeof name === 'string';
  const hasRelationUpdate = typeof relation === 'string';
  const hasEmailUpdate = typeof email === 'string' || email === null;
  const hasPhoneUpdate = typeof phone === 'string' || phone === null;

  if (
    !hasTrustedUpdate &&
    !hasDisabledUpdate &&
    !hasNameUpdate &&
    !hasRelationUpdate &&
    !hasEmailUpdate &&
    !hasPhoneUpdate
  ) {
    return NextResponse.json({ error: 'No updates provided.' }, { status: 400 });
  }

  if (hasNameUpdate && !name.trim()) {
    return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
  }

  if (hasRelationUpdate && !relation.trim()) {
    return NextResponse.json({ error: 'Relationship cannot be empty.' }, { status: 400 });
  }

  if (hasEmailUpdate && typeof email === 'string' && email.trim() === '') {
    return NextResponse.json({ error: 'Email cannot be blank. Use null to clear.' }, { status: 400 });
  }

  if (hasPhoneUpdate && typeof phone === 'string' && phone.trim() === '') {
    return NextResponse.json({ error: 'Phone cannot be blank. Use null to clear.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (hasTrustedUpdate) updates.trusted = trusted;
  if (hasNameUpdate) updates.name = name.trim();
  if (hasRelationUpdate) updates.relation = relation.trim();
  if (hasEmailUpdate) updates.email = email === null ? null : email.trim();
  if (hasPhoneUpdate) updates.phone = phone === null ? null : phone.trim();
  if (hasDisabledUpdate) updates.disabled_at = disabled ? new Date().toISOString() : null;

  const { error } = await ((admin.from('contributors') as unknown) as ReturnType<typeof admin.from>)
    .update(updates)
    .eq('id', contributorId);

  if (error) {
    return NextResponse.json({ error: 'Could not update contributor.' }, { status: 500 });
  }

  // Keep profiles in sync for any linked auth users.
  if (hasNameUpdate || hasRelationUpdate || hasEmailUpdate) {
    const profileUpdates: Record<string, unknown> = {};
    if (hasNameUpdate) profileUpdates.name = name.trim();
    if (hasRelationUpdate) profileUpdates.relation = relation.trim();
    if (hasEmailUpdate) profileUpdates.email = email === null ? null : email.trim();

    const { error: profileError } = await ((admin.from('profiles') as unknown) as ReturnType<typeof admin.from>)
      .update(profileUpdates)
      .eq('contributor_id', contributorId);

    if (profileError) {
      // Non-fatal: contributor is the main display name used for note attribution.
      console.error('Could not sync profiles for contributor update:', profileError);
    }
  }

  return NextResponse.json({ ok: true });
}
