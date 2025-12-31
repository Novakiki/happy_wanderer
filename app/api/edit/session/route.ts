import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

const MAGIC_LINK_TTL_DAYS = Number(process.env.MAGIC_LINK_TTL_DAYS || 30);

function getMaxAgeSeconds() {
  if (!MAGIC_LINK_TTL_DAYS || Number.isNaN(MAGIC_LINK_TTL_DAYS)) {
    return undefined;
  }
  if (MAGIC_LINK_TTL_DAYS <= 0) return undefined;
  return Math.floor(MAGIC_LINK_TTL_DAYS * 24 * 60 * 60);
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const normalizedToken = String(token || '').trim();

    if (!normalizedToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const { data: tokenRow }: {
      data: { id: string; contributor_id: string | null; expires_at: string | null } | null;
    } = await admin
      .from('edit_tokens')
      .select('id, contributor_id, expires_at')
      .eq('token', normalizedToken)
      .single();

    if (!tokenRow?.contributor_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    const { data: contributor }: { data: { name: string | null } | null } = await admin
      .from('contributors')
      .select('name')
      .eq('id', tokenRow.contributor_id)
      .single();

    const payload = JSON.stringify({
      token: normalizedToken,
      name: contributor?.name || 'Contributor',
      contributor_id: tokenRow.contributor_id,
    });

    const response = NextResponse.json({
      success: true,
      name: contributor?.name || null,
      contributor_id: tokenRow.contributor_id,
    });
    response.cookies.set('vals-memory-edit', encodeURIComponent(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: getMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    console.error('Edit session error:', error);
    return NextResponse.json({ error: 'Failed to set session' }, { status: 500 });
  }
}
