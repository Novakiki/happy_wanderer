import { expect, type Locator, type Page } from '@playwright/test';

type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed' | 'pending';

export async function openSettings(page: Page) {
  await page.goto('/settings');
}

export async function setDefaultVisibility(page: Page, visibility: Exclude<Visibility, 'pending'>) {
  const button = page.getByTestId(`identity-default-${visibility}`);
  await button.click();
  await expect(page.getByText('Default visibility updated.')).toBeVisible();
}

export function noteVisibilitySelect(page: Page, referenceId: string): Locator {
  return page.getByTestId(`note-visibility-${referenceId}`);
}

export async function toggleAllNotes(page: Page) {
  const toggle = page.getByTestId('identity-notes-toggle');
  await toggle.click();
}

export function authorToggle(page: Page, authorId: string): Locator {
  return page.getByTestId(`identity-author-${authorId}`);
}
