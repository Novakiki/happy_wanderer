import type { APIRequestContext } from '@playwright/test';
import { fixtureEnabled, fixtureKey } from './env';

// NOTE:
// - `actors/fixtures.ts` seeds data through test-only HTTP endpoints (exercises more of the stack).
// - For direct DB setup/teardown, use `actors/db-fixtures.ts` (requires Supabase admin creds).

type SeedResponse = {
  notes?: Array<{ id: string }>;
};

export async function seedIdentityNote(request: APIRequestContext) {
  if (!fixtureEnabled || !fixtureKey) return null;

  const response = await request.post('/api/test/fixtures/seed', {
    data: {},
    headers: {
      'x-e2e-fixture-key': fixtureKey,
    },
  });

  if (!response.ok()) return null;
  const payload = (await response.json().catch(() => ({}))) as SeedResponse;
  return payload?.notes?.[0]?.id ?? null;
}
