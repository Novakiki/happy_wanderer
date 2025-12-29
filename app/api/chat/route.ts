import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/claude';
import { supabase } from '@/lib/supabase';
import { Memory } from '@/lib/types';

type RawChatEvent = {
  id: string;
  full_entry: string | null;
  preview: string | null;
  title: string;
  created_at: string;
  contributor?: { name: string | null; relation: string | null } | null;
};

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    // Fetch all visible notes from the Score (public and family).
    const { data: events, error } = await supabase
      .from('timeline_events')
      .select(`
        id,
        full_entry,
        preview,
        title,
        created_at,
        contributor:contributors!contributor_id(name, relation)
      `)
      .eq('status', 'published')
      .in('privacy_level', ['public', 'family'])
      .order('year', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      // Continue with empty memories rather than failing
    }

    const rawEvents = (events ?? []) as RawChatEvent[];
    const memories = rawEvents.map((event) => ({
        id: event.id,
        content: event.full_entry || event.preview || event.title,
        submitter_name: event.contributor?.name ?? null,
        submitter_relationship: event.contributor?.relation ?? null,
        created_at: event.created_at,
      }))
      .filter((memory) => Boolean(memory.content));

    const response = await chat(messages, memories as Memory[]);

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
