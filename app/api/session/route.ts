import { NextRequest, NextResponse } from 'next/server';
import { readEditSession } from '@/lib/edit-session';

export async function GET(request: NextRequest) {
  const editCookie = request.cookies.get('vals-memory-edit')?.value;
  const editSession = readEditSession(editCookie);

  return NextResponse.json({
    name: editSession?.name || null,
    authenticated: !!editSession,
    contributor_id: editSession?.contributor_id || null,
  });
}
