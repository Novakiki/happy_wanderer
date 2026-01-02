import { expect, type Page } from '@playwright/test';

export async function fillNoteTitle(page: Page, title: string) {
  await page.getByTestId('share-note-title').fill(title);
}

export async function fillNoteContent(page: Page, text: string) {
  const editor = page.getByTestId('share-note-content');
  await editor.click();
  await editor.fill(text);
}

export async function submitNote(page: Page) {
  const submitButton = page.getByTestId('share-submit');
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
}
