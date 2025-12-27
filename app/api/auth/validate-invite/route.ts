import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Look up the invite code (case-insensitive)
    const { data: inviteCode, error } = await (admin.from('invite_codes') as ReturnType<typeof admin.from>)
      .select('id, code, uses_remaining, expires_at')
      .ilike('code', code.trim())
      .single() as { data: { id: string; code: string; uses_remaining: number | null; expires_at: string | null } | null; error: unknown };

    if (error || !inviteCode) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
    }

    // Check if expired
    if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite code has expired' }, { status: 400 });
    }

    // Check if uses remaining
    if (inviteCode.uses_remaining !== null && inviteCode.uses_remaining <= 0) {
      return NextResponse.json({ error: 'This invite code has been used up' }, { status: 400 });
    }

    // Optionally decrement uses_remaining (uncomment if you want to track usage)
    // if (inviteCode.uses_remaining !== null) {
    //   await admin
    //     .from('invite_codes')
    //     .update({ uses_remaining: inviteCode.uses_remaining - 1 })
    //     .eq('id', inviteCode.id);
    // }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Validate invite error:', error);
    return NextResponse.json({ error: 'Failed to validate invite code' }, { status: 500 });
  }
}
