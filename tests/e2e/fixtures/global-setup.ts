import { createClient } from '@supabase/supabase-js';
import { readFixtures, writeFixtures } from './fixture-store';

const TEST_IDENTITY_FALLBACK = 'E2E Test Person';

type IdentityInfo = {
  contributorId: string;
  personId: string;
  personName: string;
};

type NoteFixture = {
  id: string;
  title: string;
};

type AdminClient = ReturnType<typeof createClient>;

async function cleanupNotes(admin: AdminClient, noteIds: string[]) {
  if (noteIds.length === 0) return;
  await admin.from('timeline_events').delete().in('id', noteIds);
}

async function ensureIdentityClaim(admin: AdminClient, email: string): Promise<IdentityInfo | null> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('contributor_id')
    .eq('email', email)
    .maybeSingle();

  if (profileError || !profile?.contributor_id) return null;

  const contributorId = profile.contributor_id as string;

  const { data: claim, error: claimError } = await admin
    .from('person_claims')
    .select('person_id, status')
    .eq('contributor_id', contributorId)
    .maybeSingle();

  if (claimError) return null;

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
    personId = (newPerson as { id?: string } | null)?.id ?? null;
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

async function seedIdentityNotes(admin: AdminClient, identity: IdentityInfo): Promise<NoteFixture[]> {
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

  const references = events.map((event) => ({
    event_id: (event as { id: string }).id,
    type: 'person',
    person_id: identity.personId,
    role: 'witness',
    visibility: 'pending',
    relationship_to_subject: null,
    added_by: null,
  }));

  const { error: refError } = await admin.from('event_references').insert(references);
  if (refError) {
    await cleanupNotes(admin, events.map((event) => (event as { id: string }).id));
    return [];
  }

  return events.map((event) => ({
    id: (event as { id: string }).id,
    title: (event as { title: string }).title,
  }));
}

export default async function globalSetup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.E2E_EMAIL;

  if (!supabaseUrl || !supabaseServiceKey || !email) {
    writeFixtures({});
    return;
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const existing = readFixtures();

  if (existing.identityNotes && existing.identityNotes.length > 0) {
    await cleanupNotes(
      admin,
      existing.identityNotes.map((note) => note.id)
    );
  }

  const identity = await ensureIdentityClaim(admin, email);
  if (!identity) {
    writeFixtures({});
    return;
  }

  const identityNotes = await seedIdentityNotes(admin, identity);

  writeFixtures({
    identity: {
      personId: identity.personId,
      personName: identity.personName,
    },
    identityNotes,
  });
}
