import { test, expect } from '@playwright/test';
import { ensureAdminProfile } from './actors/admin';
import {
  cleanupContributor,
  cleanupInviteCode,
  cleanupProfile,
  cleanupTimelineEvent,
  cleanupTrustRequest,
  createContributorFixture,
  createInviteCodeFixture,
  createProfileFixture,
  createTrustRequestFixture,
} from './actors/db-fixtures';
import { adminClient, resolvedAdminEmail, testLoginSecret } from './actors/env';
import { login } from './pages/auth';
import { withFixtures } from './fixtures/with-fixtures';

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

      const checkEmailHeading = page.getByRole('heading', { name: 'Check your email' });
      const signupsBlocked = page.getByText('Signups not allowed for this instance');

      await Promise.race([
        checkEmailHeading.waitFor({ state: 'visible' }),
        signupsBlocked.waitFor({ state: 'visible' }),
      ]);

      if (await signupsBlocked.isVisible()) {
        await expect(signupsBlocked).toBeVisible();
        return;
      }

      await expect(checkEmailHeading).toBeVisible();
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
  const mockChatResponse = {
    message:
      'Based on notes from family members, Val was known for her warm hospitality. Her daughter Sarah shared that she always had fresh cookies ready for visitors.',
  };

  test('user can send a message and receive a response', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

    // Mock the chat API to avoid real LLM calls
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponse),
      });
    });

    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    await expect(page.getByRole('heading', { name: 'Chat with her patterns' })).toBeVisible();

    // Wait for chat to initialize (shows initial assistant message)
    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    // Type and send a message
    const input = page.getByPlaceholder('Ask about Val...');
    await input.fill('Tell me something about Val');
    await page.getByRole('button', { name: 'Send' }).click();

    // Should show user message
    await expect(page.getByText('Tell me something about Val')).toBeVisible();

    // Should show mocked assistant response
    await expect(page.getByText(/Val was known for her warm hospitality/)).toBeVisible();
  });

  test('suggested questions work', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

    // Mock the chat API
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponse),
      });
    });

    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    // Wait for initial message
    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    // Click a suggested question
    const suggestedButton = page.getByRole('button', { name: 'Tell me a funny story about Val' });
    await expect(suggestedButton).toBeVisible();
    await suggestedButton.click();

    // Message should appear in chat
    await expect(page.getByText('Tell me a funny story about Val')).toBeVisible();

    // Should show mocked response
    await expect(page.getByText(/Val was known for her warm hospitality/)).toBeVisible();
  });

  test('chat handles API error gracefully', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

    // Mock a failing chat API
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to process chat message' }),
      });
    });

    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    const input = page.getByPlaceholder('Ask about Val...');
    await input.fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();

    // Should show error message
    await expect(page.getByText(/something went wrong/i)).toBeVisible();
  });
});

test.describe('Admin trust request approval', () => {
  test('admin can approve a trust request', async ({ page }) => {
    test.skip(
      !resolvedAdminEmail || !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET, ADMIN_EMAILS/E2E_ADMIN_EMAIL, and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();

    await withFixtures(
      async (use) => {
        const contributor = await createContributorFixture({
          name: `E2E Trust Approve ${stamp}`,
          relation: 'family/friend',
          email: `e2e-trust-approve-${stamp}@example.com`,
          trusted: false,
        });
        if (!contributor?.id) {
          test.skip(true, 'Failed to create contributor fixture.');
        }
        const contributorId = use(contributor.id, () => cleanupContributor(contributor.id));

        const trustRequest = await createTrustRequestFixture({
          contributorId,
          message: 'Please trust me, I am a real family member.',
        });
        if (!trustRequest?.id) {
          test.skip(true, 'Failed to create trust request fixture.');
        }
        const trustRequestId = use(trustRequest.id, () => cleanupTrustRequest(trustRequest.id));

        return { contributorId, trustRequestId };
      },
      async ({ contributorId, trustRequestId }) => {
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
        data: { id: trustRequestId, status: 'approved' },
      });
      expect(approveRes.ok()).toBeTruthy();

      // Verify trust request was updated
      const { data: updatedRequest } = await adminClient
        .from('trust_requests')
        .select('status, resolved_at')
        .eq('id', trustRequestId)
        .single();
      expect((updatedRequest as { status?: string } | null)?.status).toBe('approved');
      expect((updatedRequest as { resolved_at?: string } | null)?.resolved_at).toBeTruthy();

      // Verify contributor is now trusted
      const { data: updatedContributor } = await adminClient
        .from('contributors')
        .select('trusted')
        .eq('id', contributorId)
        .single();
      expect((updatedContributor as { trusted?: boolean } | null)?.trusted).toBe(true);
      }
    );
  });

  test('admin can decline a trust request', async ({ page }) => {
    test.skip(
      !resolvedAdminEmail || !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET, ADMIN_EMAILS/E2E_ADMIN_EMAIL, and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();

    await withFixtures(
      async (use) => {
        const contributor = await createContributorFixture({
          name: `E2E Trust Decline ${stamp}`,
          relation: 'unknown',
          email: `e2e-trust-decline-${stamp}@example.com`,
          trusted: false,
        });
        if (!contributor?.id) {
          test.skip(true, 'Failed to create contributor fixture.');
        }
        const contributorId = use(contributor.id, () => cleanupContributor(contributor.id));

        const trustRequest = await createTrustRequestFixture({
          contributorId,
          message: 'I want trusted status.',
        });
        if (!trustRequest?.id) {
          test.skip(true, 'Failed to create trust request fixture.');
        }
        const trustRequestId = use(trustRequest.id, () => cleanupTrustRequest(trustRequest.id));

        return { contributorId, trustRequestId };
      },
      async ({ contributorId, trustRequestId }) => {
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
        data: { id: trustRequestId, status: 'declined' },
      });
      expect(declineRes.ok()).toBeTruthy();

      // Verify trust request was declined
      const { data: updatedRequest } = await adminClient
        .from('trust_requests')
        .select('status')
        .eq('id', trustRequestId)
        .single();
      expect((updatedRequest as { status?: string } | null)?.status).toBe('declined');

      // Verify contributor is still NOT trusted
      const { data: updatedContributor } = await adminClient
        .from('contributors')
        .select('trusted')
        .eq('id', contributorId)
        .single();
      expect((updatedContributor as { trusted?: boolean } | null)?.trusted).toBe(false);
      }
    );
  });
});

test.describe('Share memory flow', () => {
  test('authenticated user can share a memory', async ({ page }) => {
    test.skip(
      !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();
    const testEmail = `e2e-share-${stamp}@example.com`;

    await withFixtures(
      async (use) => {
        // Create contributor
        const contributor = await createContributorFixture({
          name: `E2E Share User ${stamp}`,
          relation: 'friend',
          email: testEmail,
          trusted: false,
        });
        if (!contributor) {
          test.skip(true, 'Failed to create contributor fixture.');
          return { contributorId: null, eventId: null, userId: null };
        }
        use(contributor, () => cleanupContributor(contributor.id));

        // Create profile for the user
        const profile = await createProfileFixture({
          email: testEmail,
          name: `E2E Share User ${stamp}`,
          relation: 'friend',
          contributorId: contributor.id,
        });
        if (!profile) {
          test.skip(true, 'Failed to create profile fixture.');
          return { contributorId: contributor.id, eventId: null, userId: null };
        }
        use(profile, () => cleanupProfile(profile.userId));

        return { contributorId: contributor.id, eventId: null as string | null, userId: profile.userId };
      },
      async ({ contributorId, userId }) => {
        if (!contributorId || !userId) return;

        // Login via test endpoint
        const params = new URLSearchParams({
          email: `e2e-share-${stamp}@example.com`,
          secret: testLoginSecret,
        });
        await page.goto(`/api/test/login?${params.toString()}`);
        await page.waitForURL(/\/score/);

        // Navigate to share page
        await page.goto('/share');
        await expect(page.getByRole('heading', { name: "Add to Valerie's score" })).toBeVisible();

        // Fill the form - entry type defaults to 'memory'

        // Select timing mode (year)
        await page.getByRole('button', { name: /^Around a year/i }).click();
        const yearInputs = page.getByRole('spinbutton');
        await yearInputs.first().fill('1995');

        // Select provenance (required)
        await page.getByRole('button', { name: /^I was there/i }).click();

        // Fill content (required)
        const memoryEditor = page.locator('.ProseMirror').first();
        await memoryEditor.click();
        await memoryEditor.fill(
          'This is a test memory from the E2E suite. Val loved to garden in the summer.'
        );

        // Fill title
        await page.getByPlaceholder(/A short title for this note/i).fill('Summer Gardening');

        // Submit
        const submit = page.getByRole('button', { name: 'Add This Memory' });
        await expect(submit).toBeEnabled();
        await submit.click();

        // Should see success screen
        await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
        await expect(page.getByText(/pending review/i)).toBeVisible();

        // Verify in database
        const { data: events } = await adminClient
          .from('timeline_events')
          .select('id, title, status, contributor_id')
          .eq('contributor_id', contributorId)
          .eq('title', 'Summer Gardening');

        expect(events).toBeTruthy();
        expect(events!.length).toBeGreaterThan(0);
        const event = events![0] as { id: string; title: string; status: string };
        expect(event.status).toBe('pending'); // untrusted contributor

        // Clean up the created event
        await cleanupTimelineEvent(event.id);
      }
    );
  });

  test('trusted user memory is published immediately', async ({ page }) => {
    test.skip(
      !testLoginSecret || !adminClient,
      'Set TEST_LOGIN_SECRET and SUPABASE_SECRET_KEY.'
    );

    const stamp = Date.now();
    const testEmail = `e2e-share-trusted-${stamp}@example.com`;

    await withFixtures(
      async (use) => {
        // Create trusted contributor
        const contributor = await createContributorFixture({
          name: `E2E Trusted User ${stamp}`,
          relation: 'family',
          email: testEmail,
          trusted: true,
        });
        if (!contributor) {
          test.skip(true, 'Failed to create contributor fixture.');
          return { contributorId: null, userId: null };
        }
        use(contributor, () => cleanupContributor(contributor.id));

        // Create profile
        const profile = await createProfileFixture({
          email: testEmail,
          name: `E2E Trusted User ${stamp}`,
          relation: 'family',
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

        // Login
        const params = new URLSearchParams({
          email: testEmail,
          secret: testLoginSecret,
        });
        await page.goto(`/api/test/login?${params.toString()}`);
        await page.waitForURL(/\/score/);

        // Navigate to share page
        await page.goto('/share');

        // Fill form
        await page.getByRole('button', { name: /^Around a year/i }).click();
        const yearInputs = page.getByRole('spinbutton');
        await yearInputs.first().fill('2000');

        // Select provenance (required)
        await page.getByRole('button', { name: /^I was there/i }).click();

        const memoryEditor = page.locator('.ProseMirror').first();
        await memoryEditor.click();
        await memoryEditor.fill('Trusted user memory - should be published immediately.');

        await page.getByPlaceholder(/A short title for this note/i).fill('Trusted Memory');

        // Submit
        const submit = page.getByRole('button', { name: 'Add This Memory' });
        await expect(submit).toBeEnabled();
        await submit.click();

        // Should see success with "published" message
        await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
        await expect(page.getByText(/part of The Score/i)).toBeVisible();

        // Verify status is published
        const { data: events } = await adminClient
          .from('timeline_events')
          .select('id, status')
          .eq('contributor_id', contributorId)
          .eq('title', 'Trusted Memory');

        expect(events).toBeTruthy();
        expect(events!.length).toBeGreaterThan(0);
        const event = events![0] as { id: string; status: string };
        expect(event.status).toBe('published');

        // Cleanup
        await cleanupTimelineEvent(event.id);
      }
    );
  });

  test('share page redirects to login when not authenticated', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    await page.goto('/share');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Input validation', () => {
  test('signup button disabled when required fields are empty', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { name: 'Join the family circle' })).toBeVisible();

    const submitButton = page.getByRole('button', { name: /Continue with magic link|Create account/i });

    // Initially disabled (all fields empty)
    await expect(submitButton).toBeDisabled();

    // Fill only invite code - still disabled
    await page.getByLabel(/Family invite code/i).fill('SOME-CODE');
    await expect(submitButton).toBeDisabled();

    // Add email - still disabled (missing name and relation)
    await page.getByLabel(/^Email/i).fill('test@example.com');
    await expect(submitButton).toBeDisabled();

    // Add name - still disabled (missing relation)
    await page.getByLabel(/Your name/i).fill('Test User');
    await expect(submitButton).toBeDisabled();

    // Add relation - now enabled
    await page.getByLabel(/Relationship to Val/i).fill('friend');
    await expect(submitButton).toBeEnabled();
  });

  test('chat send button disabled when input is empty', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

    // Mock the chat API (we don't need real responses for this test)
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Mocked response' }),
      });
    });

    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    // Wait for chat to initialize
    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    const sendButton = page.getByRole('button', { name: 'Send' });
    const input = page.getByPlaceholder('Ask about Val...');

    // Button should be disabled when input is empty
    await expect(sendButton).toBeDisabled();

    // Type whitespace only - still disabled
    await input.fill('   ');
    await expect(sendButton).toBeDisabled();

    // Type actual content - enabled
    await input.fill('Hello');
    await expect(sendButton).toBeEnabled();

    // Clear input - disabled again
    await input.fill('');
    await expect(sendButton).toBeDisabled();
  });

  test('chat handles empty message submission gracefully', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

    let chatApiCalled = false;
    await page.route('**/api/chat', async (route) => {
      chatApiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Should not see this' }),
      });
    });

    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');

    await expect(page.getByText(/Hello.*I'm here to help you learn about Val/i)).toBeVisible();

    // Get initial message count
    const initialMessages = await page.locator('[class*="ChatMessage"], [class*="chat-message"]').count();

    // Try to submit empty form (button is disabled, but test the form submission behavior)
    const input = page.getByPlaceholder('Ask about Val...');
    await input.fill('');
    await input.press('Enter');

    // Wait a bit to ensure no request was made
    await page.waitForTimeout(500);

    // No new messages should appear
    const currentMessages = await page.locator('[class*="ChatMessage"], [class*="chat-message"]').count();
    expect(currentMessages).toBe(initialMessages);

    // API should not have been called
    expect(chatApiCalled).toBe(false);
  });
});
