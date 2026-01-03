import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// POST: Save email for a contributor (for notification opt-in)
//
// TODO: Future enhancements:
// - Send welcome/confirmation email when they save their email
// - Send notification email when someone replies to their memory thread
// - Include magic link in notification to let them claim their identity
// - Once claimed, let them edit their memories and add more without re-inviting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contributor_id, email } = body;

    if (!contributor_id || !email?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Update the contributor's email (having email implies opt-in for notifications)
    const { error } = await admin.from('contributors')
      .update({
        email: email.trim().toLowerCase(),
      })
      .eq('id', contributor_id);

    if (error) {
      console.error('Failed to save email:', error);
      return NextResponse.json(
        { error: 'Failed to save email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email save error:', error);
    return NextResponse.json(
      { error: 'Failed to save email' },
      { status: 500 }
    );
  }
}
