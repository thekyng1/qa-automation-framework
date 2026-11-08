import { type APIRequestContext } from '@playwright/test';

export interface OrderResponse {
  orderId: number;
  product: string;
  status: string;
}

/**
 * Independent API layer — usable without a browser, e.g. to verify an order
 * created by the UI layer through the same public API the frontend consumes.
 */
export class OrdersApi {
  constructor(private readonly request: APIRequestContext) {}

  async placeOrder(token: string, productId: number, fullName: string, phone: string, address: string): Promise<OrderResponse> {
    const res = await this.request.post('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      data: { productId, fullName, phone, address },
    });
    if (!res.ok()) {
      throw new Error(`POST /api/orders failed: ${res.status()} ${await res.text()}`);
    }
    return res.json();
  }

  async getOrder(token: string, orderId: number): Promise<Record<string, unknown> | null> {
    const res = await this.request.get(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 404) return null;
    if (!res.ok()) {
      throw new Error(`GET /api/orders/${orderId} failed: ${res.status()} ${await res.text()}`);
    }
    return res.json();
  }
}
