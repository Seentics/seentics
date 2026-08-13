import { test, expect } from '@playwright/test';

test.describe('Authentication Flow E2E Tests', () => {

  test.describe('Sign In Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signin');
    });

    test('should validate input constraints via HTML5 validation', async ({ page }) => {
      const emailInput = page.locator('#signin-email');
      const passwordInput = page.locator('#signin-password');

      // Check empty email validation
      await page.click('button[type="submit"]');
      let isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
      expect(isEmailInvalid).toBe(true);

      // Check invalid email format validation
      await emailInput.fill('invalid-email');
      await passwordInput.fill('Password123!');
      await page.click('button[type="submit"]');
      isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
      expect(isEmailInvalid).toBe(true);
    });

    test('should show error alert for incorrect credentials via mocked API', async ({ page }) => {
      // Mock the login API to fail
      await page.route('**/user/auth/login', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Invalid credentials. Please try again.',
          }),
        });
      });

      await page.fill('#signin-email', 'wrong@company.com');
      await page.fill('#signin-password', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Check if error alert is shown inside form
      const errorAlert = page.locator('form div[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('401');
    });

    test('should log in successfully and redirect to websites page', async ({ page }) => {
      // Mock successful login API
      await page.route('**/user/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                id: '123',
                name: 'Jane Doe',
                email: 'jane@company.com',
              },
              tokens: {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
              },
            },
          }),
        });
      });

      await page.fill('#signin-email', 'jane@company.com');
      await page.fill('#signin-password', 'Password123!');
      await page.click('button[type="submit"]');

      // Should redirect to dashboard / websites page
      await expect(page).toHaveURL(/\/websites/);
    });
  });

  test.describe('Sign Up Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup');
    });

    test('should show validation error for mismatched passwords', async ({ page }) => {
      await page.fill('#signup-name', 'Test User');
      await page.fill('#signup-email', 'test@company.com');
      await page.fill('#signup-password', 'Password123!');
      await page.fill('#signup-confirm-password', 'Password123'); // Mismatched

      await page.click('button[type="submit"]');

      const errorAlert = page.locator('form div[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('Passwords do not match');
    });

    test('should show validation error for weak password', async ({ page }) => {
      await page.fill('#signup-name', 'Test User');
      await page.fill('#signup-email', 'test@company.com');
      await page.fill('#signup-password', 'weak');
      await page.fill('#signup-confirm-password', 'weak');

      await page.click('button[type="submit"]');

      const errorAlert = page.locator('form div[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('at least 8 characters');
    });

    test('should sign up successfully and redirect to websites page', async ({ page }) => {
      // Mock signup and login endpoints
      await page.route('**/user/auth/register', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'User registered successfully',
          }),
        });
      });

      await page.route('**/user/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                id: '123',
                name: 'Jane Doe',
                email: 'jane@company.com',
              },
              tokens: {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
              },
            },
          }),
        });
      });

      await page.fill('#signup-name', 'Jane Doe');
      await page.fill('#signup-email', 'jane@company.com');
      await page.fill('#signup-password', 'Password123!');
      await page.fill('#signup-confirm-password', 'Password123!');

      await page.click('button[type="submit"]');

      // Redirect check
      await expect(page).toHaveURL(/\/websites/);
    });
  });

});
