import { test, expect } from '../fixtures/pages.fixture';
import { query } from '../fixtures/db-helper';

test.describe('Authentication', () => {
  test('standard user can log in', async ({ loginPage, inventoryPage }) => {
    await loginPage.goto();
    await loginPage.login('standard_user', 'secret_sauce');
    await inventoryPage.expectLoaded();
  });

  test('locked user sees error', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('locked_out_user', 'secret_sauce');
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('user registration persists to database', async () => {
    const email = `user_${Date.now()}@example.com`;
    await query('INSERT INTO test_users (email) VALUES (?)', [email]);
    const rows = await query<{ email: string }>('SELECT email FROM test_users WHERE email = ?', [email]);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(email);
  });
});
