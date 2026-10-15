import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes } from './helpers/mock-api';

/**
 * This app's way in to the auth app.
 *
 * Sign-in, sign-up, password reset, email verification and invites live in their own app
 * now (auth/web, auth.seentics.com), shared by every product in the suite. This app's old
 * paths only forward there, query intact, so bookmarks and emailed links keep working.
 *
 * This file used to type into sign-in and sign-up forms on /signin and /signup. Those
 * pages became redirects, so the tests followed them out to the live auth site and
 * asserted on whatever that answered — "rejects a password under the length floor" failed
 * when the real form's floor moved from 8 to 12 characters. The forms' own behaviour, and
 * the session they produce, are tested end to end by the whole-stack suite
 * (e2e/tests/auth.spec.ts at the repo root).
 *
 * Covered elsewhere in this directory: /signin, /auth/callback, /auth/google/callback,
 * /forgot-password and /reset-password forwards (auth-session.spec.ts).
 */
const AUTH_ORIGIN = new URL(process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.seentics.com').origin;

test.beforeEach(async ({ page }) => {
  // Anything off this machine is refused, and the auth app is stubbed, so no test here
  // can reach the live site again.
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) =>
      route.request().url().startsWith(AUTH_ORIGIN)
        ? route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>auth app</body></html>' })
        : route.abort(),
  );
  await mockGlobalApiRoutes(page);
});

test.describe('Old auth paths forward to the auth app', () => {
  const cases = [
    // Whatever an old link or campaign put on the query reaches the auth app.
    ['/signup', '?ref=newsletter&utm_source=email'],
    ['/verify-email', '?token=abc'],
    ['/accept-invite', '?token=abc'],
  ] as const;

  for (const [path, query] of cases) {
    test(`${path} forwards with its query intact`, async ({ page }) => {
      await page.goto(`${path}${query}`);

      await expect(page).toHaveURL(`${AUTH_ORIGIN}${path}${query}`);
    });
  }
});

test.describe('Landing header', () => {
  test('"Sign in" takes a visitor to the auth app\'s sign-in', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Sign in', exact: true }).click();

    await expect(page).toHaveURL(`${AUTH_ORIGIN}/signin`, { timeout: 15_000 });
  });

  test('"Get Started" takes a visitor to the auth app\'s sign-up', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Get Started', exact: true }).click();

    await expect(page).toHaveURL(`${AUTH_ORIGIN}/signup`, { timeout: 15_000 });
  });
});
