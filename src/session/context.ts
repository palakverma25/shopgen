import { AsyncLocalStorage } from "node:async_hooks";
import type { CartSnapshot } from "../types.js";

export type MerchandiseLine = { merchandiseId: string; quantity: number };

export type ShopStore = {
  allow(limit?: number, windowMs?: number): Promise<boolean>;
  rememberedCart(): Promise<string | undefined>;
  rememberCart(cartId: string): Promise<void>;
  addMerchandise(lines: MerchandiseLine[], cartId?: string): Promise<CartSnapshot>;
};

export type ShopContext = {
  sessionId: string;
  store: ShopStore;
};

export const shopContext = new AsyncLocalStorage<ShopContext>();

export function readSessionId(headers: Headers | { get?(name: string): string | null | undefined }): string {
  const read = (name: string) => headers.get?.(name) ?? null;
  const existing = read("mcp-session-id")?.trim() || read("x-shop-session")?.trim();
  if (existing && existing.length <= 200) return existing;
  return crypto.randomUUID();
}

export function currentStore(): ShopStore | undefined {
  return shopContext.getStore()?.store;
}

export async function rememberedCartId(): Promise<string | undefined> {
  return currentStore()?.rememberedCart();
}

export async function rememberCartId(cartId: string): Promise<void> {
  await currentStore()?.rememberCart(cartId);
}
