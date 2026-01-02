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
  contributor_id: string | null;
  contributor?: { name: string | null; relation: string | null } | null;
};

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    // Fetch all visible notes from the Score (public and family).
    const { data: events, error } = await supabase
      .from('current_notes')
      .select(`
        id,
        full_entry,
        preview,
        title,
        created_at,
        contributor_id
      `)
      .eq('status', 'published')
      .in('privacy_level', ['public', 'family'])
      .order('year', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      // Continue with empty memories rather than failing
    }

    const rawEvents = (events ?? []) as RawChatEvent[];
    const contributorIds = Array.from(new Set(
      rawEvents
        .map((event) => event.contributor_id)
        .filter((id): id is string => Boolean(id))
    ));

    const contributorById = new Map<string, { name: string | null; relation: string | null }>();
    if (contributorIds.length > 0) {
      const { data: contributors, error: contributorError } = await supabase
        .from('contributors')
        .select('id, name, relation')
        .in('id', contributorIds);

      if (contributorError) {
        console.error('Supabase contributor error:', contributorError);
      } else {
        for (const contributor of contributors ?? []) {
          contributorById.set(contributor.id, {
            name: contributor.name ?? null,
            relation: contributor.relation ?? null,
          });
        }
      }
    }

    const enrichedEvents = rawEvents.map((event) => ({
      ...event,
      contributor: event.contributor_id ? contributorById.get(event.contributor_id) ?? null : null,
    }));

    const memories = enrichedEvents.map((event) => ({
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
