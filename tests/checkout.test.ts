import { describe, expect, it } from "vitest";
import {
  hostedCheckoutUrl,
  isUsableStoreCheckoutUrl,
  resolveCheckoutUrl
} from "../src/commerce/checkout.js";
import { renderCheckoutHtml } from "../src/checkout/page.js";
import type { CartSnapshot } from "../src/types.js";

const cartId = "gid://shopify/Cart/c1-abc?key=supersecret";

function cart(overrides: Partial<CartSnapshot> = {}): CartSnapshot {
  return {
    ok: true,
    cart_id: cartId,
    checkout_url: "https://demostore.hydrogen.mock.shop/checkout",
    total_quantity: 2,
    lines: [
      {
        line_id: "gid://shopify/CartLine/1",
        product: "Soft Cotton Hoodie in Green",
        handle: "soft-cotton-hoodie-in-green",
        size: "Medium",
        color: "Green",
        quantity: 2,
        unit_price: "CA$90.00",
        line_total: "CA$180.00"
      }
    ],
    subtotal: "CA$180.00",
    total: "CA$180.00",
    discount_codes: [],
    note: "",
    ...overrides
  };
}

describe("checkout URL rewrite", () => {
  it("rejects the dummy mock.shop /checkout URL", () => {
    expect(isUsableStoreCheckoutUrl("https://demostore.hydrogen.mock.shop/checkout")).toBe(false);
    expect(isUsableStoreCheckoutUrl(null)).toBe(false);
  });

  it("keeps a Storefront cart permalink that includes the token", () => {
    const storeUrl = "https://shop.example/cart/c/c1-abc?key=supersecret";
    expect(isUsableStoreCheckoutUrl(storeUrl)).toBe(true);
    expect(resolveCheckoutUrl(cartId, storeUrl)).toBe(storeUrl);
  });

  it("builds a hosted checkout link that carries the full cart_id", () => {
    const url = resolveCheckoutUrl(cartId, "https://demostore.hydrogen.mock.shop/checkout", "https://shop.example");
    expect(url).toBe(hostedCheckoutUrl(cartId, "https://shop.example"));
    expect(url).toContain("cart_id=");
    expect(decodeURIComponent(new URL(url).searchParams.get("cart_id") ?? "")).toBe(cartId);
  });
});

describe("checkout page", () => {
  it("renders line items and the cart total", () => {
    const html = renderCheckoutHtml({ cart: cart() });
    expect(html).toContain("Soft Cotton Hoodie in Green");
    expect(html).toContain("Green · Medium");
    expect(html).toContain("CA$180.00");
    expect(html).toContain("Confirm mock order");
    expect(html).not.toContain("Your cart is empty");
  });

  it("escapes untrusted product titles", () => {
    const html = renderCheckoutHtml({
      cart: cart({
        lines: [
          {
            line_id: "1",
            product: `<img src=x onerror="alert(1)">Hoodie`,
            handle: "hoodie",
            size: "M",
            color: "Green",
            quantity: 1,
            unit_price: "CA$90.00",
            line_total: "CA$90.00"
          }
        ]
      })
    });
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;Hoodie");
    expect(html).not.toContain("<img src=x");
  });

  it("shows a confirmation after a mock order", () => {
    const html = renderCheckoutHtml({ cart: cart(), placed: true });
    expect(html).toMatch(/mock order confirmed/i);
    expect(html).toContain("CA$180.00");
  });
});
