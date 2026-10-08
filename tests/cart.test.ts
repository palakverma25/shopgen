import { describe, expect, it } from "vitest";
import { findMatchingLines, resolveCartId, validateCartId } from "../src/commerce/cart.js";
import { formatMoney, redactCartId, unitMoney } from "../src/commerce/format.js";
import { shopContext, type ShopStore } from "../src/session/context.js";
import { MemoryBackend, MemoryShopStore } from "../src/session/memory.js";
import type { CartSnapshot } from "../src/types.js";
import type { GraphqlClient } from "../src/shopify/client.js";

describe("cart isolation", () => {
  it("rejects a missing cart_id when required", () => {
    expect(() => validateCartId(undefined, true)).toThrow(/cart_id is required/i);
  });

  it("rejects a truncated cart_id without the secret key", () => {
    expect(() => validateCartId("gid://shopify/Cart/c1-abc", true)).toThrow(/secret key/i);
  });

  it("rejects a non-cart GID", () => {
    expect(() => validateCartId("gid://shopify/Product/1?key=abc", true)).toThrow(/not a Shopify cart/i);
  });

  it("accepts a full cart_id with key", () => {
    const id = "gid://shopify/Cart/c1-abc?key=supersecret";
    expect(validateCartId(id, true)).toBe(id);
  });

  it("never prints the cart key in redacted logs", () => {
    expect(redactCartId("gid://shopify/Cart/c1-abc?key=supersecret")).toBe(
      "gid://shopify/Cart/c1-abc?key=REDACTED"
    );
  });

  it("formats prices with currency", () => {
    expect(formatMoney({ amount: "90.0", currencyCode: "CAD" })).toBe("CA$90.00");
  });

  it("derives unit price from line total when variant price is missing", () => {
    const unit = unitMoney(undefined, { amount: "180.0", currencyCode: "CAD" }, 2);
    expect(formatMoney(unit)).toBe("CA$90.00");
  });
});

function snapshot(overrides: Partial<CartSnapshot> = {}): CartSnapshot {
  return {
    ok: true,
    cart_id: "gid://shopify/Cart/c1?key=abc",
    checkout_url: "https://example.test/cart/c/c1?key=abc",
    total_quantity: 2,
    lines: [
      {
        line_id: "line-green",
        product: "Soft Cotton Hoodie in Green",
        handle: "soft-cotton-hoodie-in-green",
        size: "Medium",
        color: "Green",
        quantity: 1,
        unit_price: "CA$90.00",
        line_total: "CA$90.00"
      },
      {
        line_id: "line-clay",
        product: "Soft Cotton Hoodie in Clay",
        handle: "soft-cotton-hoodie-in-clay",
        size: "Medium",
        color: "Clay",
        quantity: 1,
        unit_price: "CA$90.00",
        line_total: "CA$90.00"
      }
    ],
    subtotal: "CA$180.00",
    total: "CA$180.00",
    discount_codes: [],
    note: "",
    ...overrides
  };
}

describe("cart line matching", () => {
  it("errors conceptually by returning every hoodie line when color is omitted", () => {
    const matches = findMatchingLines(snapshot(), { product: "hoodie" });
    expect(matches).toHaveLength(2);
  });

  it("picks one line when size and color are specified", () => {
    const matches = findMatchingLines(snapshot(), { product: "hoodie", size: "Medium", color: "Green" });
    expect(matches.map((line) => line.line_id)).toEqual(["line-green"]);
  });
});

describe("session cart reuse", () => {
  it("reuses the remembered cart when cart_id is omitted", async () => {
    const store: ShopStore = {
      allow: async () => true,
      rememberedCart: async () => "gid://shopify/Cart/c1?key=abc",
      rememberCart: async () => undefined,
      addMerchandise: async () => {
        throw new Error("unused");
      }
    };

    await shopContext.run({ sessionId: "chat-1", store }, async () => {
      expect(await resolveCartId(undefined, true)).toBe("gid://shopify/Cart/c1?key=abc");
    });
  });

  it("serializes two adds on the same session onto one cart", async () => {
    const created: string[] = [];
    const addedTo: string[] = [];
    const client: GraphqlClient = {
      graphql: async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
        if (query.includes("CartCreate")) {
          created.push("create");
          await new Promise((resolve) => setTimeout(resolve, 25));
          return {
            cartCreate: {
              cart: {
                id: "gid://shopify/Cart/c1?key=abc",
                checkoutUrl: "https://example.test/cart/c/c1?key=abc",
                totalQuantity: 1,
                discountCodes: [],
                cost: {
                  totalAmount: { amount: "90.0", currencyCode: "CAD" },
                  subtotalAmount: { amount: "90.0", currencyCode: "CAD" }
                },
                lines: { nodes: [] }
              },
              userErrors: []
            }
          } as T;
        }
        if (query.includes("CartLinesAdd")) {
          addedTo.push(String(variables?.cartId ?? ""));
          return {
            cartLinesAdd: {
              cart: {
                id: "gid://shopify/Cart/c1?key=abc",
                checkoutUrl: "https://example.test/cart/c/c1?key=abc",
                totalQuantity: 2,
                discountCodes: [],
                cost: {
                  totalAmount: { amount: "180.0", currencyCode: "CAD" },
                  subtotalAmount: { amount: "180.0", currencyCode: "CAD" }
                },
                lines: { nodes: [] }
              },
              userErrors: []
            }
          } as T;
        }
        throw new Error(`unexpected query: ${query.slice(0, 40)}`);
      }
    } as GraphqlClient;

    const backend = new MemoryBackend();
    const store = new MemoryShopStore(backend, "chat-1", "ip", client);
    await Promise.all([
      store.addMerchandise([{ merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 }]),
      store.addMerchandise([{ merchandiseId: "gid://shopify/ProductVariant/2", quantity: 1 }])
    ]);

    expect(created).toHaveLength(1);
    expect(addedTo).toEqual(["gid://shopify/Cart/c1?key=abc"]);
    expect(backend.carts.get("chat-1")).toBe("gid://shopify/Cart/c1?key=abc");
  });
});
