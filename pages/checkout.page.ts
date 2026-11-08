import { type Page, type Locator, expect } from '@playwright/test';

export interface ShippingInfo {
  fullName: string;
  phone: string;
  address: string;
}

export class CheckoutPage {
  private readonly fullNameInput: Locator;
  private readonly phoneInput: Locator;
  private readonly addressInput: Locator;
  private readonly placeOrderButton: Locator;
  private readonly confirmationStatus: Locator;

  constructor(private readonly page: Page) {
    this.fullNameInput = page.getByLabel('Full name');
    this.phoneInput = page.getByLabel('Phone');
    this.addressInput = page.getByLabel('Address');
    this.placeOrderButton = page.getByRole('button', { name: /place order/i });
    this.confirmationStatus = page.getByRole('status');
  }

  async fillShippingInfo(info: ShippingInfo): Promise<void> {
    await this.fullNameInput.fill(info.fullName);
    await this.phoneInput.fill(info.phone);
    this.addressInput.fill(info.address);
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }

  async expectOrderConfirmed(): Promise<number> {
    await expect(this.confirmationStatus).toContainText(/order confirmed.*order id: (\d+)/i);
    const text = await this.confirmationStatus.innerText();
    const match = text.match(/order id: (\d+)/i);
    if (!match) throw new Error(`Could not parse order id from confirmation: "${text}"`);
    return Number(match[1]);
  }
}
