import { test, expect } from '../fixtures/pages.fixture';
import { query } from '../fixtures/db-helper';

test.describe('Inventory', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
  });

  test('add item to cart shows badge', async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    await expect(inventoryPage.items).toHaveCount(6);
    await inventoryPage.addFirstItemToCart();
    await expect(inventoryPage.cartBadge).toHaveText('1');
  });

  test('database is reachable after UI action', async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    await inventoryPage.addFirstItemToCart();
    const rows = await query('SELECT 1 AS ok');
    expect(rows[0].ok).toBe(1);
  });
});
