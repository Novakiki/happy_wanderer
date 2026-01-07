import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  type Visibility,
  normalizeVisibility,
  isMorePrivateOrEqual,
  resolveVisibility,
} from '@/lib/identity/resolve-visibility';

type VisibilityPreference = {
  person_id: string;
  contributor_id: string | null;
  visibility: string;
};

function escapeIlikePattern(value: string) {
  return value.replace(/[%_\\]/g, '\\$&');
}

const ALLOWED_VISIBILITY = new Set<Visibility>([
  'approved',
  'blurred',
  'anonymized',
  'removed',
  'pending',
]);

async function getContributorId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from('profiles')
    .select('contributor_id')
    .eq('id', userId)
    .single();
  return (data as { contributor_id?: string | null } | null)?.contributor_id ?? null;
}

async function getPersonIdForContributor(admin: ReturnType<typeof createAdminClient>, contributorId: string) {
  const { data } = await admin.from('person_claims')
    .select('person_id, status')
    .eq('contributor_id', contributorId);

  const claims = (data as Array<{ person_id: string; status: string }> | null) ?? [];
  if (!claims.length) return null;

  const approved = claims.find((claim) => claim.status === 'approved');
  return (approved ?? claims[0]).person_id;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const contributorId = await getContributorId(admin, user.id);

    if (!contributorId) {
      return NextResponse.json({
        person: null,
        notes: [],
        author_preferences: [],
        default_visibility: 'pending',
        default_source: 'unknown',
        contributor_name: null,
      });
    }

    const personId = await getPersonIdForContributor(admin, contributorId);
    if (!personId) {
      const { data: contributor } = await admin.from('contributors')
        .select('name')
        .eq('id', contributorId)
        .single();
      return NextResponse.json({
        person: null,
        notes: [],
        author_preferences: [],
        default_visibility: 'pending',
        default_source: 'unknown',
        contributor_name: (contributor as { name?: string | null } | null)?.name ?? null,
      });
    }

    const { data: person } = await admin.from('people')
      .select('id, canonical_name, visibility')
      .eq('id', personId)
      .single();

    // Load visibility preferences for this person
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prefs } = await admin.from('visibility_preferences' as any)
      .select('person_id, contributor_id, visibility')
      .eq('person_id', personId);

    const preferences = (prefs as VisibilityPreference[] | null) ?? [];
    const globalPreference = preferences.find((pref) => pref.contributor_id === null)?.visibility ?? null;
    const authorPreferences = preferences.filter((pref) => pref.contributor_id !== null);

    // Resolve contributor names for author preferences
    const authorIds = authorPreferences
      .map((pref) => pref.contributor_id)
      .filter((id): id is string => Boolean(id));

    const authorLookup = new Map<string, { name: string | null; relation: string | null }>();
    if (authorIds.length > 0) {
      const { data: contributors } = await admin.from('contributors')
        .select('id, name, relation')
        .in('id', authorIds);
      if (contributors) {
        for (const row of contributors as Array<{ id: string; name: string | null; relation: string | null }>) {
          authorLookup.set(row.id, { name: row.name, relation: row.relation });
        }
      }
    }

    const { data: references } = await admin.from('event_references')
      .select(`
        id,
        visibility,
        relationship_to_subject,
        role,
        event:timeline_events(
          id,
          title,
          year,
          year_end,
          timing_certainty,
          status,
          privacy_level,
          contributor_id,
          contributor:contributors!timeline_events_contributor_id_fkey(id, name, relation)
        )
      `)
      .eq('person_id', personId)
      .eq('type', 'person');

    const preferenceMap = new Map<string, string>();
    for (const pref of authorPreferences) {
      if (pref.contributor_id) {
        preferenceMap.set(pref.contributor_id, pref.visibility);
      }
    }

    const notes = ((references as Array<{
      id: string;
      visibility: string | null;
      relationship_to_subject: string | null;
      role: string | null;
      event: {
        id: string;
        title: string;
        year: number;
        year_end: number | null;
        timing_certainty: string | null;
        status: string | null;
        privacy_level: string | null;
        contributor_id: string | null;
        contributor: { id: string; name: string | null; relation: string | null } | null;
      } | null;
    }> | null) || [])
      .filter((ref) => ref.event)
      .map((ref) => {
        const eventContributorId = ref.event?.contributor_id ?? null;
        const contributorPref = eventContributorId ? preferenceMap.get(eventContributorId) ?? null : null;
        const baseVisibility = resolveVisibility(
          'pending',
          (person as { visibility?: string | null } | null)?.visibility ?? null,
          contributorPref,
          globalPreference
        );
        const effectiveVisibility = resolveVisibility(
          ref.visibility,
          (person as { visibility?: string | null } | null)?.visibility ?? null,
          contributorPref,
          globalPreference
        );

        return {
          reference_id: ref.id,
          visibility_override: normalizeVisibility(ref.visibility),
          effective_visibility: effectiveVisibility,
          base_visibility: baseVisibility,
          relationship_to_subject: ref.relationship_to_subject ?? null,
          role: ref.role ?? null,
          event: ref.event,
        };
      })
      .sort((a, b) => {
        const yearA = a.event?.year ?? 0;
        const yearB = b.event?.year ?? 0;
        if (yearA !== yearB) return yearB - yearA;
        return a.event?.title.localeCompare(b.event?.title || '') ?? 0;
      });

    const defaultVisibility = normalizeVisibility(globalPreference ?? (person as { visibility?: string | null } | null)?.visibility);
    const defaultSource = globalPreference ? 'preference' : 'person';

    return NextResponse.json({
      person: {
        id: personId,
        name: (person as { canonical_name?: string | null } | null)?.canonical_name ?? null,
      },
      default_visibility: defaultVisibility,
      default_source: defaultSource,
      contributor_name: null,
      author_preferences: authorPreferences.map((pref) => ({
        contributor_id: pref.contributor_id,
        visibility: normalizeVisibility(pref.visibility),
        name: pref.contributor_id ? authorLookup.get(pref.contributor_id)?.name ?? null : null,
        relation: pref.contributor_id ? authorLookup.get(pref.contributor_id)?.relation ?? null : null,
      })),
      notes,
    });
  } catch (error) {
    console.error('Settings identity GET error:', error);
    return NextResponse.json({ error: 'Failed to load identity settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { scope, visibility, reference_id, contributor_id, display_name } = body;

    const allowedScope = new Set(['note', 'default', 'author', 'claim', 'display_name']);
    if (!allowedScope.has(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    const admin = createAdminClient();
    const contributorId = await getContributorId(admin, user.id);
    if (!contributorId) {
      return NextResponse.json({ error: 'No contributor linked' }, { status: 400 });
    }

    if (scope === 'claim') {
      const { data: contributor } = await admin.from('contributors')
        .select('id, name')
        .eq('id', contributorId)
        .single();

      const contributorName = (contributor as { name?: string | null } | null)?.name?.trim() ?? '';
      if (!contributorName) {
        return NextResponse.json({ error: 'Missing contributor name' }, { status: 400 });
      }

      const existingPersonId = await getPersonIdForContributor(admin, contributorId);
      if (existingPersonId) {
        await admin.from('person_claims')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: contributorId,
          })
          .eq('contributor_id', contributorId);
        await admin.from('people')
          .update({ visibility: 'approved' })
          .eq('id', existingPersonId);
        return NextResponse.json({ success: true, person_id: existingPersonId });
      }

      const escapedName = escapeIlikePattern(contributorName);
      const { data: existingPeople } = await admin.from('people')
        .select('id')
        .ilike('canonical_name', escapedName)
        .limit(1);

      let personId = (existingPeople as Array<{ id?: string }>)?.[0]?.id ?? null;

      if (!personId) {
        const { data: newPerson } = await admin.from('people')
          .insert({
            canonical_name: contributorName,
            visibility: 'approved',
            created_by: contributorId,
          })
          .select('id')
          .single();
        personId = (newPerson as { id?: string } | null)?.id ?? null;
      }

      if (!personId) {
        return NextResponse.json({ error: 'Failed to create identity' }, { status: 500 });
      }

      await admin.from('person_claims')
        .upsert({
          person_id: personId,
          contributor_id: contributorId,
          status: 'approved',
          created_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: contributorId,
        }, {
          onConflict: 'contributor_id',
        });

      await admin.from('person_aliases')
        .insert({
          person_id: personId,
          alias: contributorName,
          created_by: contributorId,
        });

      return NextResponse.json({ success: true, person_id: personId });
    }

    if (scope === 'display_name') {
      const trimmedName = typeof display_name === 'string' ? display_name.trim() : '';
      if (!trimmedName) {
        return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
      }

      const personId = await getPersonIdForContributor(admin, contributorId);
      if (!personId) {
        return NextResponse.json({ error: 'No identity claim found' }, { status: 400 });
      }

      const { error: updateError } = await admin.from('people')
        .update({ canonical_name: trimmedName })
        .eq('id', personId);

      if (updateError) {
        console.error('Failed to update display name:', updateError);
        return NextResponse.json({ error: 'Failed to update display name' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const normalizedVisibility = normalizeVisibility(visibility);
    if (!ALLOWED_VISIBILITY.has(normalizedVisibility)) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    const personId = await getPersonIdForContributor(admin, contributorId);
    if (!personId) {
      return NextResponse.json({ error: 'No identity claim found' }, { status: 400 });
    }

    if (scope === 'note') {
      if (!reference_id) {
        return NextResponse.json({ error: 'reference_id is required' }, { status: 400 });
      }

      const { data: reference } = await admin.from('event_references')
        .select('id, event_id')
        .eq('id', reference_id)
        .eq('person_id', personId)
        .single();

      if (!reference) {
        return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
      }

      if (normalizedVisibility !== 'pending') {
        const { data: eventRow } = await admin.from('timeline_events')
          .select('contributor_id')
          .eq('id', (reference as { event_id?: string | null }).event_id ?? '')
          .single();

        const { data: personRow } = await admin.from('people')
          .select('visibility')
          .eq('id', personId)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prefs } = await admin.from('visibility_preferences' as any)
          .select('person_id, contributor_id, visibility')
          .eq('person_id', personId);

        const preferences = (prefs as VisibilityPreference[] | null) ?? [];
        const globalPreference = preferences.find((pref) => pref.contributor_id === null)?.visibility ?? null;
        const contributorPreference = preferences.find(
          (pref) => pref.contributor_id === (eventRow as { contributor_id?: string | null } | null)?.contributor_id
        )?.visibility ?? null;

        const baseVisibility = resolveVisibility(
          'pending',
          (personRow as { visibility?: string | null } | null)?.visibility ?? null,
          contributorPreference,
          globalPreference
        );

        if (!isMorePrivateOrEqual(normalizedVisibility, baseVisibility)) {
          return NextResponse.json(
            { error: 'Per-note visibility can only be more private than your default.' },
            { status: 400 }
          );
        }
      }

      const { error: updateError } = await admin.from('event_references')
        .update({ visibility: normalizedVisibility })
        .eq('id', reference_id);

      if (updateError) {
        console.error('Failed to update reference visibility:', updateError);
        return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (scope === 'author') {
      if (!contributor_id) {
        return NextResponse.json({ error: 'contributor_id is required' }, { status: 400 });
      }

      if (normalizedVisibility === 'pending') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await admin.from('visibility_preferences' as any)
          .delete()
          .eq('person_id', personId)
          .eq('contributor_id', contributor_id);
        return NextResponse.json({ success: true });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: prefError } = await admin.from('visibility_preferences' as any)
        .upsert({
          person_id: personId,
          contributor_id,
          visibility: normalizedVisibility,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'person_id,contributor_id',
        });

      if (prefError) {
        console.error('Failed to update author preference:', prefError);
        return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // scope === 'default'
    if (normalizedVisibility === 'pending') {
      return NextResponse.json({ error: 'Default visibility cannot be pending' }, { status: 400 });
    }

    await admin.from('people')
      .update({ visibility: normalizedVisibility })
      .eq('id', personId);

    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: defaultRows, error: defaultLookupError } = await admin.from('visibility_preferences' as any)
      .select('id')
      .eq('person_id', personId)
      .is('contributor_id', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (defaultLookupError) {
      console.error('Failed to load default preference:', defaultLookupError);
      return NextResponse.json({ error: 'Failed to update default visibility' }, { status: 500 });
    }

    const existingDefault = (defaultRows as Array<{ id?: string }> | null)?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultQuery = admin.from('visibility_preferences' as any);
    const { error: defaultError } = existingDefault?.id
      ? await defaultQuery
          .update({ visibility: normalizedVisibility, updated_at: now })
          .eq('id', existingDefault.id)
      : await defaultQuery
          .insert({
            person_id: personId,
            contributor_id: null,
            visibility: normalizedVisibility,
            created_at: now,
            updated_at: now,
          });

    if (defaultError) {
      console.error('Failed to update default preference:', defaultError);
      return NextResponse.json({ error: 'Failed to update default visibility' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings identity POST error:', error);
    return NextResponse.json({ error: 'Failed to update identity settings' }, { status: 500 });
  }
}
