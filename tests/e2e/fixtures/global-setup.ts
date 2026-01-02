import { readFixtures, writeFixtures } from './fixture-store';

const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
const fixtureKey = process.env.E2E_FIXTURE_KEY;
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function seedViaApi() {
  if (!fixtureEnabled || !fixtureKey) return null;

  const response = await fetch(`${baseUrl}/api/test/fixtures/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-fixture-key': fixtureKey,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.warn('Fixture seed failed:', payload?.error || response.statusText);
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!payload?.success) return null;

  return {
    identity: payload.identity,
    identityNotes: payload.notes,
  };
}

export default async function globalSetup() {
  const existing = readFixtures();
  if (existing.identityNotes && existing.identityNotes.length > 0) {
    writeFixtures(existing);
    return;
  }

  const seeded = await seedViaApi();
  if (seeded) {
    writeFixtures(seeded);
    return;
  }

  writeFixtures({});
}
