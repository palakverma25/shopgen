import { describe, expect, it } from "vitest";
import { interpretDiscount } from "../src/commerce/cart.js";
import type { CartSnapshot } from "../src/types.js";

function cart(overrides: Partial<CartSnapshot> = {}): CartSnapshot {
  return {
    ok: true,
    cart_id: "gid://shopify/Cart/c1?key=abc",
    checkout_url: "https://example.test/checkout",
    total_quantity: 1,
    lines: [],
    subtotal: "CA$90.00",
    total: "CA$90.00",
    discount_codes: [],
    note: "",
    ...overrides
  };
}

describe("discount honesty", () => {
  it("treats applicable:false as a failure even if the mutation returned a cart", () => {
    const result = interpretDiscount(
      cart({
        discount_codes: [{ code: "SAVE10", applicable: false }],
        total: "CA$90.00"
      }),
      "SAVE10",
      "CA$90.00"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not applicable/i);
      expect(result.error).toMatch(/CA\$90.00/);
    }
  });

  it("succeeds only when the code is applicable and the total changes", () => {
    const result = interpretDiscount(
      cart({
        discount_codes: [{ code: "SAVE10", applicable: true }],
        total: "CA$81.00"
      }),
      "SAVE10",
      "CA$90.00"
    );

    expect(result.ok).toBe(true);
  });
});
