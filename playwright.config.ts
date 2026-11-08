import { defineConfig, devices } from '@playwright/test';
import { withPostman } from 'postman-playwright';

/**
 * withPostman() enables API traffic capture for ALL tests (including pages
 * created manually) and turns on the JSON reporter + trace that postman-cli
 * reads when running `postman application test -- npx playwright test`.
 * The demo app, its MySQL instance and the base URL are all provided by
 * globalSetup (fixtures/db.fixture.ts) — nothing to configure manually.
 *
 * NOTE: do NOT add testMatch/grep filters to "force green". The suite is
 * small (6 tests) and every test is a required acceptance criterion. If CI
 * is red, debug the root cause in the run logs — never narrow the suite.
 */
export default withPostman(defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  globalSetup: './fixtures/db.fixture.ts',
  globalTeardown: './fixtures/db.teardown.ts',

  outputDir: 'test-results',
}));
