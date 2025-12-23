import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { content, submitter_name, submitter_relationship, submitter_email, tags } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Memory content is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('memories')
      .insert({
        content: content.trim(),
        submitter_name: submitter_name?.trim() || null,
        submitter_relationship: submitter_relationship?.trim() || null,
        submitter_email: submitter_email?.trim() || null,
        tags: tags?.length > 0 ? tags : null,
        is_visible: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to save memory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, memory: data });
  } catch (error) {
    console.error('Memory submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit memory' },
      { status: 500 }
    );
  }
}
