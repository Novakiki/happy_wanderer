import { test, expect, request as playwrightRequest } from '@playwright/test';
import { ensureAdminProfile } from './actors/admin';
import { createClaimToken, createExpiredClaimToken, cleanupClaimToken } from './actors/claims';
import {
  cleanupContributor,
  cleanupEditToken,
  cleanupNote,
  cleanupTrustRequests,
  createContributorFixture,
  createEditTokenFixture,
  createPendingNoteFixture,
} from './actors/db-fixtures';
import { adminClient, baseUrl, fixtureEnabled, fixtureKey, resolvedAdminEmail, testLoginSecret } from './actors/env';
import { seedIdentityNote } from './actors/fixtures';
import { cleanupInvite, createInvite } from './actors/invites';

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
    const contributor = await createContributorFixture({
      name: `E2E Admin Review ${stamp}`,
      relation: 'family/friend',
      email: `e2e-admin-review-${stamp}@example.com`,
      trusted: false,
    });
    const contributorId = contributor?.id ?? null;
    if (!contributorId) {
      test.skip(true, 'Failed to create contributor fixture.');
      return;
    }

    const note = await createPendingNoteFixture({
      contributorId,
      year: 2001,
      title: `E2E Pending Note ${stamp}`,
      preview: 'Pending note for admin review.',
      full_entry: 'Pending note for admin review.',
      why_included: 'Admin review test.',
    });
    const noteId = note?.id ?? null;
    if (!noteId) {
      await cleanupContributor(contributorId);
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
      await cleanupNote(noteId);
      await cleanupContributor(contributorId);
    }
  });

  test('edit link shows trust request CTA for untrusted contributor', async ({ page }) => {
    test.skip(!adminClient, 'Set SUPABASE_URL and SUPABASE_SECRET_KEY.');

    const stamp = Date.now();
    const contributor = await createContributorFixture({
      name: `E2E Trust Request ${stamp}`,
      relation: 'family/friend',
      email: `e2e-trust-request-${stamp}@example.com`,
      trusted: false,
    });
    const contributorId = contributor?.id ?? null;
    if (!contributorId) {
      test.skip(true, 'Failed to create contributor fixture.');
      return;
    }

    const editToken = await createEditTokenFixture({ contributorId, hoursValid: 24 });
    const editTokenId = editToken?.id ?? null;
    const token = editToken?.token ?? null;
    if (!editTokenId || !token) {
      await cleanupContributor(contributorId);
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
      await cleanupTrustRequests(contributorId);
      await cleanupEditToken(editTokenId);
      await cleanupContributor(contributorId);
    }
  });
});
