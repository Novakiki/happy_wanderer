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

function isAuthorized(request: Request) {
  const key = request.headers.get('x-e2e-fixture-key');
  return fixtureEnabled && fixtureKey && key === fixtureKey;
}

async function ensureIdentityClaim(email: string): Promise<IdentityInfo | null> {
  if (!admin) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('contributor_id')
    .eq('email', email)
    .maybeSingle();

  const contributorId = profile?.contributor_id;
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

  const stamp = Date.now();
  const entries = [
    {
      year: 1991,
      type: 'memory',
      title: `E2E Identity Note ${stamp} A`,
      preview: 'Identity visibility test note A.',
      full_entry: `I remember talking with ${identity.personName} by the kitchen window.`,
      why_included: 'Identity visibility test.',
      status: 'published',
      privacy_level: 'family',
      contributor_id: null,
    },
    {
      year: 1994,
      type: 'memory',
      title: `E2E Identity Note ${stamp} B`,
      preview: 'Identity visibility test note B.',
      full_entry: `${identity.personName} told us a story that night.`,
      why_included: 'Identity visibility test.',
      status: 'published',
      privacy_level: 'family',
      contributor_id: null,
    },
  ];

  const { data: events, error } = await admin
    .from('timeline_events')
    .insert(entries)
    .select('id, title');

  if (error || !events || events.length < 2) return [];

  const references = events.map((event, index) => ({
    event_id: event.id,
    type: 'person',
    person_id: identity.personId,
    role: 'witness',
    visibility: index === 0 ? 'blurred' : 'pending',
    relationship_to_subject: null,
    added_by: null,
  }));

  const { error: refError } = await admin.from('event_references').insert(references);
  if (refError) {
    await admin.from('timeline_events').delete().in('id', events.map((event) => event.id));
    return [];
  }

  return events.map((event) => ({
    id: event.id,
    title: event.title,
  }));
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
