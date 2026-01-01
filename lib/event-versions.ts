import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type EventSnapshot = {
  title: string | null;
  preview: string | null;
  full_entry: string | null;
  why_included: string | null;
  source_url: string | null;
  source_name: string | null;
  location: string | null;
  year: number | null;
  year_end: number | null;
  date: string | null;
  timing_certainty: string | null;
  timing_input_type: string | null;
  age_start: number | null;
  age_end: number | null;
  life_stage: string | null;
  timing_note: string | null;
  timing_raw_text: string | null;
  witness_type: string | null;
  recurrence: string | null;
  privacy_level: string | null;
  people_involved: string[] | null;
  type: string | null;
  status: string | null;
};

type VersionRow = {
  version: number;
};

export async function recordEventVersion(
  admin: SupabaseClient<Database>,
  eventId: string,
  contributorId: string | null
): Promise<void> {
  const { data: versionRows, error: versionError } = await (admin.from('timeline_event_versions' as any) as any)
    .select('version')
    .eq('event_id', eventId)
    .order('version', { ascending: false })
    .limit(1);

  if (versionError) {
    throw versionError;
  }

  const nextVersion = ((versionRows as VersionRow[] | null)?.[0]?.version ?? 0) + 1;

  const { data: eventRow, error: eventError } = await admin
    .from('timeline_events')
    .select([
      'title',
      'preview',
      'full_entry',
      'why_included',
      'source_url',
      'source_name',
      'location',
      'year',
      'year_end',
      'date',
      'timing_certainty',
      'timing_input_type',
      'age_start',
      'age_end',
      'life_stage',
      'timing_note',
      'timing_raw_text',
      'witness_type',
      'recurrence',
      'privacy_level',
      'people_involved',
      'type',
      'status',
    ].join(','))
    .eq('id', eventId)
    .single();

  if (eventError || !eventRow) {
    throw eventError || new Error('Missing event row for versioning');
  }

  const snapshot = eventRow as unknown as EventSnapshot;

  const { error: insertError } = await (admin.from('timeline_event_versions' as any) as any)
    .insert({
      event_id: eventId,
      version: nextVersion,
      created_by: contributorId,
      ...snapshot,
    });

  if (insertError) {
    throw insertError;
  }
}
