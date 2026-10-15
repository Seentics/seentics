import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes } from './helpers/mock-api';

/**
 * The first-use journey, from this app's side of the authentication boundary:
 *
 *   signed in (gateway cookie) -> add first website -> tracking code -> log out
 *   -> forwarded to the auth app -> back signed in -> straight to the dashboard
 *
 * Creating the account and typing credentials happen on the auth app (auth/web,
 * auth.seentics.com) now; this app's /signup and /signin only forward there. That half
 * is covered end to end by the whole-stack suite (e2e/tests/auth.spec.ts at the repo
 * root). What this app still owns is what it does with the session the auth app leaves
 * in the gateway's cookie: `AuthInitializer` reads it through `/user/auth/me`, because
 * the auth app's own localStorage is unreadable from here.
 *
 * The test used to fill a sign-up form on /signup. That page became a redirect, so the
 * test followed it to the live auth site and typed into the real form there.
 *
 * A small stateful gateway mock rather than a live database keeps the UI suite safe to
 * run locally and in CI while still exercising real navigation and request payloads.
 */
const AUTH_ORIGIN = new URL(process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.seentics.com').origin;

test('a new user can add their first website, sign out, and return straight to its dashboard', async ({ page }) => {
  // Two cold `next dev` compiles in one test (onboarding, then the dashboard).
  test.slow();

  const user = { id: 'user-e2e-1', name: 'Avery Example', email: 'avery@example.test' };
  const website = {
    id: 'website-e2e-1',
    site_id: 'website-e2e-1',
    name: 'Avery’s Store',
    url: 'https://store.example.test',
    user_id: user.id,
    is_verified: false,
  };
  const calls: string[] = [];
  let signedIn = true;
  let hasWebsite = false;

  // The auth app, stubbed: never followed out to the live site.
  await page.route(`${AUTH_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>auth app</body></html>' }),
  );

  await mockGlobalApiRoutes(page);

  // The gateway's cookie session, as the auth app left it.
  await page.route('**/user/auth/me', async (route) => {
    await route.fulfill(
      signedIn
        ? { status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user } }) }
        : { status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) },
    );
  });

  await page.route('**/user/auth/logout', async (route) => {
    calls.push('logout');
    signedIn = false;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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

  // First visit after signing up on the auth app: no websites yet, so onboarding.
  await page.goto('/websites');
  await expect(page.getByRole('heading', { name: 'Add your website' })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Website name').fill(website.name);
  await page.getByLabel('Website domain').fill('store.example.test');
  await page.getByRole('button', { name: /add website/i }).click();

  await expect(page.getByRole('heading', { name: 'Tracking code' })).toBeVisible();
  await expect(page.locator('pre')).toContainText(`data-website-id="${website.id}"`);
  expect(calls).toEqual(['create-website']);

  // Log out revokes the gateway session and hands over to the auth app's sign-in.
  await page.getByRole('button', { name: /log out/i }).click();
  await expect(page).toHaveURL(`${AUTH_ORIGIN}/signin`, { timeout: 20_000 });
  expect(calls).toEqual(['create-website', 'logout']);

  // Signing back in happens on the auth app; it leaves the cookie session behind and
  // sends the user here. With a website now, onboarding is skipped.
  signedIn = true;
  await page.goto('/websites');

  await expect(page).toHaveURL(new RegExp(`/websites/${website.id}`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Add your website' })).toHaveCount(0);
  expect(calls).toEqual(['create-website', 'logout']);
});
