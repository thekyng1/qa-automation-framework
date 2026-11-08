import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { InventoryPage } from '../pages/inventory.page';

type Pages = { loginPage: LoginPage; inventoryPage: InventoryPage };

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  inventoryPage: async ({ page }, use) => { await use(new InventoryPage(page)); },
});

export { expect } from '@playwright/test';
