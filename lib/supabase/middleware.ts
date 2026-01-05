import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { INVITE_COOKIE_NAME, validateInviteSession } from '@/lib/invite-session';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the authenticated user maps to a deactivated contributor, block access.
  // (This runs after getUser() to avoid session-debugging issues.)
  if (
    user &&
    !request.nextUrl.pathname.startsWith('/auth/disabled') &&
    !request.nextUrl.pathname.startsWith('/api/auth/logout')
  ) {
    const { data: profile, error: profileError } = await ((supabase.from('profiles') as unknown) as ReturnType<typeof supabase.from>)
      .select('contributor_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Middleware profile lookup error:', profileError);
    }

    const contributorId = (profile as { contributor_id?: string | null } | null)?.contributor_id ?? null;
    if (contributorId) {
      const { data: contributor, error: contributorError } = await ((supabase.from('contributors') as unknown) as ReturnType<typeof supabase.from>)
        .select('disabled_at')
        .eq('id', contributorId)
        .maybeSingle();

      if (contributorError) {
        console.error('Middleware contributor lookup error:', contributorError);
      }

      const disabledAt = (contributor as { disabled_at?: string | null } | null)?.disabled_at ?? null;
      if (disabledAt) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/disabled';
        return NextResponse.redirect(url);
      }
    }
  }

  const inviteCookieValue = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  const inviteAccess = !user && inviteCookieValue
    ? await validateInviteSession(inviteCookieValue)
    : null;
  const inviteSession = inviteAccess?.session ?? null;
  const isInviteBrowseRoute =
    request.nextUrl.pathname === '/score' ||
    request.nextUrl.pathname.startsWith('/memory/') ||
    request.nextUrl.pathname === '/api/score' ||
    request.nextUrl.pathname === '/api/score-peek';
  const isScoreApiRoute =
    request.nextUrl.pathname === '/api/score' ||
    request.nextUrl.pathname === '/api/score-peek';

  if (!inviteSession && inviteCookieValue) {
    supabaseResponse.cookies.set(INVITE_COOKIE_NAME, '', {
      path: '/',
      maxAge: 0,
    });
  }

  // If not authenticated and not on an auth page, redirect to login
  if (
    !user &&
    !(inviteSession && isInviteBrowseRoute) &&
    !isScoreApiRoute &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api/auth') &&
    !request.nextUrl.pathname.startsWith('/edit') &&
    !request.nextUrl.pathname.startsWith('/api/edit') &&
    !request.nextUrl.pathname.startsWith('/api/trust-requests') &&
    !request.nextUrl.pathname.startsWith('/api/respond') &&
    !request.nextUrl.pathname.startsWith('/api/test/fixtures') &&
    !request.nextUrl.pathname.startsWith('/api/test/login') &&
    !request.nextUrl.pathname.startsWith('/api/graph') &&
    !request.nextUrl.pathname.startsWith('/respond') &&
    !request.nextUrl.pathname.startsWith('/claim') &&
    !request.nextUrl.pathname.startsWith('/api/claim') &&
    !request.nextUrl.pathname.startsWith('/test-login') &&
    !request.nextUrl.pathname.startsWith('/graph')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
