import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const TEST_SECRET = process.env.TEST_LOGIN_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isDevAllowed() {
  const isNonProd = process.env.NODE_ENV !== 'production';
  const allowTestLogin = process.env.ALLOW_TEST_LOGIN === 'true';
  return (isNonProd || allowTestLogin) && typeof TEST_SECRET === 'string' && TEST_SECRET.length > 0;
}

function getRequestSecret(request: NextRequest, body?: Record<string, unknown>) {
  const headerSecret = request.headers.get('x-test-login-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');
  const bodySecret = typeof body?.secret === 'string' ? body.secret : null;
  return headerSecret || querySecret || bodySecret || '';
}

function getEmailFromRequest(request: NextRequest, body?: Record<string, unknown>) {
  const queryEmail = request.nextUrl.searchParams.get('email');
  const bodyEmail = typeof body?.email === 'string' ? body.email : null;
  return (queryEmail || bodyEmail || '').trim().toLowerCase();
}

async function getOtpForEmail(email: string) {
  const admin = createAdminClient();

  const createResult = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createResult.error && !/already|duplicate/i.test(createResult.error.message)) {
    return { ok: false as const, error: 'Could not create test user.' };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error || !data?.properties?.email_otp) {
    return { ok: false as const, error: 'Could not create test login link.' };
  }

  return { ok: true as const, otp: data.properties.email_otp };
}

async function handleLogin(request: NextRequest, email: string, redirectTo?: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Missing Supabase public keys.' }, { status: 500 });
  }

  const otpResult = await getOtpForEmail(email);
  if (!otpResult.ok) {
    return NextResponse.json({ error: otpResult.error }, { status: 500 });
  }

  const response = redirectTo
    ? NextResponse.redirect(new URL(redirectTo, request.url))
    : NextResponse.json({ ok: true });

  response.headers.set('cache-control', 'no-store');

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otpResult.otp,
    type: 'magiclink',
  });

  if (error) {
    return NextResponse.json({ error: 'Test login failed.' }, { status: 500 });
  }

  return response;
}

export async function POST(request: NextRequest) {
  if (!isDevAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const secret = getRequestSecret(request, body);
  if (!secret || secret !== TEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = getEmailFromRequest(request, body);
  if (!email) {
    return NextResponse.json({ error: 'Missing email.' }, { status: 400 });
  }

  return handleLogin(request, email);
}

export async function GET(request: NextRequest) {
  if (!isDevAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const secret = getRequestSecret(request);
  if (!secret || secret !== TEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = getEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: 'Missing email.' }, { status: 400 });
  }

  return handleLogin(request, email, '/score');
}
