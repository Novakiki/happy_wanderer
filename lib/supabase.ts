import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// =============================================================================
// QUERY HELPERS
// =============================================================================

export async function getTimelineEvents() {
  const { data, error } = await supabase
    .from('timeline_events')
    .select(`
      *,
      contributor:contributors(name, relation),
      themes:event_themes(theme:themes(id, label))
    `)
    .eq('status', 'published')
    .order('year', { ascending: true });

  if (error) {
    console.error('Error fetching timeline events:', error);
    return [];
  }

  return data;
}

export async function getThemes() {
  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .order('label');

  if (error) {
    console.error('Error fetching themes:', error);
    return [];
  }

  return data;
}

export async function getEventById(id: string) {
  const { data, error } = await supabase
    .from('timeline_events')
    .select(`
      *,
      contributor:contributors(name, relation),
      themes:event_themes(theme:themes(id, label))
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return null;
  }

  return data;
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
  privacy_level?: 'public' | 'family' | 'kids-only';
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
