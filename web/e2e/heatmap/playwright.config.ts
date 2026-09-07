import { defineConfig, devices } from '@playwright/test';

if (!process.env.E2E_BASE_URL || !process.env.E2E_FIXTURE_URL) {
  throw new Error('Use npm run test:e2e:heatmap to start the disposable Docker stack.');
}

export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: '../../test-results/heatmap',
  reporter: [['list'], ['html', { outputFolder: '../../playwright-report/heatmap', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium-heatmap', use: { ...devices['Desktop Chrome'] } }],
});
