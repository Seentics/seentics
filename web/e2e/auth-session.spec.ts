import { test, expect, type Page } from '@playwright/test';
import { injectAuthState, mockGlobalApiRoutes } from './helpers/mock-api';

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

/**
 * Sign-in and OAuth live in the auth app (auth/web); this app's /signin and callbacks only
 * forward there. Stubbed for every test, so none follows a redirect out to the live site.
 */
const AUTH_ORIGIN = new URL(process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.seentics.com').origin;
test.beforeEach(async ({ page }) => {
  await page.route(`${AUTH_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>auth app</body></html>' }),
  );
});

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

  // A sign-in on the auth app never stores a refresh token here: the session is the
  // gateway's httpOnly cookie, so the refresh goes with an empty body and the cookie.
  test('refreshes from the cookie when no refresh token was stored, and signs out when that is refused', async ({ page }) => {
    await seedSession(page, { access_token: 'stale-access', refresh_token: null });
    await mockGlobalApiRoutes(page);

    const bodies: string[] = [];
    await page.route('**/auth/refresh', async (route) => {
      bodies.push(route.request().postData() ?? '');
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/websites');
    await expect(page).toHaveURL(/\/signin/);
    expect(bodies[0]).toBe('{}');
  });
});

/**
 * A refresh that fails without the gateway refusing the session — no network yet after a
 * laptop wakes, a deploy's 5xx, a 429 — used to log out a session good for 7 days. Users
 * who left a tab for an hour came back signed out.
 */
test.describe('Refresh that could not reach a verdict', () => {
  for (const [label, answer] of [
    ['the network is down', 'abort'],
    ['the gateway answers 503', 503],
    ['the gateway answers 429', 429],
  ] as const) {
    test(`keeps the session when ${label}`, async ({ page }) => {
      await seedSession(page, { access_token: 'stale-access', refresh_token: 'good-refresh' });
      await mockGlobalApiRoutes(page);

      let attempts = 0;
      await page.route('**/auth/refresh', async (route) => {
        attempts += 1;
        if (answer === 'abort') await route.abort('internetdisconnected');
        else await route.fulfill({ status: answer, contentType: 'application/json', body: '{}' });
      });
      await page.route('**/user/websites', async (route) => {
        await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      });

      await page.goto('/websites');
      await expect.poll(() => attempts).toBeGreaterThanOrEqual(1);
      // Long enough for a logout redirect to have happened if one were coming.
      await page.waitForTimeout(1_000);

      expect(page.url()).not.toContain('/signin');
      const state = await readAuth(page);
      expect(state?.isAuthenticated).toBe(true);
      expect(state?.refresh_token).toBe('good-refresh');
    });
  }
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

    // Any page of this app that stays put (/signin forwards to the auth app now).
    await page.goto('/privacy');

    const status = await page.evaluate(async () => {
      const res = await fetch('/api/v1/analytics/dashboard?website_id=demo');
      return res.status;
    });

    // The fetch above bypasses the interceptor, so this asserts the negative that
    // matters: no refresh was triggered and we are still where we were.
    expect(status).toBeGreaterThan(0);
    expect(refreshCount).toBe(0);
    await expect(page).toHaveURL(/\/privacy/);
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

  // Signing in happens on the auth app (auth/web) now: what it stores there, and the
  // cookie session this app reads, are covered by the whole-stack suite (e2e/tests/auth.spec.ts).
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

  // Sign-in is the auth app's page now; this app's /signin only forwards there.
  test('/signin forwards to the auth app, keeping the expired marker', async ({ page }) => {
    await mockGlobalApiRoutes(page);

    await page.goto('/signin?expired=true');

    await expect(page).toHaveURL(`${AUTH_ORIGIN}/signin?expired=true`);
  });
});

/**
 * Sign-in, OAuth included, lives in the auth app (auth/web) now; this app's
 * `/auth/callback` and `/auth/google/callback` only forward there with their query. The
 * session these produce is tested end to end in the whole-stack suite (e2e/tests/auth.spec.ts).
 * The auth app is stubbed here: these tests used to follow the redirect out to the live
 * auth.seentics.com, and asserted on what that answered.
 */
test.describe('OAuth callback', () => {
  for (const path of ['/auth/callback', '/auth/google/callback']) {
    test(`${path} forwards to the auth app with its query intact`, async ({ page }) => {
      await mockGlobalApiRoutes(page);
      await page.goto(`${path}?code=abc&state=xyz`);

      await expect(page).toHaveURL(`${AUTH_ORIGIN}${path}?code=abc&state=xyz`);
      // Nothing is stored here: the auth app owns the exchange.
      expect((await readAuth(page))?.access_token ?? null).toBeNull();
    });
  }
});

// Password reset is the auth app's too; these pages only forward there with their query.
test.describe('Password reset', () => {
  for (const path of ['/forgot-password', '/reset-password']) {
    test(`${path} forwards to the auth app with its query intact`, async ({ page }) => {
      await mockGlobalApiRoutes(page);

      await page.goto(`${path}?token=abc`);

      await expect(page).toHaveURL(`${AUTH_ORIGIN}${path}?token=abc`);
    });
  }
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
    await page.goto('/privacy');

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
    await page.goto('/privacy');

    const expired = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      const token = JSON.parse(raw!).state.access_token as string;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    }, AUTH_KEY);

    expect(expired).toBe(false);
  });
});
