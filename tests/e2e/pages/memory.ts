import { expect, type Locator, type Page } from '@playwright/test';

export async function openMemory(page: Page, noteId: string, title?: string) {
  await page.goto(`/memory/${noteId}`);
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
