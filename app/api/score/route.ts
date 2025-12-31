import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { redactReferences, type ReferenceRow } from '@/lib/references';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

type TimelineEventWithRefs = Database['public']['Tables']['timeline_events']['Row'] & {
  references?: ReferenceRow[] | null;
  contributor_id?: string | null;
};

type VisibilityPref = {
  person_id: string;
  contributor_id: string | null;
  visibility: string;
};

export async function GET() {
  try {
    // Disambiguate contributor relationship (timeline_events has multiple FKs to contributors)
    const baseSelect = `
      *,
      contributor:contributors!timeline_events_contributor_id_fkey(name, relation),
      media:event_media(media:media(*))
    `;
    const selectWithReferences = `
      ${baseSelect},
      references:event_references(id, type, url, display_name, role, note, visibility, relationship_to_subject, person:people(id, canonical_name, visibility), contributor:contributors!event_references_contributor_id_fkey(name))
    `;

    const eventsResult = await admin
      .from('timeline_events')
      .select(selectWithReferences)
      .eq('status', 'published')
      .order('year', { ascending: true });

    if (eventsResult.error?.code === 'PGRST200') {
      const fallback = await admin
        .from('timeline_events')
        .select(baseSelect)
        .eq('status', 'published')
        .order('year', { ascending: true });
      if (fallback.error) {
        console.error('Score fetch error', { eventsError: fallback.error });
        return NextResponse.json({ events: [] }, { status: 500 });
      }
      return NextResponse.json({ events: fallback.data || [] });
    }

    if (eventsResult.error) {
      console.error('Score fetch error', { eventsError: eventsResult.error });
      return NextResponse.json({ events: [] }, { status: 500 });
    }

    // Collect all person_ids and contributor_ids for preference lookups
    const personIds = new Set<string>();
    const contributorIds = new Set<string>();
    const typedEvents = (eventsResult.data || []) as TimelineEventWithRefs[];

    for (const event of typedEvents) {
      if (event.contributor_id) contributorIds.add(event.contributor_id);
      for (const ref of (event.references || []) as { person?: { id?: string } | null }[]) {
        if (ref.person?.id) personIds.add(ref.person.id);
      }
    }

    // Fetch all relevant visibility preferences in one query
    let allPreferences: VisibilityPref[] = [];
    if (personIds.size > 0 && contributorIds.size > 0) {
      // Build OR filter for all contributor_ids plus NULL
      const contributorFilter = [...contributorIds].map(id => `contributor_id.eq.${id}`).join(',');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prefs } = await (admin.from('visibility_preferences' as any) as any)
        .select('person_id, contributor_id, visibility')
        .in('person_id', [...personIds])
        .or(`${contributorFilter},contributor_id.is.null`);
      allPreferences = (prefs || []) as VisibilityPref[];
    }

    // Build lookup: personId -> contributorId -> visibility
    const prefLookup = new Map<string, Map<string | null, string>>();
    for (const pref of allPreferences) {
      if (!prefLookup.has(pref.person_id)) {
        prefLookup.set(pref.person_id, new Map());
      }
      prefLookup.get(pref.person_id)!.set(pref.contributor_id, pref.visibility);
    }

    // Redact private names before sending to client
    const events = typedEvents.map((event) => {
      const eventContributorId = event.contributor_id;

      // Enrich references with visibility preferences
      type RefWithPerson = { person?: { id?: string } | null };
      const enrichedRefs = (event.references || []).map((ref: RefWithPerson) => {
        const personId = ref.person?.id;
        if (!personId) return ref;

        const personPrefs = prefLookup.get(personId);
        return {
          ...ref,
          visibility_preference: personPrefs ? {
            contributor_preference: eventContributorId ? personPrefs.get(eventContributorId) : null,
            global_preference: personPrefs.get(null) || null,
          } : null,
        };
      });

      return {
        ...event,
        references: redactReferences(enrichedRefs as ReferenceRow[]),
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
