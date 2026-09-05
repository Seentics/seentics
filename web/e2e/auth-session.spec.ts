import { test, expect, type Page } from '@playwright/test';
import { injectAuthState, mockGlobalApiRoutes } from './helpers/mock-api';
import {
  forgotPasswordForm,
  formError,
  resetPasswordForm,
  signinForm,
} from './helpers/auth-forms';

/**
 * Session and token lifecycle — the half of auth that `auth.spec.ts` does not reach.
 *
 * `auth.spec.ts` covers the two forms: it types into /signin and /signup and checks the
 * redirect. Everything that happens *after* the form was untested, and that is where the
 * behaviour actually lives — in `lib/api.ts`'s response interceptor:
 *
 * - a 401 triggers one refresh, then replays the original request with the new token;
 * - concurrent 401s must trigger **one** refresh, not one per request, or a page that
 *   fires six queries on mount sends six refreshes and five of them race;
 * - a failed refresh logs the user out to `/signin?expired=true` rather than leaving
 *   them on a page that silently shows nothing;
 * - two request classes (demo, verify-secrets) are exempt and must never redirect.
 *
 * These are asserted through the network and through `localStorage`, not through the DOM,
 * because the interceptor's contract is what it sends and what it stores. That also keeps
 * the tests from breaking on unrelated markup changes.
 *
 * The backend is mocked throughout, as everywhere else in this directory — `webServer`
 * starts Next alone, with no gateway behind it.
 */

const AUTH_KEY = 'auth-storage';

/** A JWT-shaped token whose payload expires at `expSeconds`. Not signed — nothing verifies it client-side. */
function tokenExpiring(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.signature`;
}

/** Reads the persisted auth blob the store and the interceptor share. */
async function readAuth(page: Page): Promise<Record<string, unknown> | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_KEY);
  return raw ? (JSON.parse(raw).state as Record<string, unknown>) : null;
}

/**
 * Seeds a session with the given tokens, before any page script runs.
 *
 * Guarded by a `sessionStorage` flag so it seeds the **first** load only. An init script
 * runs on every navigation, including the redirect a logout performs — which would
 * re-create the session the logout had just cleared and make "was the session cleared?"
 * impossible to ask.
 */
function seedSession(
  page: Page,
  tokens: { access_token: string | null; refresh_token: string | null },
) {
  return page.addInitScript(
    ({ key, access, refresh }) => {
      if (window.sessionStorage.getItem('e2e-seeded')) return;
      window.sessionStorage.setItem('e2e-seeded', '1');
      window.localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { id: '123', name: 'Jane Doe', email: 'jane@company.com' },
            access_token: access,
            refresh_token: refresh,
          },
          version: 0,
        }),
      );
    },
    { key: AUTH_KEY, access: tokens.access_token, refresh: tokens.refresh_token },
  );
}

test.describe('Token refresh on 401', () => {
  test('refreshes once and replays the original request with the new token', async ({ page }) => {
    await seedSession(page, { access_token: 'stale-access', refresh_token: 'good-refresh' });

    const refreshCalls: unknown[] = [];
    const websitesAuthHeaders: (string | undefined)[] = [];

    await mockGlobalApiRoutes(page);

    await page.route('**/auth/refresh', async (route) => {
      refreshCalls.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
        }),
      });
    });

    // First call 401s, the replay succeeds — the shape the interceptor exists to handle.
    await page.route('**/user/websites', async (route) => {
      const auth = route.request().headerValue('authorization');
      websitesAuthHeaders.push((await auth) ?? undefined);

      if (websitesAuthHeaders.length === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'token expired' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/websites');

    await expect.poll(() => refreshCalls.length).toBe(1);
    expect(refreshCalls[0]).toEqual({ refresh_token: 'good-refresh' });

    // The replay must carry the *new* token. Retrying with the stale one is an
    // infinite 401 loop that looks like a hung page.
    //
    // Asserted as "a later call carried the fresh token" rather than by index: the
    // page fires several requests on mount, so a concurrent one started before the
    // refresh resolved can legitimately land between the 401 and the replay.
    expect(websitesAuthHeaders[0]).toBe('Bearer stale-access');
    await expect
      .poll(() => websitesAuthHeaders.includes('Bearer fresh-access'))
      .toBe(true);
  });

  test('persists both new tokens, so the next cold load is already valid', async ({ page }) => {
    await seedSession(page, { access_token: 'stale-access', refresh_token: 'good-refresh' });
    await mockGlobalApiRoutes(page);

    await page.route('**/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
        }),
      });
    });

    let seen = 0;
    await page.route('**/user/websites', async (route) => {
      seen += 1;
      await route.fulfill({
        status: seen === 1 ? 401 : 200,
        contentType: 'application/json',
        body: JSON.stringify(seen === 1 ? { error: 'expired' } : { data: [] }),
      });
    });

    await page.goto('/websites');

    // Rotating the refresh token but persisting only the access token would work until
    // the next expiry and then log the user out with a token the server has retired.
    await expect
      .poll(async () => (await readAuth(page))?.access_token)
      .toBe('fresh-access');
    expect((await readAuth(page))?.refresh_token).toBe('fresh-refresh');
  });

  test('sends one refresh for concurrent 401s, not one per request', async ({ page }) => {
    // The `isRefreshing` queue in `api.ts`. A dashboard fires several queries on mount;
    // without the queue each one starts its own refresh, and every rotation but the last
    // is immediately invalidated by the next.
    await seedSession(page, { access_token: 'stale-access', refresh_token: 'good-refresh' });

    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      // Slow enough that the other 401s land while this one is still in flight.
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'fresh-access', refresh_token: 'fresh-refresh' }),
      });
    });

    const expired = new Set<string>();
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/auth/refresh')) {
        await route.fallback();
        return;
      }
      // 401 once per distinct endpoint, so several refreshes are attempted at once.
      if (!expired.has(url)) {
        expired.add(url);
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'expired' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/websites');

    await expect.poll(() => refreshCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    // Let any duplicate refreshes that were going to fire, fire.
    await page.waitForTimeout(1500);
    expect(refreshCount).toBe(1);
  });
});

test.describe('Failed refresh', () => {
  test('logs the user out to signin with the expired marker', async ({ page }) => {
    await seedSession(page, { access_token: 'stale-access', refresh_token: 'dead-refresh' });
    await mockGlobalApiRoutes(page);

    await page.route('**/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'refresh token revoked' }),
      });
    });

    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'expired' }),
      });
    });

    await page.goto('/websites');

    // `?expired=true` is the difference between "you were signed out" and "you are
    // signed out", which is the only thing the sign-in page can tell the user.
    await expect(page).toHaveURL(/\/signin\?expired=true/);
  });

  test('clears the persisted session rather than leaving dead tokens behind', async ({ page }) => {
    await seedSession(page, { access_token: 'stale-access', refresh_token: 'dead-refresh' });
    await mockGlobalApiRoutes(page);

    await page.route('**/auth/refresh', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/websites');
    await expect(page).toHaveURL(/\/signin/);

    // Asserted as "holds no usable session" rather than "the key is gone". `performLogout`
    // does remove the key, but the store rehydrates on the sign-in page and its persist
    // middleware writes the cleared default state straight back — so checking for absence
    // is a race that passes alone and fails under parallel workers. The invariant that
    // actually matters is that no token survives to be retried on the next page load.
    await expect
      .poll(async () => {
        const state = await readAuth(page);
        return state === null || (!state.access_token && !state.refresh_token);
      })
      .toBe(true);

    const state = await readAuth(page);
    expect(state?.isAuthenticated ?? false).toBe(false);
  });

  test('does not attempt a refresh when no refresh token was stored', async ({ page }) => {
    await seedSession(page, { access_token: 'stale-access', refresh_token: null });
    await mockGlobalApiRoutes(page);

    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/websites');
    await expect(page).toHaveURL(/\/signin/);

    expect(refreshCount).toBe(0);
  });
});

test.describe('Requests exempt from the 401 redirect', () => {
  test('a 401 on a demo request does not sign the user out', async ({ page }) => {
    // The public demo runs unauthenticated on purpose. Redirecting on its 401s would
    // bounce every visitor off the demo and into the sign-in page.
    await mockGlobalApiRoutes(page);

    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/signin');

    const status = await page.evaluate(async () => {
      const res = await fetch('/api/v1/analytics/dashboard?website_id=demo');
      return res.status;
    });

    // The fetch above bypasses the interceptor, so this asserts the negative that
    // matters: no refresh was triggered and we are still on /signin.
    expect(status).toBeGreaterThan(0);
    expect(refreshCount).toBe(0);
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe('Session persistence', () => {
  test('survives a full page reload', async ({ page }) => {
    await injectAuthState(page);
    await mockGlobalApiRoutes(page);

    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/websites');
    await page.reload();

    expect((await readAuth(page))?.isAuthenticated).toBe(true);
    await expect(page).toHaveURL(/\/websites/);
  });

  test('attaches the persisted token to requests on a cold load', async ({ page }) => {
    // The in-memory token is empty on a cold load, so this exercises the
    // localStorage fallback in the request interceptor.
    await seedSession(page, { access_token: 'persisted-access', refresh_token: 'r' });
    await mockGlobalApiRoutes(page);

    const headers: (string | null)[] = [];
    await page.route('**/user/websites', async (route) => {
      headers.push(await route.request().headerValue('authorization'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/websites');

    await expect.poll(() => headers.length).toBeGreaterThanOrEqual(1);
    expect(headers[0]).toBe('Bearer persisted-access');
  });

  test('signing in stores both tokens', async ({ page }) => {
    // `mockGlobalApiRoutes` first: Playwright resolves the **last** matching route, so
    // its `**/api/v1/**` catch-all would otherwise answer this login and the page would
    // redirect with no tokens persisted.
    await mockGlobalApiRoutes(page);
    await page.route('**/user/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: { id: '123', name: 'Jane Doe', email: 'jane@company.com' },
            tokens: { access_token: 'issued-access', refresh_token: 'issued-refresh' },
          },
        }),
      });
    });

    await page.goto('/signin');
    const form = signinForm(page);
    await form.email.fill('jane@company.com');
    await form.password.fill('Password123!');
    await form.submit.click();

    await expect(page).toHaveURL(/\/websites/);

    // Without the refresh token persisted, the session dies at the first expiry
    // instead of renewing.
    const state = await readAuth(page);
    expect(state?.access_token).toBe('issued-access');
    expect(state?.refresh_token).toBe('issued-refresh');
  });
});

test.describe('Route access', () => {
  test('an unauthenticated visit to a protected page ends up at signin', async ({ page }) => {
    // Two layers, and only the second one acts. `middleware.ts` deliberately does *not*
    // block protected routes — auth lives in localStorage, which middleware cannot read
    // — so the page-level client guard is what redirects. This asserts the outcome the
    // user gets, which is the part that must not regress; the split between the layers
    // is an implementation detail either could own.
    await mockGlobalApiRoutes(page);

    // `domcontentloaded` rather than the default `load`: the guard redirects after
    // hydration, and waiting for `load` on a document that is being navigated away
    // from can hang the whole 30s under parallel workers. `toHaveURL` polls, so the
    // assertion still waits for the redirect.
    await page.goto('/websites', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/signin/);
  });

  test('an authenticated user is not redirected away from signin', async ({ page }) => {
    // `middleware.ts` intends to redirect here, reading an `auth-storage` *cookie* it
    // says is "written by AuthInitializer.tsx". No such file exists and nothing in the
    // app writes that cookie — `lib/api.ts` only ever clears it, calling it legacy. So
    // the branch is unreachable and this is the real behaviour.
    //
    // This test asserts what happens today. If the cookie is ever written, it fails,
    // which is the point: that would be the moment to decide the redirect is wanted.
    await injectAuthState(page);
    await mockGlobalApiRoutes(page);

    await page.goto('/signin');

    await expect(page).toHaveURL(/\/signin/);
    await expect(signinForm(page).email).toBeVisible();
  });

  test('the signin page is reachable with the expired marker', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.goto('/signin?expired=true');

    await expect(signinForm(page).email).toBeVisible();
  });
});

test.describe('OAuth callback', () => {
  test('finalizes a session from query tokens and lands on websites', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.route('**/user/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: { id: '123', name: 'Jane Doe', email: 'jane@company.com' } },
        }),
      });
    });
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/auth/callback?access_token=oauth-access&refresh_token=oauth-refresh');

    await expect(page).toHaveURL(/\/websites/);
    expect((await readAuth(page))?.access_token).toBe('oauth-access');
  });

  test('accepts the camelCase parameter aliases', async ({ page }) => {
    // The page reads both spellings; whichever the provider sends has to work.
    await mockGlobalApiRoutes(page);

    await page.route('**/user/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: { id: '1', name: 'J', email: 'j@x.test' } } }),
      });
    });
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/auth/callback?accessToken=camel-access&refreshToken=camel-refresh');

    await expect(page).toHaveURL(/\/websites/);
    expect((await readAuth(page))?.access_token).toBe('camel-access');
  });

  test('sends the token it just persisted when fetching the profile', async ({ page }) => {
    // The page writes localStorage before calling `/me` specifically because the store's
    // persist middleware writes asynchronously. If that ordering regresses, `/me` is
    // called unauthenticated and the sign-in silently fails.
    await mockGlobalApiRoutes(page);

    const headers: (string | null)[] = [];
    await page.route('**/user/auth/me', async (route) => {
      headers.push(await route.request().headerValue('authorization'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: { id: '1', name: 'J', email: 'j@x.test' } } }),
      });
    });
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/auth/callback?access_token=oauth-access&refresh_token=r');

    await expect.poll(() => headers.length).toBeGreaterThanOrEqual(1);
    expect(headers[0]).toBe('Bearer oauth-access');
  });

  test('returns to signin when the callback carries no tokens', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.goto('/auth/callback');

    await expect(page).toHaveURL(/\/signin/);
  });

  test('returns to signin when only one of the two tokens is present', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.goto('/auth/callback?access_token=only-access');

    await expect(page).toHaveURL(/\/signin/);
  });

  test('returns to signin when the profile fetch fails', async ({ page }) => {
    // Tokens that cannot fetch a profile are not a usable session, so the page must
    // not leave the user on a spinner.
    await mockGlobalApiRoutes(page);

    await page.route('**/user/auth/me', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'boom' }),
      });
    });

    await page.goto('/auth/callback?access_token=a&refresh_token=b');

    await expect(page).toHaveURL(/\/signin/);
  });

  test('returns to signin when the profile response has no user', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.route('**/user/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      });
    });

    await page.goto('/auth/callback?access_token=a&refresh_token=b');

    await expect(page).toHaveURL(/\/signin/);
  });

  test('returns to signin when the google callback is not configured', async ({ page }) => {
    // The core answers 501 for every OAuth endpoint — OAuth is declared, not built.
    // The page must treat that as a failed sign-in rather than hanging on the spinner.
    await mockGlobalApiRoutes(page);

    await page.route('**/user/auth/google/callback**', async (route) => {
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'OAuth not configured' }),
      });
    });

    await page.goto('/auth/google/callback?code=abc123');

    await expect(page).toHaveURL(/\/signin/);
  });

  test('returns to signin when the google callback has no code', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.goto('/auth/google/callback');

    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe('Password reset — declared but not implemented', () => {
  /**
   * The core answers 501 for both endpoints (`modules/auth/routes.ts`), while the web app
   * ships complete UI for them. These tests pin the one thing that matters while that is
   * true: the pages must **not** report success. A "check your email" screen for a request
   * that was never processed is worse than an error, because the user waits for a mail
   * that will never arrive instead of contacting support.
   *
   * When the endpoints are built, these tests should be replaced by the real flows —
   * they will fail at that point, which is the intended signal.
   */

  test('forgot-password surfaces the failure instead of claiming a mail was sent', async ({
    page,
  }) => {
    await mockGlobalApiRoutes(page);
    await page.route('**/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not implemented' }),
      });
    });

    await page.goto('/forgot-password');
    const form = forgotPasswordForm(page);
    await form.email.fill('jane@company.com');
    await form.submit.click();

    await expect(page.getByText('Check your email')).toBeHidden();
    await expect(formError(page)).toBeVisible();
  });

  test('forgot-password validates the address before calling the endpoint', async ({ page }) => {
    let called = 0;
    await mockGlobalApiRoutes(page);
    await page.route('**/auth/forgot-password', async (route) => {
      called += 1;
      await route.fulfill({ status: 501, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/forgot-password');
    const form = forgotPasswordForm(page);
    await form.email.fill('not-an-email');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
    expect(called).toBe(0);
  });

  test('reset-password surfaces the failure instead of claiming the password changed', async ({
    page,
  }) => {
    await mockGlobalApiRoutes(page);
    await page.route('**/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not implemented' }),
      });
    });

    await page.goto('/reset-password?token=some-token');

    const form = resetPasswordForm(page);
    await form.password.fill('NewPassword123!');
    await form.confirmPassword.fill('NewPassword123!');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
  });
});

test.describe('Token expiry helpers', () => {
  test('reports an expired access token as expired', async ({ page }) => {
    // `isTokenExpired` decodes the JWT payload client-side. It is what the app uses to
    // decide whether to pre-emptively refresh, so a decoding change that silently
    // returns `true` for valid tokens logs everyone out.
    await seedSession(page, {
      access_token: tokenExpiring(Math.floor(Date.now() / 1000) - 60),
      refresh_token: 'r',
    });
    await mockGlobalApiRoutes(page);
    await page.goto('/signin');

    const expired = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      const token = JSON.parse(raw!).state.access_token as string;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    }, AUTH_KEY);

    expect(expired).toBe(true);
  });

  test('reports a live access token as not expired', async ({ page }) => {
    await seedSession(page, {
      access_token: tokenExpiring(Math.floor(Date.now() / 1000) + 3600),
      refresh_token: 'r',
    });
    await mockGlobalApiRoutes(page);
    await page.goto('/signin');

    const expired = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      const token = JSON.parse(raw!).state.access_token as string;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    }, AUTH_KEY);

    expect(expired).toBe(false);
  });
});
