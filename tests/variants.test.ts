import { describe, expect, it } from "vitest";
import { matchVariant } from "../src/commerce/variants.js";
import { hoodieDetail } from "./fixtures.js";

describe("variant resolver", () => {
  it("resolves medium green as an in-stock variant", () => {
    const match = matchVariant(hoodieDetail, "medium", "green");
    expect(match.ok).toBe(true);
    if (match.ok) {
      expect(match.variant.id).toBe("gid://shopify/ProductVariant/green-medium");
      expect(match.variant.availableForSale).toBe(true);
    }
  });

  it("fails on out-of-stock Clay Small and lists alternatives", () => {
    const match = matchVariant(hoodieDetail, "Small", "Clay");
    expect(match.ok).toBe(false);
    if (!match.ok) {
      expect(match.error).toMatch(/out of stock/i);
      expect(match.hint).toMatch(/Clay is available in Medium|Medium/i);
    }
  });

  it("requires size and color when the product has those options", () => {
    const missingSize = matchVariant(hoodieDetail, undefined, "Green");
    expect(missingSize.ok).toBe(false);
    if (!missingSize.ok) {
      expect(missingSize.error).toMatch(/size/i);
    }
  });
});
