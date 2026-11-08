import { type Page, type Locator, expect } from '@playwright/test';

export class InventoryPage {
  private readonly productsHeading: Locator;
  private readonly welcomeMessage: Locator;
  private readonly productList: Locator;

  constructor(private readonly page: Page) {
    this.productsHeading = page.getByRole('heading', { name: /products/i });
    this.welcomeMessage = page.getByTestId('welcome-message');
    this.productList = page.getByTestId('product-list');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.productsHeading).toBeVisible();
  }

  async expectWelcomes(fullName: string): Promise<void> {
    await expect(this.welcomeMessage).toContainText(fullName);
  }

  private productCard(name: string): Locator {
    return this.productList.getByRole('listitem', { name });
  }

  async addToCart(productName: string): Promise<void> {
    await this.productCard(productName)
      .getByRole('button', { name: /add to cart/i })
      .click();
  }

  async expectItemAdded(productName: string): Promise<void> {
    await expect(this.productCard(productName).getByRole('button', { name: /added/i })).toBeVisible();
  }

  async proceedToCheckout(): Promise<void> {
    await this.page.getByRole('button', { name: /proceed to checkout/i }).click();
  }
}
