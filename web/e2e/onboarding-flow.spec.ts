import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes } from './helpers/mock-api';
import { signinForm, signupForm } from './helpers/auth-forms';

/**
 * The first-use journey crosses the authentication boundary and the websites
 * boundary.  The focused auth and dashboard specs cover their error states;
 * this test protects the contract between them:
 *
 *   register -> automatic login -> create first website -> sign out -> sign in
 *
 * It uses a small stateful gateway mock rather than a live database.  That keeps
 * the UI suite safe to run locally and in CI while still exercising the actual
 * browser navigation, persisted auth store, request payloads, and onboarding UI.
 */
test('a new user can create an account, add their first website, and return by signing in', async ({ page }) => {
  const user = { id: 'user-e2e-1', name: 'Avery Example', email: 'avery@example.test' };
  const website = {
    id: 'website-e2e-1',
    site_id: 'website-e2e-1',
    name: 'Avery’s Store',
    url: 'https://store.example.test',
    user_id: user.id,
    is_verified: false,
  };
  const tokens = {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
  };
  const calls: string[] = [];
  let hasWebsite = false;

  await mockGlobalApiRoutes(page);

  await page.route('**/user/auth/register', async (route) => {
    calls.push('register');
    expect(route.request().postDataJSON()).toEqual({
      name: user.name,
      email: user.email,
      password: 'Password123!',
    });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'User registered successfully' }),
    });
  });

  await page.route('**/user/auth/login', async (route) => {
    calls.push('login');
    expect(route.request().postDataJSON()).toEqual({
      email: user.email,
      password: 'Password123!',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user, tokens } }),
    });
  });

  await page.route('**/user/websites', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: hasWebsite ? [website] : [] }),
      });
      return;
    }

    calls.push('create-website');
    expect(route.request().headers().authorization).toBe(`Bearer ${tokens.access_token}`);
    expect(route.request().postDataJSON()).toEqual({
      name: website.name,
      url: website.url,
      userId: user.id,
    });
    hasWebsite = true;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { website } }),
    });
  });

  await page.goto('/signup');
  const signup = signupForm(page);
  await signup.name.fill(user.name);
  await signup.email.fill(user.email);
  await signup.password.fill('Password123!');
  await signup.confirmPassword.fill('Password123!');
  await signup.submit.click();

  await expect(page).toHaveURL(/\/websites$/);
  await expect(page.getByRole('heading', { name: 'Add your website' })).toBeVisible();

  await page.getByLabel('Website name').fill(website.name);
  await page.getByLabel('Website domain').fill('store.example.test');
  await page.getByRole('button', { name: /add website/i }).click();

  await expect(page.getByRole('heading', { name: 'Tracking code' })).toBeVisible();
  await expect(page.locator('pre')).toContainText(`data-website-id="${website.id}"`);
  expect(calls).toEqual(['register', 'login', 'create-website']);

  // A fresh visit should restore the persisted session and skip first-site
  // onboarding because the website created above now belongs to this user.
  await page.getByRole('button', { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/signin/);

  const signin = signinForm(page);
  await signin.email.fill(user.email);
  await signin.password.fill('Password123!');
  await signin.submit.click();

  await expect(page).toHaveURL(new RegExp(`/websites/${website.id}`));
  expect(calls).toEqual(['register', 'login', 'create-website', 'login']);
});
