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

const createClaimToken = async (inviteId: string, eventId: string) => {
  if (!adminClient) return null;
  const token = crypto.randomUUID();
  const { data: claim, error } = await adminClient
    .from('claim_tokens')
    .insert({
      token,
      invite_id: inviteId,
      recipient_name: 'E2E Claim Test',
      recipient_phone: '+15551234567',
      event_id: eventId,
      sms_status: 'sent',
    })
    .select('id, token')
    .single();

  if (error || !claim) return null;
  return { id: claim.id, token: claim.token };
};

const cleanupClaimToken = async (claimId: string | null) => {
  if (!claimId || !adminClient) return;
  await adminClient.from('claim_tokens').delete().eq('id', claimId);
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

  test('claim token flow allows visibility control', async ({ page, request }) => {
    test.skip(!fixtureEnabled || !fixtureKey || !adminClient, 'Enable fixtures to run claim tests.');

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

    const claimData = await createClaimToken(inviteId, eventId);
    if (!claimData) {
      await cleanupInvite(request, inviteId);
      test.skip(true, 'Failed to create claim token.');
      return;
    }

    try {
      // Navigate to claim page
      await page.goto(`/claim/${claimData.token}`);
      await expect(page.getByRole('heading', { name: 'Choose how your name appears.' })).toBeVisible();

      // Verify context is shown
      await expect(page.getByText('You were mentioned by')).toBeVisible();

      // Select visibility option (blurred)
      await page.getByLabel('Show initials only').click();

      // Submit
      await page.getByRole('button', { name: 'Save my preference' }).click();

      // Verify success
      await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible();
      await expect(page.getByText('initials only')).toBeVisible();

      // Verify token was marked as used
      const { data: updatedToken } = await adminClient
        .from('claim_tokens')
        .select('used_at')
        .eq('id', claimData.id)
        .single();
      expect((updatedToken as { used_at: string | null } | null)?.used_at).toBeTruthy();
    } finally {
      await cleanupClaimToken(claimData.id);
      await cleanupInvite(request, inviteId);
    }
  });

  test('expired claim token shows error', async ({ page, request }) => {
    test.skip(!fixtureEnabled || !fixtureKey || !adminClient, 'Enable fixtures to run claim tests.');

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

    // Create an expired token
    const token = crypto.randomUUID();
    const { data: claim } = await adminClient
      .from('claim_tokens')
      .insert({
        token,
        invite_id: inviteId,
        recipient_name: 'E2E Expired Test',
        recipient_phone: '+15551234567',
        event_id: eventId,
        expires_at: new Date(Date.now() - 1000).toISOString(), // Already expired
        sms_status: 'sent',
      })
      .select('id')
      .single();

    const claimId = (claim as { id: string } | null)?.id ?? null;

    try {
      await page.goto(`/claim/${token}`);
      await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
      await expect(page.getByText('invalid or has expired')).toBeVisible();
    } finally {
      if (claimId) await cleanupClaimToken(claimId);
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

  test('admin can update notes and trust contributors', async ({ page }) => {
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

    const stamp = Date.now();
    const { data: contributor } = await adminClient
      .from('contributors')
      .insert({
        name: `E2E Admin Review ${stamp}`,
        relation: 'family/friend',
        email: `e2e-admin-review-${stamp}@example.com`,
        trusted: false,
      })
      .select('id')
      .single();

    const contributorId = (contributor as { id?: string } | null)?.id ?? null;
    if (!contributorId) {
      test.skip(true, 'Failed to create contributor fixture.');
      return;
    }

    const { data: note } = await adminClient
      .from('timeline_events')
      .insert({
        year: 2001,
        type: 'memory',
        title: `E2E Pending Note ${stamp}`,
        preview: 'Pending note for admin review.',
        full_entry: 'Pending note for admin review.',
        why_included: 'Admin review test.',
        status: 'pending',
        privacy_level: 'family',
        contributor_id: contributorId,
      })
      .select('id')
      .single();

    const noteId = (note as { id?: string } | null)?.id ?? null;
    if (!noteId) {
      await adminClient.from('contributors').delete().eq('id', contributorId);
      test.skip(true, 'Failed to create pending note fixture.');
      return;
    }

    try {
      const publishRes = await page.request.patch('/api/admin/notes', {
        data: { id: noteId, status: 'published' },
      });
      expect(publishRes.ok()).toBeTruthy();

      const trustRes = await page.request.patch('/api/admin/contributors', {
        data: { contributor_id: contributorId, trusted: true },
      });
      expect(trustRes.ok()).toBeTruthy();

      const { data: updatedNote } = await adminClient
        .from('timeline_events')
        .select('status')
        .eq('id', noteId)
        .single();
      expect((updatedNote as { status?: string } | null)?.status).toBe('published');

      const { data: updatedContributor } = await adminClient
        .from('contributors')
        .select('trusted')
        .eq('id', contributorId)
        .single();
      expect((updatedContributor as { trusted?: boolean } | null)?.trusted).toBe(true);
    } finally {
      await adminClient.from('timeline_events').delete().eq('id', noteId);
      await adminClient.from('contributors').delete().eq('id', contributorId);
    }
  });

  test('edit link shows trust request CTA for untrusted contributor', async ({ page }) => {
    test.skip(!adminClient, 'Set SUPABASE_URL and SUPABASE_SECRET_KEY.');

    const stamp = Date.now();
    const { data: contributor } = await adminClient
      .from('contributors')
      .insert({
        name: `E2E Trust Request ${stamp}`,
        relation: 'family/friend',
        email: `e2e-trust-request-${stamp}@example.com`,
        trusted: false,
      })
      .select('id')
      .single();

    const contributorId = (contributor as { id?: string } | null)?.id ?? null;
    if (!contributorId) {
      test.skip(true, 'Failed to create contributor fixture.');
      return;
    }

    const token = crypto.randomUUID();
    const { data: editToken } = await adminClient
      .from('edit_tokens')
      .insert({
        token,
        contributor_id: contributorId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    const editTokenId = (editToken as { id?: string } | null)?.id ?? null;
    if (!editTokenId) {
      await adminClient.from('contributors').delete().eq('id', contributorId);
      test.skip(true, 'Failed to create edit token fixture.');
      return;
    }

    try {
      await page.goto(`/edit/${token}`);
      await page.waitForResponse((res) => res.url().includes('/api/edit/session') && res.ok());

      const requestButton = page.getByRole('button', { name: 'Request trusted status' });
      await expect(requestButton).toBeVisible();
      await requestButton.click();
      await expect(page.getByText('Trusted status request received')).toBeVisible();
    } finally {
      await adminClient.from('trust_requests').delete().eq('contributor_id', contributorId);
      await adminClient.from('edit_tokens').delete().eq('id', editTokenId);
      await adminClient.from('contributors').delete().eq('id', contributorId);
    }
  });
});
