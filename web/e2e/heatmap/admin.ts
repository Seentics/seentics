import { expect, type Page } from '@playwright/test';

// The Docker stack is shared by the serial specs in this directory. Keeping one
// known admin lets either spec be run alone (it bootstraps) or together (it signs in).
const admin = {
  name: 'Recording E2E',
  email: 'recording-e2e@example.test',
  password: 'RecordingTest123!',
};

export async function signInOrSetUpAdmin(page: Page): Promise<string> {
  await page.goto('/setup');
  await expect(page.locator('body')).toContainText(/Set up your instance|Already Set Up/);

  let login;
  if (await page.locator('input[name="name"]').isVisible()) {
    await page.locator('input[name="name"]').fill(admin.name);
    await page.locator('input[name="email"]').fill(admin.email);
    await page.locator('input[name="password"]').fill(admin.password);
    await page.locator('input[name="confirmPassword"]').fill(admin.password);
    login = page.waitForResponse(r => r.url().endsWith('/user/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Initialize Seentics' }).click();
  } else {
    await page.getByRole('link', { name: 'Go to Sign In' }).click();
    await page.locator('input[name="email"]').fill(admin.email);
    await page.locator('input[name="password"]').fill(admin.password);
    login = page.waitForResponse(r => r.url().endsWith('/user/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
  }

  const response = await login;
  expect(response.ok(), await response.text()).toBe(true);
  const body = await response.json();
  const token = body.data?.tokens?.access_token as string | undefined;
  expect(token).toBeTruthy();
  return token!;
}
