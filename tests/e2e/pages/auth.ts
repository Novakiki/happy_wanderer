import { expect, type Page } from '@playwright/test';

type LoginOptions = {
  email: string;
  password: string;
};

export async function login(page: Page, { email, password }: LoginOptions) {
  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/score');
  await expect(page).toHaveURL(/\/score/);
}
