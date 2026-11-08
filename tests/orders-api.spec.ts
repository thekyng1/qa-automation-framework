/**
 * API-layer tests — browserless, run against the same demo app.
 * Contract validation for auth and orders endpoints.
 */
import { test, expect } from '../fixtures/pages.fixture';
import users from '../test-data/users.json';
import { randomPhone } from '../utils/data-generator';

test.describe('Orders API', () => {
  test('login returns a token that can place an order', async ({ request, db }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { username: users.validUser.username, password: users.validUser.password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { token, fullName } = await loginRes.json();
    expect(fullName).toBe(users.validUser.fullName);

    const phone = randomPhone();
    const orderRes = await request.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: { productId: 1, fullName, phone, address: 'Str. API 9' },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();
    expect(order.status).toBe('confirmed');

    logger.step(`DB: verify API order ${order.orderId} persisted`);
    await expect(db).toHaveRecord('orders', { shipping_phone: phone });
    db.cleanupLater('orders', { shipping_phone: phone });
  });

  test('an unauthenticated order request is rejected', async ({ request }) => {
    const res = await request.post('/api/orders', {
      data: { productId: 1, fullName: 'X', phone: '+40700000000', address: 'Y' },
    });
    expect(res.status()).toBe(401);
  });
});
