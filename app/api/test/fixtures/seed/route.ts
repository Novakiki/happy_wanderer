import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const TEST_IDENTITY_FALLBACK = 'E2E Test Person';

const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
const fixtureKey = process.env.E2E_FIXTURE_KEY;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

const admin = supabaseUrl && supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey)
  : null;

type IdentityInfo = {
  contributorId: string;
  personId: string;
  personName: string;
};

type NoteFixture = {
  id: string;
  title: string;
};

const IDENTITY_NOTE_FIXTURES: Array<{
  key: 'A' | 'B';
  year: number;
  title: string;
  preview: string;
  entry: (personName: string) => string;
  referenceVisibility: 'blurred' | 'pending';
}> = [
  {
    key: 'A',
    year: 1991,
    title: 'E2E Identity Note A',
    preview: 'Identity visibility test note A.',
    entry: (personName: string) => `I remember talking with ${personName} by the kitchen window.`,
    referenceVisibility: 'blurred',
  },
  {
    key: 'B',
    year: 1994,
    title: 'E2E Identity Note B',
    preview: 'Identity visibility test note B.',
    entry: (personName: string) => `${personName} told us a story that night.`,
    referenceVisibility: 'pending',
  },
];

function isAuthorized(request: Request) {
  const key = request.headers.get('x-e2e-fixture-key');
  return fixtureEnabled && fixtureKey && key === fixtureKey;
}

async function ensureIdentityClaim(email: string): Promise<IdentityInfo | null> {
  if (!admin) return null;

  // Fixture runs often authenticate via `/api/test/login`, which creates a profile with
  // `contributor_id = null`. For identity visibility tests we need a contributor link.
  // Make this idempotent by finding/creating:
  // - auth user (for the email)
  // - profile row (id=user.id, email=email)
  // - contributor row (email=email)
  // - profile.contributor_id -> contributor.id
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, contributor_id, name')
    .eq('email', normalizedEmail)
    .maybeSingle();

  let userId = (existingProfile as { id?: string } | null)?.id ?? null;

  if (!userId) {
    const createResult = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });

    if (createResult.error || !createResult.data?.user?.id) {
      console.warn('Fixture seed: could not create auth user:', createResult.error?.message);
      return null;
    }

    userId = createResult.data.user.id;

    const { error: profileInsertError } = await admin
      .from('profiles')
      .insert({
        id: userId,
        name: normalizedEmail.split('@')[0] || 'E2E Fixture',
        relation: 'test',
        email: normalizedEmail,
        contributor_id: null,
      });
    if (profileInsertError) {
      console.warn('Fixture seed: could not insert profile:', profileInsertError.message);
    }
  }

  let contributorId = (existingProfile as { contributor_id?: string | null } | null)?.contributor_id ?? null;

  if (!contributorId) {
    const { data: existingContributor } = await admin
      .from('contributors')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(1);

    contributorId = existingContributor?.[0]?.id ?? null;

    if (!contributorId) {
      const fallbackName =
        (existingProfile as { name?: string | null } | null)?.name?.trim() ||
        normalizedEmail.split('@')[0] ||
        TEST_IDENTITY_FALLBACK;

      const { data: newContributor, error: contributorError } = await admin
        .from('contributors')
        .insert({
          name: fallbackName,
          relation: 'test',
          email: normalizedEmail,
          trusted: true,
        })
        .select('id')
        .single();

      if (contributorError) {
        console.warn('Fixture seed: could not create contributor:', contributorError.message);
        return null;
      }

      contributorId = newContributor?.id ?? null;
    }

    if (contributorId) {
      await admin
        .from('profiles')
        .update({ contributor_id: contributorId })
        .eq('id', userId);
    }
  }

  if (!contributorId) return null;

  const { data: claim } = await admin
    .from('person_claims')
    .select('person_id, status')
    .eq('contributor_id', contributorId)
    .maybeSingle();

  if (claim?.person_id) {
    if (claim.status !== 'approved') {
      await admin
        .from('person_claims')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: contributorId,
        })
        .eq('contributor_id', contributorId);
    }

    await admin
      .from('people')
      .update({ visibility: 'approved' })
      .eq('id', claim.person_id);

    const { data: personRow } = await admin
      .from('people')
      .select('canonical_name')
      .eq('id', claim.person_id)
      .maybeSingle();

    return {
      contributorId,
      personId: claim.person_id,
      personName: personRow?.canonical_name?.trim() || TEST_IDENTITY_FALLBACK,
    };
  }

  const { data: contributorRow } = await admin
    .from('contributors')
    .select('name')
    .eq('id', contributorId)
    .maybeSingle();

  const candidateName = contributorRow?.name?.trim() || TEST_IDENTITY_FALLBACK;

  let personId: string | null = null;
  const { data: existingPeople } = await admin
    .from('people')
    .select('id')
    .ilike('canonical_name', candidateName)
    .limit(1);

  if (existingPeople && existingPeople.length > 0) {
    personId = existingPeople[0]?.id ?? null;
    if (personId) {
      await admin
        .from('people')
        .update({ visibility: 'approved' })
        .eq('id', personId);
    }
  } else {
    const { data: newPerson } = await admin
      .from('people')
      .insert({
        canonical_name: candidateName,
        visibility: 'approved',
        created_by: contributorId,
      })
      .select('id')
      .single();
    personId = newPerson?.id ?? null;
  }

  if (!personId) return null;

  const now = new Date().toISOString();
  await admin
    .from('person_claims')
    .upsert({
      person_id: personId,
      contributor_id: contributorId,
      status: 'approved',
      created_at: now,
      approved_at: now,
      approved_by: contributorId,
    }, {
      onConflict: 'contributor_id',
    });

  const { data: existingAlias } = await admin
    .from('person_aliases')
    .select('id')
    .eq('person_id', personId)
    .ilike('alias', candidateName)
    .limit(1);

  if (!existingAlias || existingAlias.length === 0) {
    await admin
      .from('person_aliases')
      .insert({
        person_id: personId,
        alias: candidateName,
        created_by: contributorId,
      });
  }

  return {
    contributorId,
    personId,
    personName: candidateName,
  };
}

async function ensureDefaultVisibility(identity: IdentityInfo): Promise<void> {
  if (!admin) return;

  const now = new Date().toISOString();
  const { data: existingRows } = await admin
    .from('visibility_preferences')
    .select('id')
    .eq('person_id', identity.personId)
    .is('contributor_id', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  const existingId = existingRows?.[0]?.id ?? null;

  if (existingId) {
    await admin
      .from('visibility_preferences')
      .update({ visibility: 'approved', updated_at: now })
      .eq('id', existingId);
    return;
  }

  await admin
    .from('visibility_preferences')
    .insert({
      person_id: identity.personId,
      contributor_id: null,
      visibility: 'approved',
      updated_at: now,
      created_at: now,
    });
}

async function seedIdentityNotes(identity: IdentityInfo): Promise<NoteFixture[]> {
  if (!admin) return [];

  // Idempotent seeding: reuse a stable pair of notes so repeated runs don't crowd The Score.
  const titles = IDENTITY_NOTE_FIXTURES.map((fixture) => fixture.title);

  const { data: existingEvents } = await admin
    .from('timeline_events')
    .select('id, title')
    .in('title', titles)
    .eq('status', 'published')
    .eq('privacy_level', 'family');

  const byTitle = new Map<string, { id: string; title: string }>();
  for (const row of existingEvents || []) {
    if (row?.id && row?.title) byTitle.set(row.title, row as { id: string; title: string });
  }

  const missing = IDENTITY_NOTE_FIXTURES.filter((fixture) => !byTitle.has(fixture.title));
  if (missing.length > 0) {
    const entries = missing.map((fixture) => ({
      year: fixture.year,
      type: 'memory',
      title: fixture.title,
      preview: fixture.preview,
      full_entry: fixture.entry(identity.personName),
      why_included: 'Identity visibility test.',
      status: 'published',
      privacy_level: 'family',
      contributor_id: null,
    }));

    const { data: inserted, error: insertError } = await admin
      .from('timeline_events')
      .insert(entries)
      .select('id, title');

    if (insertError || !inserted) return [];

    for (const row of inserted) {
      if (row?.id && row?.title) byTitle.set(row.title, row as { id: string; title: string });
    }
  }

  const orderedEvents = IDENTITY_NOTE_FIXTURES
    .map((fixture) => byTitle.get(fixture.title))
    .filter(Boolean) as Array<{ id: string; title: string }>;

  if (orderedEvents.length !== IDENTITY_NOTE_FIXTURES.length) return [];

  // Ensure we have the expected person reference rows (and the desired visibility) for each note.
  const ids = orderedEvents.map((e) => e.id);

  const { data: existingRefs } = await admin
    .from('event_references')
    .select('id, event_id')
    .in('event_id', ids)
    .eq('type', 'person')
    .eq('role', 'witness')
    .eq('person_id', identity.personId);

  const refByEventId = new Map<string, { id: string; event_id: string }>();
  for (const ref of existingRefs || []) {
    if (ref?.id && ref?.event_id) refByEventId.set(ref.event_id, ref as { id: string; event_id: string });
  }

  for (const fixture of IDENTITY_NOTE_FIXTURES) {
    const event = byTitle.get(fixture.title);
    if (!event) continue;

    const existingRef = refByEventId.get(event.id);
    if (existingRef?.id) {
      await admin
        .from('event_references')
        .update({ visibility: fixture.referenceVisibility })
        .eq('id', existingRef.id);
    } else {
      await admin.from('event_references').insert({
        event_id: event.id,
        type: 'person',
        person_id: identity.personId,
        role: 'witness',
        visibility: fixture.referenceVisibility,
        relationship_to_subject: null,
        added_by: null,
      });
    }
  }

  return orderedEvents.map((event) => ({ id: event.id, title: event.title }));
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!admin) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const email = process.env.E2E_EMAIL;
    if (!email) {
      return NextResponse.json({ error: 'Missing E2E_EMAIL' }, { status: 400 });
    }

    const identity = await ensureIdentityClaim(email);
    if (!identity) {
      return NextResponse.json({ error: 'Failed to ensure identity' }, { status: 500 });
    }

    await ensureDefaultVisibility(identity);

    const notes = await seedIdentityNotes(identity);

    return NextResponse.json({
      success: true,
      identity: {
        personId: identity.personId,
        personName: identity.personName,
      },
      notes,
    });
  } catch (error) {
    console.error('Fixture seed error:', error);
    return NextResponse.json({ error: 'Failed to seed fixtures' }, { status: 500 });
  }
}
