import { expect, type Locator, type Page } from '@playwright/test';

export async function openMemory(page: Page, noteId: string, title?: string, bustCache = false) {
  // Add cache-busting param when testing visibility changes to ensure fresh data
  const url = bustCache ? `/memory/${noteId}?_t=${Date.now()}` : `/memory/${noteId}`;
  await page.goto(url);
  if (title) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
}

export function memoryContent(page: Page): Locator {
  return page.getByTestId('memory-content');
}

export async function expectMemoryContentHas(page: Page, matcher: RegExp, shouldContain: boolean) {
  const content = memoryContent(page);
  await expect(content).toBeVisible();
  if (shouldContain) {
    await expect(content).toContainText(matcher);
  } else {
    await expect(content).not.toContainText(matcher);
  }
}

/**
 * Like expectMemoryContentHas but with retry for visibility propagation delays.
 * Reloads the page up to maxRetries times if the check fails.
 */
export async function expectMemoryContentHasWithRetry(
  page: Page,
  noteId: string,
  title: string | undefined,
  matcher: RegExp,
  shouldContain: boolean,
  maxRetries = 3
) {
  let lastContent = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await openMemory(page, noteId, title, true);
      const content = memoryContent(page);
      await expect(content).toBeVisible();
      lastContent = await content.textContent() ?? '';
      if (shouldContain) {
        await expect(content).toContainText(matcher, { timeout: 5000 });
      } else {
        await expect(content).not.toContainText(matcher, { timeout: 5000 });
      }
      return; // Success
    } catch {
      if (attempt === maxRetries) {
        throw new Error(
          `Memory content check failed after ${maxRetries + 1} attempts. ` +
          `Expected ${shouldContain ? '' : 'NOT '}to match "${matcher.source}". ` +
          `Last content: "${lastContent.substring(0, 200)}..."`
        );
      }
      await page.waitForTimeout(1000 * (attempt + 1)); // Increasing delay between retries
    }
  }
}
