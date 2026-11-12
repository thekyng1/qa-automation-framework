import { defineConfig, devices } from '@playwright/test';
import { withPostman } from 'postman-playwright';

/**
 * withPostman() enables API traffic capture for ALL tests (including pages
 * created manually) and turns on the JSON reporter + trace that postman-cli
 * reads when running `postman application test -- npx playwright test`.
 * The demo app, its MySQL instance and the base URL are all provided by
 * globalSetup (fixtures/db.fixture.ts) — nothing to configure manually.
 *
 * NOTE (CI root cause, fixed): withPostman REQUIRES trace: 'on'.
 * It hard-rejects 'on-first-retry' at config load — API capture must cover
 * every test, not just retries. Do NOT change this back, CI will go red
 * instantly with "Incompatible use.trace setting".
 *
 * NOTE: do NOT add testMatch/grep filters to "force green". The suite is
 * small (6 tests) and every test is a required acceptance criterion. If CI
 * is red, debug the root cause in the run logs — never narrow the suite.
 *
 * NOTE (mobile, PR ciclul mobil): proiectul `mobile-chrome` rulează ÎNTREAGA
 * suită, nu doar CompleActe — la fel ca `chromium`. Suitele mobile adaugă
 * tap-target/touch peste aceeași acoperire; dacă CI depășește globalTimeout,
 * se ridică timeout-ul, NU se îngustează suita (regula de mai sus se aplică).
 */
export default withPostman(defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  globalTimeout: 20 * 60 * 1000, // ridicat de la 10 min: 2 proiecte (desktop + mobil) în CI cu workers:2 — mai bine timeout mare decât suite îngustată
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3100',
    trace: 'on', // required by withPostman — full API capture for every test
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Pixel 7: hasTouch + isMobile + viewport 412x915 — Capacitor WebView
    // e ținta naturală a app-ului; .btn-scan pe touch e riscul acoperit aici.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  globalSetup: './fixtures/db.fixture.ts',
  globalTeardown: './fixtures/db.teardown.ts',

  outputDir: 'test-results',
}));
