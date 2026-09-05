import type { Page } from '@playwright/test';

/**
 * Field locators for the four auth forms.
 *
 * Located by label, never by id. The forms render through `AuthField` /
 * `PasswordField`, which assign ids from React's `useId()` — so the ids are generated
 * values like `«r0»` that change with the render tree. `auth.spec.ts` had been written
 * against hardcoded ids (`#signin-email`, `#signup-name`, …) from before that
 * refactor, and every one of its six tests had been failing on a 30-second locator
 * timeout. Nothing noticed, because the Playwright suite is not in CI.
 *
 * A label is the same thing the user reads, so these break only when the form actually
 * changes — which is the point.
 */

export const signinForm = (page: Page) => ({
  email: page.getByLabel('Email'),
  password: page.getByLabel('Password', { exact: true }),
  submit: page.getByRole('button', { name: /sign in/i }),
});

export const signupForm = (page: Page) => ({
  name: page.getByLabel('Full name'),
  email: page.getByLabel('Email'),
  password: page.getByLabel('Password', { exact: true }),
  confirmPassword: page.getByLabel('Confirm password'),
  // Not `/sign up/i` — the OAuth buttons above the form are labelled "Sign up with
  // Google" / "Sign up with GitHub", so that pattern matches three buttons.
  submit: page.getByRole('button', { name: /create account/i }),
});

export const forgotPasswordForm = (page: Page) => ({
  email: page.getByLabel('Email'),
  submit: page.getByRole('button', { name: /send|reset/i }),
});

export const resetPasswordForm = (page: Page) => ({
  password: page.getByLabel('New password', { exact: true }),
  confirmPassword: page.getByLabel('Confirm new password'),
  submit: page.getByRole('button', { name: /reset|update|set/i }),
});

/** The inline form error `AuthError` renders. */
export const formError = (page: Page) => page.locator('[role="alert"]').first();
