import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { Database } from '@/lib/database.types';
import { SITE_TITLE } from '@/lib/terminology';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

const MAGIC_LINK_TTL_DAYS = Number(process.env.MAGIC_LINK_TTL_DAYS || 30);

function getBaseUrl(request: Request) {
  return (
    request.headers.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://val.virtuallimit.com'
  );
}

async function sendMagicLinkEmail(email: string, link: string) {
  const webhook = process.env.MAGIC_LINK_WEBHOOK_URL;
  if (!webhook) {
    return { delivered: false };
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      link,
      subject: `${SITE_TITLE} edit link`,
    }),
  });

  if (!response.ok) {
    throw new Error('Magic link delivery failed');
  }

  return { delivered: true };
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data: contributor }: { data: { id: string } | null } = await admin
      .from('contributors')
      .select('id')
      .ilike('email', normalizedEmail)
      .single();

    if (!contributor?.id) {
      return NextResponse.json({ success: true });
    }

    const token = crypto.randomUUID();
    const expiresAt =
      MAGIC_LINK_TTL_DAYS > 0
        ? new Date(Date.now() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000)
        : null;

    const insertPayload: Database['public']['Tables']['edit_tokens']['Insert'] = {
      token,
      contributor_id: contributor.id,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    };
    const { error: insertError } = await admin
      .from('edit_tokens')
      .insert(insertPayload);

    if (insertError) {
      throw insertError;
    }

    const link = `${getBaseUrl(request)}/edit/${token}`;
    const { delivered } = await sendMagicLinkEmail(normalizedEmail, link);

    // Always surface the dev link in non-production, and fallback when email isn't configured
    const devMode = process.env.NODE_ENV !== 'production';
    const devLink = !delivered || devMode ? link : undefined;
    return NextResponse.json({ success: true, devLink });
  } catch (error) {
    console.error('Magic link request error:', error);
    return NextResponse.json(
      { error: 'Failed to request edit link' },
      { status: 500 }
    );
  }
}
