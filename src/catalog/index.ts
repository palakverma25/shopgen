import type { CatalogProduct, ScoredProduct, SearchFilters } from "../types.js";
import { applyQueryPrices } from "../commerce/priceQuery.js";
import { moneyAmount, normalize, sameLabel, sameSize } from "../commerce/format.js";
import { fetchCatalog, searchStoreHandles } from "../shopify/api.js";
import type { GraphqlClient } from "../shopify/client.js";
import { CATEGORY_TAGS, keywordCandidates } from "./synonyms.js";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CatalogCache = {
  products: CatalogProduct[];
  fetchedAt: number;
};

let cache: CatalogCache | null = null;

export async function loadCatalog(
  client: GraphqlClient,
  now = Date.now()
): Promise<CatalogProduct[]> {
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.products;
  }
  const products = await fetchCatalog(client);
  cache = { products, fetchedAt: now };
  return products;
}

export function scoreProduct(product: CatalogProduct, query: string): ScoredProduct {
  const terms = keywordCandidates(query);
  const haystack = normalize(
    [product.title, product.handle.replace(/-/g, " "), product.tags.join(" "), product.description].join(" ")
  );
  let score = 0;
  const reasons: string[] = [];

  for (const term of terms) {
    const needle = normalize(term);
    if (!needle) continue;
    if (normalize(product.title) === needle) {
      score += 12;
      reasons.push(`exact title match for "${term}"`);
    } else if (normalize(product.title).includes(needle)) {
      score += 8;
      reasons.push(`title includes "${term}"`);
    } else if (product.tags.some((tag) => normalize(tag).includes(needle))) {
      score += 4;
      reasons.push(`tagged ${term}`);
    } else if (haystack.includes(needle)) {
      score += 2;
    }
  }

  if (score > 0 && product.availableForSale) score += 1;
  if (product.handle.endsWith("-old")) score -= 3;

  const uniqueWhy = [...new Set(reasons)].slice(0, 2);
  return {
    ...product,
    score,
    why: uniqueWhy.join("; ") || "Catalog match after intent expansion"
  };
}

function hasOption(product: CatalogProduct, name: string, value: string): boolean {
  const option = product.options.find((item) => sameLabel(item.name, name));
  if (!option) return false;
  if (sameLabel(name, "Size")) {
    return option.values.some((item) => sameSize(item, value));
  }
  return option.values.some((item) => sameLabel(item, value));
}

export function filterAndScore(
  products: CatalogProduct[],
  filters: SearchFilters,
  boostedHandles: string[] = []
): ScoredProduct[] {
  const limit = Math.min(Math.max(filters.limit ?? 5, 1), 10);
  const categoryNeedles = filters.category
    ? CATEGORY_TAGS[normalize(filters.category)] ?? [normalize(filters.category)]
    : [];

  const scored = products
    .map((product) => {
      const result = scoreProduct(product, filters.query);
      if (boostedHandles.includes(product.handle)) {
        result.score += 6;
        result.why = result.why
          ? `${result.why}; store keyword search`
          : "store keyword search";
      }
      return result;
    })
    .filter((product) => {
      if (filters.min_price !== undefined && moneyAmount(product.priceMin) < filters.min_price) {
        return false;
      }
      if (filters.max_price !== undefined && moneyAmount(product.priceMin) > filters.max_price) {
        return false;
      }
      if (filters.in_stock_only && !product.availableForSale) return false;
      if (filters.size && !hasOption(product, "Size", filters.size)) return false;
      if (filters.color && !hasOption(product, "Color", filters.color)) return false;
      if (categoryNeedles.length) {
        const blob = normalize([product.tags.join(" "), product.title, product.handle].join(" "));
        if (!categoryNeedles.some((needle) => blob.includes(normalize(needle)))) return false;
      }
      return product.score > 0;
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.handle === "hoodie") - Number(left.handle === "hoodie") ||
        left.title.localeCompare(right.title)
    );

  return scored.slice(0, limit);
}

export async function searchCatalog(
  client: GraphqlClient,
  filters: SearchFilters
): Promise<ScoredProduct[]> {
  const applied = applyQueryPrices(filters);
  const products = await loadCatalog(client);
  const keywords = keywordCandidates(applied.query).slice(0, 4);
  const boosted = new Set<string>();

  await Promise.all(
    keywords.map(async (keyword) => {
      try {
        const handles = await searchStoreHandles(client, keyword, 8);
        for (const handle of handles) boosted.add(handle);
      } catch {
        // Shopify search is optional; local scoring still works.
      }
    })
  );

  return filterAndScore(products, applied, [...boosted]);
}

export function resolveFromCatalog(
  products: CatalogProduct[],
  query: string
): CatalogProduct[] {
  const needle = normalize(query);
  const handle = needle.replace(/\s+/g, "-");

  const exactHandle = products.filter((product) => product.handle === handle || product.handle === needle);
  if (exactHandle.length === 1) return exactHandle;

  const exactTitle = products.filter((product) => normalize(product.title) === needle);
  if (exactTitle.length) return exactTitle;

  return products.filter((product) => {
    return (
      normalize(product.title).includes(needle) ||
      product.handle.includes(handle) ||
      product.tags.some((tag) => normalize(tag) === needle)
    );
  });
}
