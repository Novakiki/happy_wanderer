import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      event_id,
      recipient_name,
      recipient_contact,
      method,
      message,
      witnesses = [],
    } = body;

    if (!event_id || !recipient_name || !method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert invite
    const { error: inviteError } = await admin.from('invites').insert({
      event_id,
      recipient_name,
      recipient_contact,
      method,
      message,
    });

    if (inviteError) {
      console.error('Invite insert error:', inviteError);
      return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
    }

    // Optionally record witnesses
    if (Array.isArray(witnesses) && witnesses.length) {
      const witnessRows = witnesses
        .filter((name: string) => !!name?.trim())
        .map((name: string) => ({
          event_id,
          name: name.trim(),
          contact_method: null,
          contact_info: null,
          status: 'invited' as const,
        }));

      if (witnessRows.length) {
        const { error: witnessError } = await admin.from('witnesses').insert(witnessRows);
        if (witnessError) {
          console.warn('Witness insert error (continuing):', witnessError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite API error:', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}
