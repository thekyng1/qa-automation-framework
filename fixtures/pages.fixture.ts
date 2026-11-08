/**
 * Single source of truth for tests: import { test, expect } from here.
 *
 * Composition:
 *   pages  — PageObject instances, no manual instantiation in tests
 *   db     — per-test MySQL client (transaction + rollback + cleanupLater)
 *
 * API traffic capture is enabled at CONFIG level via withPostman() in
 * playwright.config.ts — it covers all pages and contexts, including
 * manually created ones, and requires zero changes in test code.
 */
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { InventoryPage } from '../pages/inventory.page';
import { CheckoutPage } from '../pages/checkout.page';
import { DbClient } from './db.client';
import { dbConfigFromEnv, getDbConnection } from '../utils/db';

type Fixtures = {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  checkoutPage: CheckoutPage;
  db: DbClient;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  inventoryPage: async ({ page }, use) => { await use(new InventoryPage(page)); },
  checkoutPage: async ({ page }, use) => { await use(new CheckoutPage(page)); },

  db: async ({}, use) => {
    const conn = await getDbConnection();
    // READ COMMITTED: assertions must see the app's commits made DURING the test.
    // MySQL's default REPEATABLE READ snapshot would hide them (false negatives).
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await conn.query('BEGIN');
    const client = new DbClient(conn);
    try {
      await use(client);
    } finally {
      try {
        await conn.query('ROLLBACK');
      } catch {
        // connection may already be broken; cleanup still runs below
      }
      // Rows the APP committed cannot be rolled back — delete them explicitly.
      const standalone = await getDbConnection();
      try {
        for (const { table, where } of (client as any).cleanups as Array<{ table: string; where: Record<string, unknown> }>) {
          const keys = Object.keys(where);
          if (keys.length === 0) continue;
          await standalone.query(
            `DELETE FROM ?? WHERE ${keys.map(() => '?? = ?').join(' AND ')}`,
            [table, ...keys.flatMap((k) => [k, where[k]])],
          );
        }
      } finally {
        await standalone.end();
      }
      await conn.end();
    }
  },
});

export { expect } from './db.client';
