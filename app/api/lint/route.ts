import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { lintNote } from '@/lib/note-lint';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const content = typeof body?.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return NextResponse.json({ lintWarnings: [] });
    }

    const admin = createAdminClient();
    const lintWarnings = await lintNote(admin, content);

    return NextResponse.json({ lintWarnings });
  } catch (error) {
    console.error('Lint API error:', error);
    return NextResponse.json({ lintWarnings: [] }, { status: 500 });
  }
}
