import { ShopifyError } from "../shopify/client.js";
import type { CartSnapshot } from "../types.js";
import type { MerchandiseLine, ShopStore } from "./context.js";

export type DurableNamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  };
};

export class DurableShopStore implements ShopStore {
  constructor(
    private readonly ns: DurableNamespace,
    private readonly sessionId: string,
    private readonly ip: string
  ) {}

  private cartStub() {
    return this.ns.get(this.ns.idFromName(`cart:${this.sessionId}`));
  }

  private rateStub() {
    return this.ns.get(this.ns.idFromName(`rate:${this.ip}`));
  }

  async allow(limit = 60, windowMs = 60_000): Promise<boolean> {
    const response = await this.rateStub().fetch("https://shop-state/allow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit, windowMs })
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { ok?: boolean };
    return json.ok === true;
  }

  async rememberedCart(): Promise<string | undefined> {
    const response = await this.cartStub().fetch("https://shop-state/cart");
    const json = (await response.json()) as { cartId?: string | null };
    return json.cartId || undefined;
  }

  async rememberCart(cartId: string): Promise<void> {
    await this.cartStub().fetch("https://shop-state/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId })
    });
  }

  async addMerchandise(lines: MerchandiseLine[], cartId?: string): Promise<CartSnapshot> {
    const response = await this.cartStub().fetch("https://shop-state/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, cartId })
    });
    const json = (await response.json()) as { ok?: boolean; error?: string; cart_id?: string };
    if (!response.ok || json.ok === false) {
      throw new ShopifyError(json.error ?? "Could not add to the cart.");
    }
    return json as CartSnapshot;
  }
}
