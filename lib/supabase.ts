import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// =============================================================================
// QUERY HELPERS
// =============================================================================

type PrivacyLevel = 'public' | 'family';

export async function getTimelineEvents(options?: { privacyLevels?: PrivacyLevel[] }) {
  const privacyLevels = options?.privacyLevels;

  const { data, error } = await supabase
    .from('current_notes')
    .select('*')
    .eq('status', 'published')
    .in('privacy_level', privacyLevels && privacyLevels.length ? privacyLevels : ['public', 'family'])
    .order('year', { ascending: true });

  if (error) {
    console.error('Error fetching timeline events:', error);
    return [];
  }

  const rows = (data ?? []) as Array<Database['public']['Views']['current_notes']['Row']>;
  const eventIds = rows.map((event) => event.id);
  const contributorIds = Array.from(new Set(
    rows
      .map((event) => event.contributor_id)
      .filter((id): id is string => Boolean(id))
  ));

  const contributorsById = new Map<string, { name: string; relation: string | null }>();
  if (contributorIds.length > 0) {
    const { data: contributors, error: contributorError } = await supabase
      .from('contributors')
      .select('id, name, relation')
      .in('id', contributorIds);

    if (contributorError) {
      console.error('Error fetching contributors:', contributorError);
    } else {
      for (const contributor of contributors ?? []) {
        contributorsById.set(contributor.id, {
          name: contributor.name,
          relation: contributor.relation ?? null,
        });
      }
    }
  }

  const mediaByEventId = new Map<
    string,
    Array<{ media: Database['public']['Tables']['media']['Row'] | null }>
  >();
  const validEventIds = eventIds.filter((id): id is string => id !== null);
  if (validEventIds.length > 0) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from('event_media')
      .select('event_id, media:media(*)')
      .in('event_id', validEventIds);

    if (mediaError) {
      console.error('Error fetching event media:', mediaError);
    } else {
      for (const row of (mediaRows ?? []) as Array<{ event_id: string; media: Database['public']['Tables']['media']['Row'] | null }>) {
        const existing = mediaByEventId.get(row.event_id) ?? [];
        existing.push({ media: row.media });
        mediaByEventId.set(row.event_id, existing);
      }
    }
  }

  return rows.map((event) => {
    const { version, version_created_at, version_created_by, ...safeEvent } = event;
    void version;
    void version_created_at;
    void version_created_by;
    const eventId = event.id;
    return {
      ...safeEvent,
      contributor: event.contributor_id ? contributorsById.get(event.contributor_id) ?? null : null,
      media: eventId ? mediaByEventId.get(eventId) ?? [] : [],
    };
  });
}

export async function getEventById(id: string) {
  const { data, error } = await supabase
    .from('current_notes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    const errorCode = (error as { code?: string }).code;
    if (errorCode !== 'PGRST116') {
      console.error('Error fetching event:', error);
    }
    return null;
  }

  const event = data as Database['public']['Views']['current_notes']['Row'];

  let contributor: { name: string; relation: string | null } | null = null;
  if (event.contributor_id) {
    const { data: contributorRow, error: contributorError } = await supabase
      .from('contributors')
      .select('id, name, relation')
      .eq('id', event.contributor_id)
      .single();

    if (contributorError) {
      console.error('Error fetching contributor:', contributorError);
    } else if (contributorRow) {
      contributor = {
        name: contributorRow.name,
        relation: contributorRow.relation ?? null,
      };
    }
  }

  let media: Array<{ media: Database['public']['Tables']['media']['Row'] | null }> = [];
  if (!event.id) {
    return null;
  }
  const { data: mediaRows, error: mediaError } = await supabase
    .from('event_media')
    .select('event_id, media:media(*)')
    .eq('event_id', event.id);

  if (mediaError) {
    console.error('Error fetching event media:', mediaError);
  } else {
    media = (mediaRows ?? []).map((row) => ({
      media: (row as { media: Database['public']['Tables']['media']['Row'] | null }).media,
    }));
  }

  const { version, version_created_at, version_created_by, ...safeEvent } = event;
  void version;
  void version_created_at;
  void version_created_by;

  return {
    ...safeEvent,
    contributor,
    media,
  };
}

// =============================================================================
// MUTATION HELPERS
// =============================================================================

export async function createTimelineEvent(event: {
  year: number;
  date?: string;
  type: 'origin' | 'milestone' | 'memory';
  title: string;
  preview?: string;
  full_entry?: string;
  why_included?: string;
  source_url?: string;
  source_name?: string;
  contributor_id: string;
  location?: string;
  people_involved?: string[];
  privacy_level?: 'public' | 'family';
}) {
  const { data, error } = await supabase
    .from('timeline_events')
    .insert({
      ...event,
      status: 'pending', // All new events start as pending
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }

  return data;
}

export async function addWitness(witness: {
  event_id: string;
  name: string;
  contact_method?: 'email' | 'sms' | 'link';
  contact_info?: string;
}) {
  const { data, error } = await supabase
    .from('witnesses')
    .insert(witness)
    .select()
    .single();

  if (error) {
    console.error('Error adding witness:', error);
    return null;
  }

  return data;
}

export async function createInvite(invite: {
  event_id: string;
  recipient_name: string;
  recipient_contact: string;
  method: 'email' | 'sms' | 'link';
  message?: string;
  sender_id?: string;
}) {
  const { data, error } = await supabase
    .from('invites')
    .insert(invite)
    .select()
    .single();

  if (error) {
    console.error('Error creating invite:', error);
    return null;
  }

  return data;
}

// Get contributor by name (for looking up Amy, Derek, etc.)
export async function getContributorByName(name: string) {
  const { data, error } = await supabase
    .from('contributors')
    .select('*')
    .ilike('name', name)
    .single();

  if (error) {
    console.error('Error fetching contributor:', error);
    return null;
  }

  return data;
}

// Create a new contributor
export async function createContributor(contributor: {
  name: string;
  relation: string;
  email?: string;
  phone?: string;
}) {
  const { data, error } = await supabase
    .from('contributors')
    .insert(contributor)
    .select()
    .single();

  if (error) {
    console.error('Error creating contributor:', error);
    return null;
  }

  return data;
}
