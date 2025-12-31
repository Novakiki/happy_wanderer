import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * Allow /respond for unauthenticated invite flows.
     */
    '/((?!_next/static|_next/image|favicon.ico|respond|identity|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
