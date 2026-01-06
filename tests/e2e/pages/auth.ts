import { expect, type Page } from '@playwright/test';

type LoginOptions = {
  email: string;
  password: string;
};

function makeUniqueEmail(baseEmail: string) {
  const trimmed = baseEmail.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  }

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Use plus-addressing when possible. If the email already contains '+', append another suffix.
  return `${local}+e2e-${stamp}@${domain}`;
}

export async function login(page: Page, { email, password }: LoginOptions) {
  const testSecret = process.env.TEST_LOGIN_SECRET;
  if (testSecret) {
    // Many e2e tests run in parallel workers. Supabase magiclink OTPs can race if multiple
    // workers request OTPs for the same email at the same time. To avoid flakiness, use a
    // unique email per browser context when using TEST_LOGIN_SECRET.
    const ctx = page.context() as unknown as { __e2eLoginEmail?: string };
    const resolvedEmail = ctx.__e2eLoginEmail ?? makeUniqueEmail(email);
    ctx.__e2eLoginEmail = resolvedEmail;

    const params = new URLSearchParams({ email: resolvedEmail, secret: testSecret });
    const res = await page.goto(`/api/test/login?${params.toString()}`);

    // If login fails, the endpoint responds with JSON and does not redirect to /score.
    if (page.url().includes('/api/test/login')) {
      const bodyText = await page.textContent('body').catch(() => '');
      throw new Error(
        `Test login did not redirect to /score (status=${res?.status() ?? 'unknown'}). Body: ${bodyText ?? ''}`
      );
    }

    await page.waitForURL(/\/score/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/score/);
    return;
  }

  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/score');
  await expect(page).toHaveURL(/\/score/);
}
