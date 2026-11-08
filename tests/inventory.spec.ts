/**
 * Shop (inventory) layer — pure UI tests against the demo app catalog.
 * Business scenarios only: no SQL, no selectors, no API details.
 */
import { test, expect } from '../fixtures/pages.fixture';
import users from '../test-data/users.json';
import products from '../test-data/products.json';

test.describe('Inventory', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(users.validUser.username, users.validUser.password);
  });

  test('the catalog shows the seeded products', async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    for (const product of products.inStock) {
      await expect(inventoryPage.productCardByName(product.name)).toBeVisible();
    }
  });

  test('adding an item to the cart confirms visually', async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    const product = products.inStock[0];
    await inventoryPage.addToCart(product.name);
    await inventoryPage.expectItemAdded(product.name);
  });
});
