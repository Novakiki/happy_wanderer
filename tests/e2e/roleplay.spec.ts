import { test, expect, request as playwrightRequest } from '@playwright/test';
import { ensureAdminProfile } from './actors/admin';
import { createClaimToken, createExpiredClaimToken, cleanupClaimToken } from './actors/claims';
import {
  cleanupContributor,
  cleanupEditToken,
  cleanupNote,
  cleanupProfile,
  cleanupTrustRequests,
  createContributorFixture,
  createEditTokenFixture,
  createPendingNoteFixture,
  createProfileFixture,
} from './actors/db-fixtures';
import { adminClient, baseUrl, fixtureEnabled, fixtureKey, resolvedAdminEmail, testLoginSecret } from './actors/env';
import { seedIdentityNote } from './actors/fixtures';
import { cleanupInvite, createInvite } from './actors/invites';
import { withFixtures } from './fixtures/with-fixtures';

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

    const claimData = await createExpiredClaimToken(inviteId, eventId);
    if (!claimData) {
      await cleanupInvite(request, inviteId);
      test.skip(true, 'Failed to create expired claim token.');
      return;
    }

    try {
      await page.goto(`/claim/${claimData.token}`);
      await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
      await expect(page.getByText('invalid or has expired')).toBeVisible();
    } finally {
      await cleanupClaimToken(claimData.id);
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

    await withFixtures(
      async (use) => {
        const contributor = await createContributorFixture({
          name: `E2E Admin Review ${stamp}`,
          relation: 'family/friend',
          email: `e2e-admin-review-${stamp}@example.com`,
          trusted: false,
        });
        if (!contributor?.id) {
          test.skip(true, 'Failed to create contributor fixture.');
          return { contributorId: null, noteId: null };
        }
        const contributorId = use(contributor.id, () => cleanupContributor(contributor.id));

        const note = await createPendingNoteFixture({
          contributorId,
          year: 2001,
          title: `E2E Pending Note ${stamp}`,
          preview: 'Pending note for admin review.',
          full_entry: 'Pending note for admin review.',
          why_included: 'Admin review test.',
        });
        if (!note?.id) {
          test.skip(true, 'Failed to create pending note fixture.');
          return { contributorId, noteId: null };
        }
        const noteId = use(note.id, () => cleanupNote(note.id));

        return { contributorId, noteId };
      },
      async ({ contributorId, noteId }) => {
        if (!contributorId || !noteId) return;
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
      }
    );
  });

  test('edit link shows trust request CTA for untrusted contributor', async ({ page }) => {
    test.skip(!adminClient, 'Set SUPABASE_URL and SUPABASE_SECRET_KEY.');

    const stamp = Date.now();

    await withFixtures(
      async (use) => {
        const contributor = await createContributorFixture({
          name: `E2E Trust Request ${stamp}`,
          relation: 'family/friend',
          email: `e2e-trust-request-${stamp}@example.com`,
          trusted: false,
        });
        if (!contributor?.id) {
          test.skip(true, 'Failed to create contributor fixture.');
          return { token: null as string | null };
        }
        const contributorId = use(contributor.id, () => cleanupContributor(contributor.id));

        const editToken = await createEditTokenFixture({ contributorId, hoursValid: 24 });
        if (!editToken?.id || !editToken?.token) {
          test.skip(true, 'Failed to create edit token fixture.');
          return { token: null as string | null };
        }
        use(contributorId, () => cleanupTrustRequests(contributorId));
        const token = editToken.token;
        use(editToken.id, () => cleanupEditToken(editToken.id));

        return { token };
      },
      async ({ token }) => {
        if (!token) return;
        await page.goto(`/edit/${token}`);
        await page.waitForResponse((res) => res.url().includes('/api/edit/session') && res.ok());

        const requestButton = page.getByRole('button', { name: 'Request trusted status' });
        await expect(requestButton).toBeVisible();
        await requestButton.click();
        await expect(page.getByText('Trusted status request received')).toBeVisible();
      }
    );
  });

  test('non-admin user cannot access admin dashboard', async ({ page }) => {
    test.skip(
      !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();
    const testEmail = `e2e-nonadmin-${stamp}@example.com`;

    await withFixtures(
      async (use) => {
        // Create a regular (non-admin) contributor
        const contributor = await createContributorFixture({
          name: `E2E Non-Admin ${stamp}`,
          relation: 'friend',
          email: testEmail,
          trusted: false,
        });
        if (!contributor) {
          test.skip(true, 'Failed to create contributor fixture.');
          return { contributorId: null, userId: null };
        }
        use(contributor, () => cleanupContributor(contributor.id));

        // Create profile
        const profile = await createProfileFixture({
          email: testEmail,
          name: `E2E Non-Admin ${stamp}`,
          relation: 'friend',
          contributorId: contributor.id,
        });
        if (!profile) {
          test.skip(true, 'Failed to create profile fixture.');
          return { contributorId: contributor.id, userId: null };
        }
        use(profile, () => cleanupProfile(profile.userId));

        return { contributorId: contributor.id, userId: profile.userId };
      },
      async ({ contributorId, userId }) => {
        if (!contributorId || !userId) return;

        // Login as non-admin user
        const params = new URLSearchParams({
          email: testEmail,
          secret: testLoginSecret,
        });
        await page.goto(`/api/test/login?${params.toString()}`);
        await page.waitForURL(/\/score/);

        // Try to access admin page
        const response = await page.goto('/admin');

        // Should get 404 (notFound())
        expect(response?.status()).toBe(404);
      }
    );
  });

  test('unauthenticated user is redirected from admin', async ({ page }) => {
    // Clear any session
    await page.context().clearCookies();

    await page.goto('/admin');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
