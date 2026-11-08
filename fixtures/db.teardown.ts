/**
 * Playwright globalTeardown: stops the demo application and the ephemeral
 * MySQL instance started by fixtures/db.fixture.ts.
 */
export default async function globalTeardown(): Promise<void> {
  const app = (globalThis as any).__TEST_APP__;
  if (app) app.kill();

  const db = (globalThis as any).__MYSQL_DB__;
  if (db) await db.stop();
}
