import { type Page, type Locator, expect } from '@playwright/test';

export class InventoryPage {
  readonly title: Locator;
  readonly items: Locator;
  readonly cartBadge: Locator;

  constructor(private page: Page) {
    this.title = page.locator('.title');
    this.items = page.locator('.inventory_item');
    this.cartBadge = page.locator('.shopping_cart_badge');
  }

  async expectLoaded() { await expect(this.title).toHaveText('Products'); }
  async addFirstItemToCart() { await this.page.locator('.inventory_item button').first().click(); }
}
