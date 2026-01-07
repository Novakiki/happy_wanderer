import { NextRequest, NextResponse } from 'next/server';
import { chat, chatWithEnrichedPayload } from '@/lib/claude';
import { supabase } from '@/lib/supabase';
import { Memory } from '@/lib/types';
import { buildInterpreterPayload } from '@/lib/interpreter/buildInterpreterPayload';
import type {
  DbMemoryRow,
  DbContributorRow,
  DbThreadRow,
  DbMotifRow,
  DbMotifLinkRow,
  DbEventReferenceRow,
} from '@/lib/interpreter/types';

// Feature flag for enriched interpreter payload
const USE_ENRICHED_PAYLOAD = process.env.USE_ENRICHED_INTERPRETER_PAYLOAD === 'true';

// === Legacy Types (for non-enriched path) ===

type RawChatEvent = {
  id: string;
  full_entry: string | null;
  preview: string | null;
  title: string;
  created_at: string;
  contributor_id: string | null;
  contributor?: { name: string | null; relation: string | null } | null;
};

// === Enriched Types ===

type EnrichedChatEvent = DbMemoryRow & {
  contributor_id: string | null;
};

type ContributorWithTrust = DbContributorRow;

type MotifLinkWithMotif = {
  motif_id: string;
  link_type: string;
  motif: {
    id: string;
    label: string;
    definition: string | null;
  } | null;
};

type EventReferenceWithPerson = {
  id: string;
  type: string;
  role: string | null;
  person_id: string | null;
  person: {
    id: string;
    name: string | null;
  } | null;
};

// === Legacy Chat Handler ===

async function handleLegacyChat(
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
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
  }

  const rawEvents = (events ?? []) as RawChatEvent[];
  const contributorIds = Array.from(
    new Set(
      rawEvents
        .map((event) => event.contributor_id)
        .filter((id): id is string => Boolean(id))
    )
  );

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
    contributor: event.contributor_id
      ? contributorById.get(event.contributor_id) ?? null
      : null,
  }));

  const memories = enrichedEvents
    .map((event) => ({
      id: event.id,
      content: event.full_entry || event.preview || event.title,
      submitter_name: event.contributor?.name ?? null,
      submitter_relationship: event.contributor?.relation ?? null,
      created_at: event.created_at,
    }))
    .filter((memory) => Boolean(memory.content));

  return chat(messages, memories as Memory[]);
}

// === Enriched Chat Handler ===

async function handleEnrichedChat(
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  // Fetch memories with all enriched fields
  const { data: events, error: eventsError } = await supabase
    .from('current_notes')
    .select(`
      id,
      created_at,
      title,
      full_entry,
      preview,
      year,
      year_end,
      life_stage,
      timing_certainty,
      type,
      location,
      witness_type,
      recurrence,
      why_included,
      people_involved,
      contributor_id
    `)
    .eq('status', 'published')
    .in('privacy_level', ['public', 'family'])
    .order('year', { ascending: false });

  if (eventsError) {
    console.error('Supabase events error:', eventsError);
  }

  const rawEvents = (events ?? []) as EnrichedChatEvent[];
  const eventIds = rawEvents.map((e) => e.id);
  const contributorIds = Array.from(
    new Set(
      rawEvents
        .map((e) => e.contributor_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  // Fetch contributors with trust status
  const contributorById = new Map<string, ContributorWithTrust>();
  if (contributorIds.length > 0) {
    const { data: contributors, error: contributorError } = await supabase
      .from('contributors')
      .select('id, name, relation, trusted')
      .in('id', contributorIds);

    if (contributorError) {
      console.error('Supabase contributor error:', contributorError);
    } else {
      for (const c of (contributors ?? []) as ContributorWithTrust[]) {
        contributorById.set(c.id, c);
      }
    }
  }

  // Fetch motif links for these events
  const motifLinksByEvent = new Map<string, DbMotifLinkRow[]>();
  if (eventIds.length > 0) {
    const { data: motifLinks, error: motifError } = await supabase
      .from('motif_links')
      .select(`
        note_id,
        motif_id,
        link_type,
        motif:motifs(id, label, definition)
      `)
      .in('note_id', eventIds);

    if (motifError) {
      console.error('Supabase motif error:', motifError);
    } else {
      for (const link of (motifLinks ?? []) as (MotifLinkWithMotif & { note_id: string })[]) {
        if (!motifLinksByEvent.has(link.note_id)) {
          motifLinksByEvent.set(link.note_id, []);
        }
        motifLinksByEvent.get(link.note_id)!.push({
          motif_id: link.motif_id,
          link_type: link.link_type,
          motif: link.motif,
        });
      }
    }
  }

  // Fetch event references (people who witnessed or told the story)
  const refsByEvent = new Map<string, DbEventReferenceRow[]>();
  if (eventIds.length > 0) {
    const { data: refs, error: refsError } = await supabase
      .from('event_references')
      .select(`
        id,
        event_id,
        type,
        role,
        person_id,
        person:people(id, name)
      `)
      .in('event_id', eventIds)
      .eq('type', 'person');

    if (refsError) {
      console.error('Supabase refs error:', refsError);
    } else {
      for (const ref of (refs ?? []) as (EventReferenceWithPerson & { event_id: string })[]) {
        if (!refsByEvent.has(ref.event_id)) {
          refsByEvent.set(ref.event_id, []);
        }
        refsByEvent.get(ref.event_id)!.push({
          id: ref.id,
          type: ref.type,
          role: ref.role,
          person_id: ref.person_id,
          person: ref.person,
        });
      }
    }
  }

  // Fetch memory threads
  const { data: threads, error: threadsError } = await supabase
    .from('memory_threads')
    .select('id, original_event_id, response_event_id, relationship, note');

  if (threadsError) {
    console.error('Supabase threads error:', threadsError);
  }

  // Fetch motif legend (all active motifs with definitions)
  const { data: motifs, error: motifsError } = await supabase
    .from('motifs')
    .select('id, label, definition')
    .eq('status', 'active');

  if (motifsError) {
    console.error('Supabase motifs error:', motifsError);
  }

  // Build enriched memory inputs
  const enrichedMemories = rawEvents.map((event) => ({
    ...event,
    contributor: event.contributor_id ? contributorById.get(event.contributor_id) : undefined,
    motif_links: motifLinksByEvent.get(event.id) ?? [],
    event_references: refsByEvent.get(event.id) ?? [],
  }));

  // Build the interpreter payload
  const payload = buildInterpreterPayload({
    subjectId: 'valerie',
    subjectName: 'Valerie',
    projectContext: 'Happy Wanderer memory archive',
    memories: enrichedMemories,
    motifLegend: (motifs ?? []) as DbMotifRow[],
    threads: (threads ?? []) as DbThreadRow[],
  });

  return chatWithEnrichedPayload(messages, payload);
}

// === Main Handler ===

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const response = USE_ENRICHED_PAYLOAD
      ? await handleEnrichedChat(messages)
      : await handleLegacyChat(messages);

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
