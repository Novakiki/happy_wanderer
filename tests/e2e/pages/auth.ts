import { expect, type Cookie, type Page, test } from '@playwright/test';

type LoginOptions = {
  email: string;
  password: string;
  /**
   * When true, use the exact email provided instead of generating a unique per-worker email.
   * Use this for tests that require a specific pre-seeded user (e.g., identity claim tests).
   * Warning: may cause flakiness if multiple workers use the same email concurrently.
   */
  useExactEmail?: boolean;
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

const workerLoginEmail = new Map<number, string>();
const workerAuthCookies = new Map<number, Array<Cookie>>();

export async function login(page: Page, { email, password, useExactEmail }: LoginOptions) {
  const testSecret = process.env.TEST_LOGIN_SECRET;
  if (testSecret) {
    // Many e2e tests run in parallel workers. Supabase magiclink OTPs can race if multiple
    // workers request OTPs for the same email at the same time. To avoid flakiness *and*
    // avoid creating a new auth user for every test, use a stable unique email per worker.
    //
    // Exception: useExactEmail=true bypasses this for tests that need a specific pre-seeded
    // user (e.g., identity claim tests where the claim only exists for the exact email).
    const workerIndex = test.info().workerIndex;
    const resolvedEmail = useExactEmail
      ? email
      : (workerLoginEmail.get(workerIndex) ?? makeUniqueEmail(email));
    if (!useExactEmail) {
      workerLoginEmail.set(workerIndex, resolvedEmail);
    }

    // Also stash it on the browser context so other helpers can reuse it.
    const ctx = page.context() as unknown as { __e2eLoginEmail?: string };
    ctx.__e2eLoginEmail = resolvedEmail;

    const params = new URLSearchParams({ email: resolvedEmail, secret: testSecret });
    const loginUrl = `/api/test/login?${params.toString()}`;

    // If we've already logged in successfully in this worker, reuse the session cookies
    // to avoid repeatedly hammering the test-login endpoint (which can fail under load).
    // Skip cookie caching for useExactEmail since the cache is keyed by worker index,
    // not by email, and mixing exact/unique emails would cause auth issues.
    const cookieJar = page.context();
    if (!useExactEmail) {
      const cachedCookies = workerAuthCookies.get(workerIndex);
      if (cachedCookies && cachedCookies.length > 0) {
        await cookieJar.addCookies(cachedCookies);
        await page.goto('/score');
        if (page.url().includes('/score')) {
          await expect(page).toHaveURL(/\/score/);
          return;
        }
      }
    }

    // `/api/test/login` occasionally fails under load (e.g. transient Supabase errors).
    // Retry a few times to keep smoke runs reliable.
    let res = await page.goto(loginUrl);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (!page.url().includes('/api/test/login')) break;
      await page.waitForTimeout(250 * attempt);
      res = await page.goto(loginUrl);
    }

    // If login fails, the endpoint responds with JSON and does not redirect to /score.
    if (page.url().includes('/api/test/login')) {
      const bodyText = await page.textContent('body').catch(() => '');
      throw new Error(
        `Test login did not redirect to /score (status=${res?.status() ?? 'unknown'}). Body: ${bodyText ?? ''}`
      );
    }

    await page.waitForURL(/\/score/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/score/);

    // Cache cookies for this worker so subsequent tests can reuse the session.
    // Skip caching for useExactEmail to avoid mixing auth contexts.
    if (!useExactEmail) {
      const freshCookies = await cookieJar.cookies();
      workerAuthCookies.set(workerIndex, freshCookies);
    }
    return;
  }

  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/score');
  await expect(page).toHaveURL(/\/score/);
}
