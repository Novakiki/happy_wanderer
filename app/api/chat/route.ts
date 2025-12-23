import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/claude';
import { supabase } from '@/lib/supabase';
import { Memory } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    // Fetch all visible memories from the database
    const { data: memories, error } = await supabase
      .from('memories')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      // Continue with empty memories rather than failing
    }

    const response = await chat(messages, (memories as Memory[]) || []);

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
