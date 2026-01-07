import type { Database } from '@/lib/database.types';
import { INVITE_COOKIE_NAME, validateInviteSession } from '@/lib/invite-session';
import { maskContentWithReferences } from '@/lib/name-detection';
import { redactReferences, type ReferenceRow } from '@/lib/references';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

type TimelineEventWithRefs = Database['public']['Views']['current_notes']['Row'] & {
  references?: ReferenceRow[] | null;
  contributor?: { name: string; relation: string | null } | null;
  media?: { media: Database['public']['Tables']['media']['Row'] | null }[] | null;
};

type ReferenceRowWithEventId = ReferenceRow & {
  event_id: string;
};

type MentionRowWithEventId = {
  event_id: string;
  mention_text: string;
  status: string | null;
  visibility: string | null;
  display_label: string | null;
};

type VisibilityPref = {
  person_id: string;
  contributor_id: string | null;
  visibility: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const inviteCookieValue = request.cookies.get(INVITE_COOKIE_NAME)?.value;
    const inviteAccess = !user && inviteCookieValue
      ? await validateInviteSession(inviteCookieValue)
      : null;

    // Requires auth or invite session. (The /score page itself is gated by middleware.)
    if (!user && !inviteAccess) {
      return NextResponse.json({ events: [] }, { status: 401 });
    }

    // Authenticated users or valid invite sessions can browse published family notes.
    const allowFamily = true;
    const privacyLevels: Array<Database['public']['Views']['current_notes']['Row']['privacy_level']> =
      allowFamily ? ['public', 'family'] : ['public'];

    const eventsResult = await admin
      .from('current_notes')
      .select('*')
      .eq('status', 'published')
      .in('privacy_level', privacyLevels)
      .order('year', { ascending: true });

    if (eventsResult.error) {
      console.error('Score fetch error', { eventsError: eventsResult.error });
      const response = NextResponse.json({ events: [] }, { status: 500 });
      if (inviteCookieValue && !inviteAccess) {
        response.cookies.set(INVITE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return response;
    }

    const rows = (eventsResult.data || []) as Database['public']['Views']['current_notes']['Row'][];
    if (rows.length === 0) {
      const response = NextResponse.json({ events: [] });
      if (inviteCookieValue && !inviteAccess) {
        response.cookies.set(INVITE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return response;
    }

    const eventIds = rows.map((event) => event.id).filter((id): id is string => id !== null);
    const contributorIds = Array.from(new Set(
      rows
        .map((event) => event.contributor_id)
        .filter((id): id is string => Boolean(id))
    ));

    const contributorsById = new Map<string, { name: string; relation: string | null }>();
    if (contributorIds.length > 0) {
      const { data: contributors, error: contributorError } = await admin
        .from('contributors')
        .select('id, name, relation')
        .in('id', contributorIds);

      if (contributorError) {
        console.error('Score contributor fetch error', { contributorError });
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
    if (eventIds.length > 0) {
      const { data: mediaRows, error: mediaError } = await admin
        .from('event_media')
        .select('event_id, media:media(*)')
        .in('event_id', eventIds);

      if (mediaError) {
        console.error('Score media fetch error', { mediaError });
      } else {
        for (const row of (mediaRows ?? []) as Array<{ event_id: string; media: Database['public']['Tables']['media']['Row'] | null }>) {
          const existing = mediaByEventId.get(row.event_id) ?? [];
          existing.push({ media: row.media });
          mediaByEventId.set(row.event_id, existing);
        }
      }
    }

    const referencesByEventId = new Map<string, ReferenceRow[]>();
    if (eventIds.length > 0) {
      const { data: referenceRows, error: referencesError } = await admin
        .from('event_references')
        .select(`
          id,
          event_id,
          type,
          url,
          display_name,
          role,
          note,
          visibility,
          relationship_to_subject,
          person:people(id, canonical_name, visibility),
          contributor:contributors!event_references_contributor_id_fkey(name)
        `)
        .in('event_id', eventIds);

      if (referencesError) {
        if (referencesError.code !== 'PGRST200') {
          console.error('Score reference fetch error', { referencesError });
        }
      } else {
        for (const ref of (referenceRows ?? []) as ReferenceRowWithEventId[]) {
          const existing = referencesByEventId.get(ref.event_id) ?? [];
          existing.push(ref);
          referencesByEventId.set(ref.event_id, existing);
        }
      }
    }

    const mentionsByEventId = new Map<string, MentionRowWithEventId[]>();
    if (eventIds.length > 0) {
      const { data: mentionRows, error: mentionsError } = await admin
        .from('note_mentions')
        .select('event_id, mention_text, status, visibility, display_label')
        .in('event_id', eventIds);

      if (mentionsError) {
        if (mentionsError.code !== 'PGRST200') {
          console.error('Score mentions fetch error', { mentionsError });
        }
      } else {
        for (const row of (mentionRows ?? []) as MentionRowWithEventId[]) {
          const existing = mentionsByEventId.get(row.event_id) ?? [];
          existing.push(row);
          mentionsByEventId.set(row.event_id, existing);
        }
      }
    }

    const typedEvents = rows.map((event) => ({
      ...event,
      contributor: event.contributor_id ? contributorsById.get(event.contributor_id) ?? null : null,
      media: event.id ? mediaByEventId.get(event.id) ?? [] : [],
      references: event.id ? referencesByEventId.get(event.id) ?? [] : [],
    })) as TimelineEventWithRefs[];

    // Collect all person_ids and contributor_ids for preference lookups
    const personIds = new Set<string>();
    const preferenceContributorIds = new Set<string>();

    for (const event of typedEvents) {
      if (event.contributor_id) preferenceContributorIds.add(event.contributor_id);
      for (const ref of (event.references || []) as { person?: { id?: string } | null }[]) {
        if (ref.person?.id) personIds.add(ref.person.id);
      }
    }

    // Fetch all relevant visibility preferences in one query
    let allPreferences: VisibilityPref[] = [];
    if (personIds.size > 0 && preferenceContributorIds.size > 0) {
      // Build OR filter for all contributor_ids plus NULL
      const contributorFilter = [...preferenceContributorIds].map(id => `contributor_id.eq.${id}`).join(',');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prefs } = await admin.from('visibility_preferences' as any)
        .select('person_id, contributor_id, visibility')
        .in('person_id', [...personIds])
        .or(`${contributorFilter},contributor_id.is.null`);
      allPreferences = (prefs || []) as unknown as VisibilityPref[];
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

      const { version, version_created_at, version_created_by, ...safeEvent } = event;
      void version;
      void version_created_at;
      void version_created_by;

      // Important: `maskContentWithReferences` requires `author_payload` to know which
      // original names to replace. We include it only for masking, then strip it from
      // the API response so we don't leak private names to the client.
      const redactedForMasking = redactReferences(enrichedRefs as ReferenceRow[], {
        includeAuthorPayload: true,
      });
      const redactedReferences = redactedForMasking.map(({ author_payload, ...rest }) => {
        void author_payload;
        return rest;
      });
      const mentions = event.id ? mentionsByEventId.get(event.id) ?? [] : [];

      return {
        ...safeEvent,
        preview: safeEvent.preview
          ? maskContentWithReferences(safeEvent.preview, redactedForMasking, mentions)
          : safeEvent.preview,
        why_included: safeEvent.why_included
          ? maskContentWithReferences(safeEvent.why_included, redactedForMasking, mentions)
          : safeEvent.why_included,
        references: redactedReferences,
      };
    });

    const response = NextResponse.json({ events });
    if (inviteCookieValue && !inviteAccess) {
      response.cookies.set(INVITE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    }
    return response;
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
