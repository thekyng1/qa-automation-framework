/**
 * THE closed-loop test: one scenario, three layers, one business truth.
 *
 *   UI   — the browser user logs in, adds to cart, checks out
 *   API  — during the same run, withPostman (playwright.config.ts) captures
 *          /api/orders traffic; run `postman application test -- npx playwright
 *          test` to also validate pm.test contracts from the Postman workspace
 *   DB   — expect(db).toHaveRecord('orders', ...) proves the UI action
 *          actually persisted, via a separate connection
 *
 * Isolation: the phone number is a unique key generated per test, so two
 * consecutive runs never collide. The app's own commit cannot be rolled
 * back by the test transaction, so the row is registered for cleanup.
 */
import { test, expect } from '../../fixtures/pages.fixture';
import users from '../../test-data/users.json';
import products from '../../test-data/products.json';
import { randomPhone } from '../../utils/data-generator';
import { logger } from '../../utils/logger';

test.describe('Checkout end-to-end (UI -> API -> DB)', () => {
  test('an order placed in the UI persists to the database', async ({
    loginPage, inventoryPage, checkoutPage, db,
  }) => {
    const product = products.inStock[0];
    const phone = randomPhone();

    logger.step('UI: login and shop');
    await loginPage.goto();
    await loginPage.login(users.validUser.username, users.validUser.password);
    await inventoryPage.expectLoaded();

    logger.step('UI: add to cart and checkout');
    await inventoryPage.addToCart(product.name);
    await inventoryPage.proceedToCheckout();
    await checkoutPage.fillShippingInfo({
      fullName: users.validUser.fullName,
      phone,
      address: 'Str. Testului 1',
    });
    await checkoutPage.placeOrder();
    const orderId = await checkoutPage.expectOrderConfirmed();

    logger.step(`DB: verify order ${orderId} persisted`);
    await expect(db).toHaveRecord('orders', { shipping_phone: phone });
    const record = await db.findOne('orders', { shipping_phone: phone });
    expect(record.order_id ?? record.id).toBe(orderId);
    expect(record.shipping_name).toBe(users.validUser.fullName);

    // The app committed this row on its own connection — register for cleanup.
    db.cleanupLater('orders', { shipping_phone: phone });
  });
});
