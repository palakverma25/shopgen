import { rememberCartId, rememberedCartId } from "../session/context.js";
import type { CartSnapshot } from "../types.js";
import {
  addCartLines,
  createCart,
  fetchCart,
  removeCartLines,
  updateCartLines,
  updateDiscountCodes
} from "../shopify/api.js";
import type { GraphqlClient } from "../shopify/client.js";
import { sameLabel, sameSize } from "./format.js";

export class CartIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartIdError";
  }
}

export function validateCartId(cartId: string | undefined, required: true): string;
export function validateCartId(cartId: string | undefined, required?: false): string | undefined;
export function validateCartId(cartId: string | undefined, required = false): string | undefined {
  if (!cartId || !cartId.trim()) {
    if (required) {
      throw new CartIdError(
        "cart_id is required. Pass the full cart_id from the last cart tool result, including ?key=, or continue in the same chat so the server can reuse this shopper's cart."
      );
    }
    return undefined;
  }

  const id = cartId.trim();
  if (!id.startsWith("gid://shopify/Cart/")) {
    throw new CartIdError(
      "That cart_id is not a Shopify cart. Use the cart_id returned by add_to_cart. Do not invent one."
    );
  }
  if (!/[?&]key=/.test(id) && !/%3[Ff]key%3[Dd]/.test(id)) {
    throw new CartIdError(
      "That cart_id is missing its secret key. Use the full cart_id from the last cart response. Do not truncate it."
    );
  }
  return id;
}

export async function resolveCartId(explicit: string | undefined, required: true): Promise<string>;
export async function resolveCartId(explicit?: string, required?: false): Promise<string | undefined>;
export async function resolveCartId(explicit?: string, required = false): Promise<string | undefined> {
  if (explicit?.trim()) {
    const id = validateCartId(explicit, false);
    if (id) {
      await rememberCartId(id);
      return id;
    }
  }
  const remembered = await rememberedCartId();
  if (remembered) {
    return validateCartId(remembered, false);
  }
  if (required) {
    return validateCartId(undefined, true);
  }
  return validateCartId(undefined, false);
}

export function interpretDiscount(
  cart: CartSnapshot,
  code: string,
  previousTotal: string | null
): { ok: true; cart: CartSnapshot } | { ok: false; error: string; cart: CartSnapshot } {
  const applied = cart.discount_codes.find((item) => sameLabel(item.code, code));
  if (!applied || !applied.applicable) {
    return {
      ok: false,
      error: `${code} was submitted but is not applicable to this cart. Total unchanged: ${cart.total ?? "unknown"}.`,
      cart
    };
  }
  if (previousTotal && cart.total === previousTotal) {
    return {
      ok: false,
      error: `${code} did not change the total. Total is still ${cart.total}.`,
      cart
    };
  }
  return { ok: true, cart };
}

export async function addItems(
  client: GraphqlClient,
  lines: { merchandiseId: string; quantity: number }[],
  cartId?: string
): Promise<CartSnapshot> {
  if (!lines.length) {
    throw new CartIdError("Nothing to add to the cart.");
  }
  if (cartId) {
    return addCartLines(client, cartId, lines);
  }
  return createCart(client, lines);
}

export async function changeLine(
  client: GraphqlClient,
  cartId: string,
  input: {
    action: "set_quantity" | "remove";
    line_id?: string;
    product?: string;
    size?: string;
    color?: string;
    quantity?: number;
  }
): Promise<CartSnapshot> {
  const cart = await fetchCart(client, cartId);
  const matches = findMatchingLines(cart, input);
  if (!matches.length) {
    throw new CartIdError(
      "Could not find that item in the cart. Use get_cart and identify the line by product plus size and color, or by line_id."
    );
  }
  if (matches.length > 1) {
    const listed = matches
      .map((item) => {
        const variant = [item.color, item.size].filter(Boolean).join(" ") || "no size/color";
        return `${item.product} (${variant}, line_id ${item.line_id})`;
      })
      .join("; ");
    throw new CartIdError(
      `Several cart lines match. Specify size and color, or pass line_id. Matches: ${listed}.`
    );
  }
  const line = matches[0];
  if (!line) {
    throw new CartIdError(
      "Could not find that item in the cart. Use get_cart and identify the line by product plus size and color, or by line_id."
    );
  }

  if (input.action === "remove" || input.quantity === 0) {
    return removeCartLines(client, cartId, [line.line_id]);
  }

  if (input.quantity === undefined || input.quantity < 1) {
    throw new CartIdError("set_quantity needs a quantity of 1 or more.");
  }
  return updateCartLines(client, cartId, line.line_id, input.quantity);
}

export function findMatchingLines(
  cart: CartSnapshot,
  input: { line_id?: string; product?: string; size?: string; color?: string }
) {
  if (input.line_id) {
    return cart.lines.filter((line) => line.line_id === input.line_id);
  }
  if (!input.product) return [];

  const productNeedle = input.product.trim().toLowerCase();
  return cart.lines.filter((line) => {
    const productMatch =
      line.handle === productNeedle ||
      line.product.toLowerCase().includes(productNeedle) ||
      line.handle.includes(productNeedle.replace(/\s+/g, "-"));
    if (!productMatch) return false;
    if (input.size && (!line.size || !sameSize(line.size, input.size))) return false;
    if (input.color && (!line.color || !sameLabel(line.color, input.color))) return false;
    return true;
  });
}

export async function applyDiscountCode(
  client: GraphqlClient,
  cartId: string,
  code: string
): Promise<{ ok: true; cart: CartSnapshot } | { ok: false; error: string; cart: CartSnapshot }> {
  const before = await fetchCart(client, cartId);
  const existing = before.discount_codes.map((item) => item.code);
  const next = [...new Set([...existing, code])];
  const after = await updateDiscountCodes(client, cartId, next);
  return interpretDiscount(after, code, before.total);
}
