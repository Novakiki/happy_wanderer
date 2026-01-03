import { test, expect, type APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const fixtureEnabled = process.env.E2E_FIXTURE_ENABLED === 'true';
const fixtureKey = process.env.E2E_FIXTURE_KEY;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const testLoginSecret = process.env.TEST_LOGIN_SECRET;
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const adminEmailFallback =
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .find(Boolean) || '';
const resolvedAdminEmail = (adminEmail || adminEmailFallback || '').trim().toLowerCase();

const adminClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type SeedResponse = {
  notes?: Array<{ id: string }>;
};

const seedIdentityNote = async (request: APIRequestContext) => {
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
};

const createInvite = async (eventId: string) => {
  if (!adminClient) return null;
  const { data: invite, error } = await adminClient
    .from('invites')
    .insert({
      event_id: eventId,
      recipient_name: 'Roleplay Browser',
      recipient_contact: 'roleplay@example.com',
      method: 'link',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !invite) return null;
  return invite.id ?? null;
};

const cleanupInvite = async (request: APIRequestContext, inviteId: string | null) => {
  if (!inviteId || !fixtureEnabled || !fixtureKey) return;
  await request.post('/api/test/fixtures/cleanup', {
    data: { inviteIds: [inviteId] },
    headers: {
      'x-e2e-fixture-key': fixtureKey,
    },
  });
};

const findUserByEmail = async (email: string) => {
  if (!adminClient) return null;
  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error || !data?.users) return null;
  return data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
};

const ensureAdminProfile = async (email: string) => {
  if (!adminClient) return;
  const normalizedEmail = email.trim().toLowerCase();
  let userId = (await findUserByEmail(normalizedEmail))?.id ?? null;

  if (!userId) {
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });
    if (createError || !createData?.user?.id) return;
    userId = createData.user.id;
  }

  const { data: profileRows } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId);

  if (profileRows && profileRows.length > 0) return;

  let contributorId: string | null = null;
  const { data: contributors } = await adminClient
    .from('contributors')
    .select('id')
    .ilike('email', normalizedEmail);

  if (contributors && contributors.length > 0) {
    contributorId = (contributors[0] as { id: string }).id;
  }

  if (!contributorId) {
    const { data: newContributor } = await adminClient
      .from('contributors')
      .insert({
        name: 'Roleplay Admin',
        relation: 'admin',
        email: normalizedEmail,
      })
      .select('id')
      .single();
    contributorId = (newContributor as { id?: string } | null)?.id ?? null;
  }

  await adminClient.from('profiles').insert({
    id: userId,
    name: 'Roleplay Admin',
    relation: 'admin',
    email: normalizedEmail,
    contributor_id: contributorId,
  });
};

test.describe('Roleplay flows', () => {
  test('score api requires auth or invite', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: baseUrl,
      storageState: { cookies: [], origins: [] },
    });
    const response = await api.get('/api/score');
    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test('invite-only session can browse the score', async ({ page, request }) => {
    test.skip(!fixtureEnabled || !fixtureKey, 'Enable fixtures to run invite tests.');

    const eventId = await seedIdentityNote(request);
    if (!eventId) {
      test.skip(true, 'No fixture notes available.');
      return;
    }

    const inviteId = await createInvite(eventId);
    if (!inviteId) {
      test.skip(true, 'Failed to create invite.');
      return;
    }

    try {
      await page.goto(`/respond/${inviteId}`);
      await expect(page.getByRole('heading', { name: 'Share what you remember.' })).toBeVisible();

      const cookies = await page.context().cookies();
      const inviteCookie = cookies.find((cookie) => cookie.name === 'vals-memory-invite');
      expect(inviteCookie?.value).toBeTruthy();

      await page.goto('/score');
      await expect(page).not.toHaveURL(/\/auth\/login/);
      await expect(page.getByText('Valerie Park Anderson', { exact: true })).toBeVisible();

      await page.goto('/share');
      await expect(page).toHaveURL(/\/auth\/login/);
    } finally {
      await cleanupInvite(request, inviteId);
    }
  });

  test('admin dashboard loads for admins', async ({ page }) => {
    test.skip(
      !resolvedAdminEmail || !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET, ADMIN_EMAILS/E2E_ADMIN_EMAIL, and SUPABASE_SECRET_KEY.'
    );
    const params = new URLSearchParams({
      email: resolvedAdminEmail,
      secret: testLoginSecret,
    });
    await page.goto(`/api/test/login?${params.toString()}`);
    await page.waitForURL(/\/score/);
    await ensureAdminProfile(resolvedAdminEmail);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Review pending notes' })).toBeVisible();
  });
});
