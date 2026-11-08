/**
 * Honest tests: business scenarios only. No SQL, no selectors, no API details.
 * Every test that performs a UI write verifies persistence with expect(db).
 */
import { test, expect } from '../fixtures/pages.fixture';
import users from '../test-data/users.json';

test.describe('Authentication', () => {
  test('a valid user reaches the shop', async ({ loginPage, inventoryPage }) => {
    await loginPage.goto();
    await loginPage.login(users.validUser.username, users.validUser.password);
    await inventoryPage.expectLoaded();
    await inventoryPage.expectWelcomes(users.validUser.fullName);
  });

  test('a locked user sees a clear error', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(users.lockedUser.username, users.lockedUser.password);
    await loginPage.expectLoginError();
  });
});
