import { addItems } from "../commerce/cart.js";
import { createShopifyClient } from "../shopify/client.js";

type DurableStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

type DurableCtx = {
  storage: DurableStorage;
};

type RateRecord = { count: number; resetAt: number };

export class ShopState {
  constructor(
    private readonly ctx: DurableCtx,
    _env?: unknown
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/allow" && request.method === "POST") {
        const body = (await request.json()) as { limit?: number; windowMs?: number };
        const ok = await this.allow(body.limit ?? 60, body.windowMs ?? 60_000);
        return Response.json({ ok });
      }

      if (url.pathname === "/cart" && request.method === "GET") {
        const cartId = (await this.ctx.storage.get<string>("cartId")) ?? null;
        return Response.json({ cartId });
      }

      if (url.pathname === "/cart" && request.method === "PUT") {
        const body = (await request.json()) as { cartId: string };
        await this.ctx.storage.put("cartId", body.cartId);
        return Response.json({ ok: true });
      }

      if (url.pathname === "/add" && request.method === "POST") {
        const body = (await request.json()) as {
          lines: { merchandiseId: string; quantity: number }[];
          cartId?: string;
        };
        const stored = await this.ctx.storage.get<string>("cartId");
        const cartId = body.cartId || stored || undefined;
        const cart = await addItems(createShopifyClient(), body.lines, cartId);
        await this.ctx.storage.put("cartId", cart.cart_id);
        return Response.json(cart);
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shop state failed";
      return Response.json({ ok: false, error: message }, { status: 400 });
    }
  }

  private async allow(limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const current = (await this.ctx.storage.get<RateRecord>("rate")) ?? {
      count: 0,
      resetAt: now + windowMs
    };
    if (current.resetAt <= now) {
      await this.ctx.storage.put("rate", { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    await this.ctx.storage.put("rate", current);
    return true;
  }
}
