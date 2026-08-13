import { Page } from '@playwright/test';

/**
 * Mock all global / shell API routes that fire on every authenticated page.
 *
 * Without these mocks the Next.js rewrite proxy tries to reach localhost:8080
 * (the backend gateway) which isn't running during E2E tests, causing
 * ECONNREFUSED and preventing components from finishing their loading phase.
 */
export async function mockGlobalApiRoutes(page: Page) {
  // ── User preferences (ThemeCustomizationContext) ──
  await page.route('**/user/users/preferences', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          background: '',
          card: '',
          primary: '',
          radius: '',
          fontFamily: '',
          fontSize: 'medium',
          density: 'comfortable',
          dashboardTitle: '',
          logoUrl: '',
          layoutMode: 'sidebar',
        },
      }),
    });
  });

  // ── Billing / subscription usage (useSubscription) ──
  await page.route('**/user/billing/usage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'sub-mock',
          plan: 'free',
          status: 'active',
          isActive: true,
          features: [],
          usage: {
            websites:     { current: 1, limit: 3, canCreate: true },
            workflows:    { current: 0, limit: 5, canCreate: true },
            funnels:      { current: 0, limit: 5, canCreate: true },
            heatmaps:     { current: 0, limit: 5, canCreate: true },
            replays:      { current: 0, limit: 100, canCreate: true },
            monthlyEvents:{ current: 100, limit: 10000, canCreate: true },
            aiAnalyses:   { current: 0, limit: 10, canCreate: true },
          },
        },
      }),
    });
  });

  // ── Auth setup status ──
  await page.route('**/user/auth/setup-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { isSetup: true } }),
    });
  });

  // ── Catch-all for any other /api/v1/ requests that would hit the backend ──
  // This prevents ECONNREFUSED for any unmocked endpoint while still allowing
  // test-specific mocks (registered before this one) to take precedence.
  await page.route('**/api/v1/**', async (route) => {
    // Only fulfill requests that haven't been handled by a more specific mock.
    // Playwright routes are matched in LIFO order, so more specific routes
    // registered BEFORE this catch-all will be matched first.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null }),
    });
  });
}

/**
 * Inject authenticated localStorage state so the app treats the session as
 * logged-in without requiring a real backend.
 */
export function injectAuthState(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            id: '123',
            name: 'Jane Doe',
            email: 'jane@company.com',
          },
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        },
      }),
    );
  });
}
