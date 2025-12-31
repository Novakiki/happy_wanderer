import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

function getFunctionsBaseUrl(): string | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    const host = url.hostname.replace('.supabase.co', '.functions.supabase.co');
    return `${url.protocol}//${host}`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const functionsBaseUrl = getFunctionsBaseUrl();
  if (!functionsBaseUrl) {
    return NextResponse.json({ error: 'Missing SUPABASE_URL for functions' }, { status: 500 });
  }

  // Prefer the current user's session token; fall back to service role if configured.
  let token: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || null;
  } catch (err) {
    console.warn('name-detection: session lookup failed', err);
  }

  if (!token) {
    token = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || null;
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing auth token (login or set service role key)' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = typeof (body as { content?: unknown }).content === 'string'
    ? (body as { content: string }).content
    : '';

  if (!content.trim()) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${functionsBaseUrl}/name-detection-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json(
        { error: 'Edge function failed', details: errorText },
        { status: 502 },
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('name-detection proxy error', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
