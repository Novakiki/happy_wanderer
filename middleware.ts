import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'vals-memory-auth';
const LETTER_COOKIE_NAME = 'vals-memory-letter';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  const isAuthenticated = authCookie?.value === 'authenticated';

  if (!isAuthenticated) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For page routes, we'll let the page handle showing the password gate
    // by passing a header that the layout can check
    const response = NextResponse.next();
    response.headers.set('x-auth-status', 'unauthenticated');
    return response;
  }

  const letterCookie = request.cookies.get(LETTER_COOKIE_NAME);
  const hasSeenLetter = letterCookie?.value === 'seen';
  const isLetterPath = pathname === '/letter' || pathname.startsWith('/api/letter');

  if (!hasSeenLetter && !isLetterPath && !pathname.startsWith('/api/')) {
    const letterUrl = new URL('/letter', request.url);
    return NextResponse.redirect(letterUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
