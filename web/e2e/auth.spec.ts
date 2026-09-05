import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes } from './helpers/mock-api';
import { formError, signinForm, signupForm } from './helpers/auth-forms';

/**
 * The sign-in and sign-up forms.
 *
 * Every test in this file used to locate fields by hardcoded id — `#signin-email`,
 * `#signup-confirm-password`. Those ids stopped existing when the forms moved to
 * `AuthField` / `PasswordField`, which generate ids with React's `useId()`, and all six
 * tests had been timing out for 30 seconds each ever since. Nothing caught it: the
 * Playwright suite is not part of CI, which runs only `core`'s typecheck and unit tests.
 *
 * Fields are located by label now (see `helpers/auth-forms.ts`) — the same string the
 * user reads, so the locators survive markup changes and fail only when the form really
 * changed.
 *
 * Session and token behaviour after the form submits lives in `auth-session.spec.ts`.
 */

/** The successful-login payload the client expects: user plus a token pair. */
const LOGIN_OK = {
  data: {
    user: { id: '123', name: 'Jane Doe', email: 'jane@company.com' },
    tokens: { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' },
  },
};

test.describe('Sign in', () => {
  test.beforeEach(async ({ page }) => {
    await mockGlobalApiRoutes(page);
    await page.goto('/signin');
  });

  test('refuses to submit an empty email', async ({ page }) => {
    const form = signinForm(page);

    await form.submit.click();

    // Native constraint validation, so the browser blocks the submit before any
    // request is made.
    expect(await form.email.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  });

  test('refuses to submit a malformed email', async ({ page }) => {
    const form = signinForm(page);

    await form.email.fill('invalid-email');
    await form.password.fill('Password123!');
    await form.submit.click();

    expect(await form.email.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  });

  test('does not call the API for a malformed email', async ({ page }) => {
    let called = 0;
    await page.route('**/user/auth/login', async (route) => {
      called += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const form = signinForm(page);
    await form.email.fill('invalid-email');
    await form.password.fill('Password123!');
    await form.submit.click();

    expect(called).toBe(0);
  });

  test('shows an error for rejected credentials', async ({ page }) => {
    await page.route('**/user/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials. Please try again.' }),
      });
    });

    const form = signinForm(page);
    await form.email.fill('wrong@company.com');
    await form.password.fill('wrongpassword');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
  });

  test('stays on the sign-in page after a rejected attempt', async ({ page }) => {
    // The user has to be able to correct the password without retyping the email.
    await page.route('**/user/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    });

    const form = signinForm(page);
    await form.email.fill('wrong@company.com');
    await form.password.fill('wrongpassword');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
    await expect(form.email).toHaveValue('wrong@company.com');
  });

  test('sends the credentials that were typed', async ({ page }) => {
    let body: unknown = null;
    await page.route('**/user/auth/login', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LOGIN_OK),
      });
    });

    const form = signinForm(page);
    await form.email.fill('jane@company.com');
    await form.password.fill('Password123!');
    await form.submit.click();

    await expect(page).toHaveURL(/\/websites/);
    expect(body).toMatchObject({ email: 'jane@company.com', password: 'Password123!' });
  });

  test('signs in and lands on the websites page', async ({ page }) => {
    await page.route('**/user/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LOGIN_OK),
      });
    });

    const form = signinForm(page);
    await form.email.fill('jane@company.com');
    await form.password.fill('Password123!');
    await form.submit.click();

    await expect(page).toHaveURL(/\/websites/);
  });

  test('offers a route to password recovery', async ({ page }) => {
    // The only way to reach /forgot-password from the UI.
    await page.getByRole('link', { name: /forgot password/i }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Sign up', () => {
  test.beforeEach(async ({ page }) => {
    await mockGlobalApiRoutes(page);
    await page.goto('/signup');
  });

  test('rejects mismatched passwords', async ({ page }) => {
    const form = signupForm(page);

    await form.name.fill('Test User');
    await form.email.fill('test@company.com');
    await form.password.fill('Password123!');
    await form.confirmPassword.fill('Password123');
    await form.submit.click();

    await expect(formError(page)).toContainText(/do not match/i);
  });

  test('does not register when the passwords differ', async ({ page }) => {
    let called = 0;
    await page.route('**/user/auth/register', async (route) => {
      called += 1;
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    });

    const form = signupForm(page);
    await form.name.fill('Test User');
    await form.email.fill('test@company.com');
    await form.password.fill('Password123!');
    await form.confirmPassword.fill('Password123');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
    expect(called).toBe(0);
  });

  test('rejects a password under the length floor', async ({ page }) => {
    const form = signupForm(page);

    await form.name.fill('Test User');
    await form.email.fill('test@company.com');
    await form.password.fill('weak');
    await form.confirmPassword.fill('weak');
    await form.submit.click();

    await expect(formError(page)).toContainText(/8 characters/i);
  });

  test('registers and signs the new user straight in', async ({ page }) => {
    // Register does not return tokens, so the page logs in immediately after. Both
    // calls have to happen or the user lands on a page with no session.
    const calls: string[] = [];

    await page.route('**/user/auth/register', async (route) => {
      calls.push('register');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'User registered successfully' }),
      });
    });
    await page.route('**/user/auth/login', async (route) => {
      calls.push('login');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LOGIN_OK),
      });
    });

    const form = signupForm(page);
    await form.name.fill('Jane Doe');
    await form.email.fill('jane@company.com');
    await form.password.fill('Password123!');
    await form.confirmPassword.fill('Password123!');
    await form.submit.click();

    await expect(page).toHaveURL(/\/websites/);
    expect(calls).toEqual(['register', 'login']);
  });

  test('shows an error when registration is refused', async ({ page }) => {
    // The core answers a uniform 400 "Registration failed" — it deliberately does not
    // say whether the address is already taken, so the page must not imply either.
    await page.route('**/user/auth/register', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Registration failed' }),
      });
    });

    const form = signupForm(page);
    await form.name.fill('Jane Doe');
    await form.email.fill('taken@company.com');
    await form.password.fill('Password123!');
    await form.confirmPassword.fill('Password123!');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('does not attempt a login when registration failed', async ({ page }) => {
    let loginCalls = 0;
    await page.route('**/user/auth/register', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Registration failed' }),
      });
    });
    await page.route('**/user/auth/login', async (route) => {
      loginCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const form = signupForm(page);
    await form.name.fill('Jane Doe');
    await form.email.fill('taken@company.com');
    await form.password.fill('Password123!');
    await form.confirmPassword.fill('Password123!');
    await form.submit.click();

    await expect(formError(page)).toBeVisible();
    expect(loginCalls).toBe(0);
  });

  test('offers a route back to sign in', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).first().click();

    await expect(page).toHaveURL(/\/signin/);
  });
});
