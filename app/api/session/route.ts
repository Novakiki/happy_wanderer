import { NextRequest, NextResponse } from 'next/server';

type EditSession = {
  token: string;
  name: string;
};

function readEditSession(value?: string): EditSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed && typeof parsed.token === 'string' && typeof parsed.name === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const editCookie = request.cookies.get('vals-memory-edit')?.value;
  const editSession = readEditSession(editCookie);

  return NextResponse.json({
    name: editSession?.name || null,
    authenticated: !!editSession,
  });
}
