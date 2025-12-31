import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redactReferences, type ReferenceRow } from '@/lib/references';

export async function POST(request: NextRequest) {
  try {
    // Require Supabase auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const body = await request.json();
    const {
      event_id,
      type,
      person_id,
      personId,
      url,
      display_name,
      role,
      note,
      added_by,
      relationship_to_subject,
    } = body;

    if (!event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const { data: profileRow } = await (admin.from('profiles') as ReturnType<typeof admin.from>)
      .select('contributor_id')
      .eq('id', user.id)
      .limit(1);
    const contributorId = (profileRow && profileRow[0] ? profileRow[0].contributor_id : null) as string | null;

    const canUsePersonId = async (personId: string) => {
      const { data: personRows } = await (admin.from('people') as ReturnType<typeof admin.from>)
        .select('id, visibility, created_by')
        .eq('id', personId)
        .limit(1);
      const personRow = personRows?.[0] as { visibility?: string | null; created_by?: string | null } | undefined;
      if (!personRow) return false;

      const baseVisibility = (personRow.visibility ?? 'pending') as 'approved' | 'pending' | 'anonymized' | 'blurred' | 'removed';
      if (baseVisibility === 'approved') return true;
      if (baseVisibility === 'removed') return false;

      if (contributorId && personRow.created_by === contributorId) return true;

      const { data: claimRows } = await (admin.from('person_claims') as ReturnType<typeof admin.from>)
        .select('id')
        .eq('person_id', personId)
        .eq('status', 'approved')
        .limit(1);
      if (claimRows && claimRows.length > 0) return true;

      if (contributorId) {
        const { data: referenceRows } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
          .select('id')
          .eq('person_id', personId)
          .eq('added_by', contributorId)
          .limit(1);
        if (referenceRows && referenceRows.length > 0) return true;
      }

      return false;
    };

    const resolvedPersonId: string | null = person_id || personId || null;
    if (resolvedPersonId && !(await canUsePersonId(resolvedPersonId))) {
      return NextResponse.json(
        { error: 'Invalid person reference' },
        { status: 400 }
      );
    }

    if (type === 'person' && !resolvedPersonId) {
      return NextResponse.json(
        { error: 'person_id is required for person references' },
        { status: 400 }
      );
    }

    if (type === 'link' && (!url || !display_name)) {
      return NextResponse.json(
        { error: 'url and display_name are required for link references' },
        { status: 400 }
      );
    }

    const { data, error } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
      .insert({
        event_id,
        type,
        person_id: type === 'person' ? resolvedPersonId : null,
        url: type === 'link' ? url : null,
        display_name: type === 'link' ? display_name : null,
        role: role || (type === 'link' ? 'related' : 'witness'),
        note: note || null,
        added_by: added_by || contributorId || null,
        visibility: type === 'person' ? 'pending' : null,
        relationship_to_subject: type === 'person' ? (relationship_to_subject || null) : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Reference insert error:', error);
      return NextResponse.json({ error: 'Failed to add reference' }, { status: 500 });
    }

    return NextResponse.json({ success: true, reference: data });
  } catch (error) {
    console.error('Reference API error:', error);
    return NextResponse.json({ error: 'Failed to add reference' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get the event's contributor_id for preference lookups
    const { data: eventData } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .select('contributor_id')
      .eq('id', eventId)
      .single();
    const eventContributorId = (eventData as { contributor_id?: string } | null)?.contributor_id;

    const { data, error } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
      .select(`
        id,
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
      .eq('event_id', eventId);

    if (error) {
      console.error('Reference fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 });
    }

    // Fetch visibility preferences for all person references
    const personIds = ((data || []) as { person?: { id?: string } | null }[])
      .filter(r => r.person?.id)
      .map(r => r.person!.id!);

    let preferencesMap: Map<string, { contributor_preference?: string | null; global_preference?: string | null }> = new Map();

    if (personIds.length > 0 && eventContributorId) {
      // Fetch preferences for these people (both contributor-specific and global)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prefs } = await (admin.from('visibility_preferences' as any) as any)
        .select('person_id, contributor_id, visibility')
        .in('person_id', personIds)
        .or(`contributor_id.eq.${eventContributorId},contributor_id.is.null`);

      // Build a map of person_id -> { contributor_preference, global_preference }
      if (prefs) {
        for (const pref of prefs as { person_id: string; contributor_id: string | null; visibility: string }[]) {
          const existing = preferencesMap.get(pref.person_id) || {};
          if (pref.contributor_id === eventContributorId) {
            existing.contributor_preference = pref.visibility;
          } else if (pref.contributor_id === null) {
            existing.global_preference = pref.visibility;
          }
          preferencesMap.set(pref.person_id, existing);
        }
      }
    }

    // Attach visibility preferences to each reference
    type RefWithPerson = { person?: { id?: string } | null };
    const enrichedData = (data || []).map((ref: RefWithPerson) => ({
      ...ref,
      visibility_preference: ref.person?.id ? preferencesMap.get(ref.person.id) : null,
    }));

    // Redact private names and filter removed before sending to client
    const references = redactReferences(enrichedData as ReferenceRow[]);

    return NextResponse.json({ references });
  } catch (error) {
    console.error('Reference API error:', error);
    return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 });
  }
}
