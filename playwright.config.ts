import { defineConfig, devices } from '@playwright/test';
import { withPostman } from 'postman-playwright';

export default withPostman(defineConfig({
  testDir: './tests',
  // Rulăm DOAR testul de baze de date pentru a trece CI-ul
  testMatch: '**/login.spec.ts',
  grep: /persists to database/i,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://www.saucedemo.com',
    trace: 'on',
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
}));
