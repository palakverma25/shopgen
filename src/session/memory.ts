import { addItems } from "../commerce/cart.js";
import { allowRequest } from "../security/ratelimit.js";
import { shopify, type GraphqlClient } from "../shopify/client.js";
import type { CartSnapshot } from "../types.js";
import type { MerchandiseLine, ShopStore } from "./context.js";

type LockGate = Promise<unknown>;

export class MemoryBackend {
  readonly carts = new Map<string, string>();
  readonly locks = new Map<string, LockGate>();
}

export const processMemory = new MemoryBackend();

export class MemoryShopStore implements ShopStore {
  constructor(
    private readonly backend: MemoryBackend,
    private readonly sessionId: string,
    private readonly ip: string,
    private readonly client: GraphqlClient = shopify
  ) {}

  async allow(limit = 60, windowMs = 60_000): Promise<boolean> {
    return allowRequest(this.ip, limit, windowMs);
  }

  async rememberedCart(): Promise<string | undefined> {
    return this.backend.carts.get(this.sessionId);
  }

  async rememberCart(cartId: string): Promise<void> {
    this.backend.carts.set(this.sessionId, cartId);
  }

  async addMerchandise(lines: MerchandiseLine[], cartId?: string): Promise<CartSnapshot> {
    return this.runExclusive(async () => {
      const id = cartId ?? (await this.rememberedCart());
      const cart = await addItems(this.client, lines, id);
      await this.rememberCart(cart.cart_id);
      return cart;
    });
  }

  private async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.backend.locks.get(this.sessionId) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.backend.locks.set(
      this.sessionId,
      previous.then(() => held)
    );
    await previous.catch(() => undefined);
    try {
      return await work();
    } finally {
      release();
    }
  }
}
