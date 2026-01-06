import { clearFixtures, readFixtures } from './fixture-store';

const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
const fixtureKey = process.env.E2E_FIXTURE_KEY;
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function cleanupViaApi(noteIds: string[]) {
  if (!fixtureEnabled || !fixtureKey || noteIds.length === 0) return;

  await fetch(`${baseUrl}/api/test/fixtures/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-fixture-key': fixtureKey,
    },
    body: JSON.stringify({ noteIds }),
  });
}

export default async function globalTeardown() {
  const fixtures = readFixtures();
  const noteIds = fixtures.identityNotes?.map((note) => note.id) ?? [];

  await cleanupViaApi(noteIds);

  // Safety net: clean up any leftover identity fixture notes from prior runs
  // (older versions used timestamped titles, which could accumulate if teardown didn't run).
  if (fixtureEnabled && fixtureKey) {
    await fetch(`${baseUrl}/api/test/fixtures/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-fixture-key': fixtureKey,
      },
      body: JSON.stringify({ titlePrefix: 'E2E Identity Note' }),
    }).catch(() => undefined);
  }
  clearFixtures();
}
