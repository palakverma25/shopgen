import { describe, expect, it } from "vitest";
import { filterAndScore, resolveFromCatalog } from "../src/catalog/index.js";
import { applyQueryPrices, parsePriceConstraints } from "../src/commerce/priceQuery.js";
import { catalog } from "./fixtures.js";

describe("intent search", () => {
  it("returns warm winter items under 100, not slides", () => {
    const results = filterAndScore(catalog, {
      query: "something warm for winter under $100",
      max_price: 100,
      limit: 5
    });

    const handles = results.map((product) => product.handle);
    expect(handles).toContain("hoodie");
    expect(handles).toContain("puffer");
    expect(handles).toContain("light-puffer");
    expect(handles).not.toContain("slides");
    expect(results.every((product) => Number(product.priceMin.amount) <= 100)).toBe(true);
  });

  it("can require a color that the product actually offers", () => {
    const results = filterAndScore(catalog, {
      query: "hoodie",
      color: "Green",
      in_stock_only: true
    });

    expect(results.map((product) => product.handle)).toContain("hoodie");
    expect(results.map((product) => product.handle)).not.toContain("soft-cotton-hoodie-in-clay");
  });

  it("parses under $100 from the query when max_price is omitted", () => {
    expect(parsePriceConstraints("something warm for winter under $100")).toEqual({
      max_price: 100
    });
    const results = filterAndScore(
      catalog,
      applyQueryPrices({ query: "something warm for winter under $100", limit: 8 })
    );
    const handles = results.map((product) => product.handle);
    expect(handles).toContain("hoodie");
    expect(handles).toContain("puffer");
    expect(handles).not.toContain("premium-puffer");
    expect(results.every((product) => Number(product.priceMin.amount) <= 100)).toBe(true);
  });

  it("treats cheaper/budget as under 100", () => {
    expect(parsePriceConstraints("i want to buy cheaper")).toEqual({ max_price: 100 });
  });

  it("does not override an explicit max_price", () => {
    const applied = applyQueryPrices({ query: "hoodie under $100", max_price: 50 });
    expect(applied.max_price).toBe(50);
  });

  it("resolves the hoodie handle exactly", () => {
    const matches = resolveFromCatalog(catalog, "hoodie");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.handle).toBe("hoodie");
  });
});
