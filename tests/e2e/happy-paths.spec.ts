import { test, expect } from '@playwright/test';
import { ensureAdminProfile } from './actors/admin';
import {
  cleanupContributor,
  cleanupInviteCode,
  cleanupTrustRequest,
  createContributorFixture,
  createInviteCodeFixture,
  createTrustRequestFixture,
} from './actors/db-fixtures';
import { adminClient, resolvedAdminEmail, testLoginSecret } from './actors/env';
import { login } from './pages/auth';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('Signup flow', () => {
  test('new user can sign up with invite code', async ({ page }) => {
    test.skip(!adminClient, 'Set SUPABASE_URL and SUPABASE_SECRET_KEY.');

    const stamp = Date.now();
    const inviteCode = await createInviteCodeFixture({
      code: `E2E-SIGNUP-${stamp}`,
      usesRemaining: 10,
    });

    if (!inviteCode) {
      test.skip(true, 'Failed to create invite code fixture.');
      return;
    }

    try {
      await page.goto('/auth/signup');
      await expect(page.getByRole('heading', { name: 'Join the family circle' })).toBeVisible();

      // Fill out the signup form
      await page.getByLabel(/Family invite code/i).fill(inviteCode.code);
      await page.getByLabel(/^Email/i).fill(`e2e-signup-${stamp}@example.com`);
      await page.getByLabel(/^Password/i).fill('testpassword123');
      await page.getByLabel(/Your name/i).fill('E2E Test User');
      await page.getByLabel(/Relationship to Val/i).fill('test friend');

      // Submit
      await page.getByRole('button', { name: /Create account/i }).click();

      // Should show check email step
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
      await expect(page.getByText(`e2e-signup-${stamp}@example.com`)).toBeVisible();
    } finally {
      await cleanupInviteCode(inviteCode.id);
      // Note: The Supabase user may have been created; in a real scenario you'd clean that up too
    }
  });

  test('signup fails with invalid invite code', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { name: 'Join the family circle' })).toBeVisible();

    // Fill form with invalid code
    await page.getByLabel(/Family invite code/i).fill('INVALID-CODE-12345');
    await page.getByLabel(/^Email/i).fill('invalid-test@example.com');
    await page.getByLabel(/Your name/i).fill('Test User');
    await page.getByLabel(/Relationship to Val/i).fill('friend');

    // Submit
    await page.getByRole('button', { name: /Continue with magic link/i }).click();

    // Should show error
    await expect(page.getByText(/Invalid invite code/i)).toBeVisible();
  });
});

test.describe('Chat interaction', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

  test('user can send a message and receive a response', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    await expect(page.getByRole('heading', { name: 'Chat with her patterns' })).toBeVisible();

    // Wait for chat to initialize (shows initial assistant message)
    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    // Type and send a message
    const input = page.getByPlaceholder('Ask about Val...');
    await input.fill('Tell me something about Val');

    const [response] = await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes('/api/chat') && resp.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Send' }).click(),
    ]);

    expect(response.ok()).toBeTruthy();

    // Should show user message
    await expect(page.getByText('Tell me something about Val')).toBeVisible();

    // Should show assistant response (wait for thinking to complete)
    await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 30000 });

    // Verify there's a second assistant message (the response)
    const assistantMessages = page.locator('[class*="bg-white"]').filter({
      hasText: /./,
    });
    await expect(assistantMessages).toHaveCount(2, { timeout: 30000 });
  });

  test('suggested questions work', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    // Wait for initial message
    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    // Click a suggested question
    const suggestedButton = page.getByRole('button', { name: 'Tell me a funny story about Val' });
    await expect(suggestedButton).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes('/api/chat') && resp.request().method() === 'POST'
      ),
      suggestedButton.click(),
    ]);

    expect(response.ok()).toBeTruthy();

    // Message should appear in chat
    await expect(page.getByText('Tell me a funny story about Val')).toBeVisible();
  });
});

test.describe('Admin trust request approval', () => {
  test('admin can approve a trust request', async ({ page }) => {
    test.skip(
      !resolvedAdminEmail || !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET, ADMIN_EMAILS/E2E_ADMIN_EMAIL, and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();

    // Create untrusted contributor with pending trust request
    const contributor = await createContributorFixture({
      name: `E2E Trust Approve ${stamp}`,
      relation: 'family/friend',
      email: `e2e-trust-approve-${stamp}@example.com`,
      trusted: false,
    });

    if (!contributor) {
      test.skip(true, 'Failed to create contributor fixture.');
      return;
    }

    const trustRequest = await createTrustRequestFixture({
      contributorId: contributor.id,
      message: 'Please trust me, I am a real family member.',
    });

    if (!trustRequest) {
      await cleanupContributor(contributor.id);
      test.skip(true, 'Failed to create trust request fixture.');
      return;
    }

    try {
      // Login as admin
      const params = new URLSearchParams({
        email: resolvedAdminEmail,
        secret: testLoginSecret,
      });
      await page.goto(`/api/test/login?${params.toString()}`);
      await page.waitForURL(/\/score/);
      await ensureAdminProfile(resolvedAdminEmail);

      // Approve via API
      const approveRes = await page.request.patch('/api/admin/trust-requests', {
        data: { id: trustRequest.id, status: 'approved' },
      });
      expect(approveRes.ok()).toBeTruthy();

      // Verify trust request was updated
      const { data: updatedRequest } = await adminClient
        .from('trust_requests')
        .select('status, resolved_at')
        .eq('id', trustRequest.id)
        .single();
      expect((updatedRequest as { status?: string } | null)?.status).toBe('approved');
      expect((updatedRequest as { resolved_at?: string } | null)?.resolved_at).toBeTruthy();

      // Verify contributor is now trusted
      const { data: updatedContributor } = await adminClient
        .from('contributors')
        .select('trusted')
        .eq('id', contributor.id)
        .single();
      expect((updatedContributor as { trusted?: boolean } | null)?.trusted).toBe(true);
    } finally {
      await cleanupTrustRequest(trustRequest.id);
      await cleanupContributor(contributor.id);
    }
  });

  test('admin can decline a trust request', async ({ page }) => {
    test.skip(
      !resolvedAdminEmail || !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET, ADMIN_EMAILS/E2E_ADMIN_EMAIL, and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();

    const contributor = await createContributorFixture({
      name: `E2E Trust Decline ${stamp}`,
      relation: 'unknown',
      email: `e2e-trust-decline-${stamp}@example.com`,
      trusted: false,
    });

    if (!contributor) {
      test.skip(true, 'Failed to create contributor fixture.');
      return;
    }

    const trustRequest = await createTrustRequestFixture({
      contributorId: contributor.id,
      message: 'I want trusted status.',
    });

    if (!trustRequest) {
      await cleanupContributor(contributor.id);
      test.skip(true, 'Failed to create trust request fixture.');
      return;
    }

    try {
      // Login as admin
      const params = new URLSearchParams({
        email: resolvedAdminEmail,
        secret: testLoginSecret,
      });
      await page.goto(`/api/test/login?${params.toString()}`);
      await page.waitForURL(/\/score/);
      await ensureAdminProfile(resolvedAdminEmail);

      // Decline via API
      const declineRes = await page.request.patch('/api/admin/trust-requests', {
        data: { id: trustRequest.id, status: 'declined' },
      });
      expect(declineRes.ok()).toBeTruthy();

      // Verify trust request was declined
      const { data: updatedRequest } = await adminClient
        .from('trust_requests')
        .select('status')
        .eq('id', trustRequest.id)
        .single();
      expect((updatedRequest as { status?: string } | null)?.status).toBe('declined');

      // Verify contributor is still NOT trusted
      const { data: updatedContributor } = await adminClient
        .from('contributors')
        .select('trusted')
        .eq('id', contributor.id)
        .single();
      expect((updatedContributor as { trusted?: boolean } | null)?.trusted).toBe(false);
    } finally {
      await cleanupTrustRequest(trustRequest.id);
      await cleanupContributor(contributor.id);
    }
  });
});
