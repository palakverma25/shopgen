import type { CatalogProduct, ProductDetail, ProductVariant } from "../types.js";
import { loadCatalog, resolveFromCatalog } from "../catalog/index.js";
import { fetchProductByHandle } from "../shopify/api.js";
import type { GraphqlClient } from "../shopify/client.js";
import { optionValue, sameLabel, sameSize } from "./format.js";

export type VariantMatch =
  | { ok: true; product: ProductDetail; variant: ProductVariant }
  | { ok: false; error: string; hint?: string };

function optionList(product: ProductDetail, name: string): string[] {
  return product.options.find((option) => sameLabel(option.name, name))?.values ?? [];
}

function variantMatches(variant: ProductVariant, size?: string, color?: string): boolean {
  const variantSize = optionValue(variant.selectedOptions, "Size");
  const variantColor = optionValue(variant.selectedOptions, "Color");
  if (size && (!variantSize || !sameSize(variantSize, size))) return false;
  if (color && (!variantColor || !sameLabel(variantColor, color))) return false;
  return true;
}

export function describeVariant(variant: ProductVariant): string {
  const size = optionValue(variant.selectedOptions, "Size");
  const color = optionValue(variant.selectedOptions, "Color");
  return [color, size].filter(Boolean).join(" ") || variant.title;
}

export function availableAlternatives(product: ProductDetail, size?: string, color?: string): string {
  const inStock = product.variants.filter((variant) => variant.availableForSale);
  if (!inStock.length) return "This product is sold out in every size and color.";

  if (color) {
    const sameColor = inStock
      .filter((variant) => {
        const variantColor = optionValue(variant.selectedOptions, "Color");
        return variantColor ? sameLabel(variantColor, color) : false;
      })
      .map((variant) => optionValue(variant.selectedOptions, "Size"))
      .filter((value): value is string => Boolean(value));
    if (sameColor.length) {
      return `${color} is available in ${uniqueJoin(sameColor)}.`;
    }
  }

  if (size) {
    const sameSizeMatches = inStock
      .filter((variant) => {
        const variantSize = optionValue(variant.selectedOptions, "Size");
        return variantSize ? sameSize(variantSize, size) : false;
      })
      .map((variant) => optionValue(variant.selectedOptions, "Color"))
      .filter((value): value is string => Boolean(value));
    if (sameSizeMatches.length) {
      return `${size} is available in ${uniqueJoin(sameSizeMatches)}.`;
    }
  }

  return `In stock: ${uniqueJoin(inStock.map(describeVariant))}.`;
}

function uniqueJoin(values: string[]): string {
  return [...new Set(values)].join(", ");
}

export function matchVariant(
  product: ProductDetail,
  size?: string,
  color?: string
): VariantMatch {
  const sizes = optionList(product, "Size");
  const colors = optionList(product, "Color");

  if (sizes.length && !size) {
    return {
      ok: false,
      error: `Choose a size for ${product.title}.`,
      hint: `Available sizes: ${sizes.join(", ")}.`
    };
  }
  if (colors.length && !color) {
    return {
      ok: false,
      error: `Choose a color for ${product.title}.`,
      hint: `Available colors: ${colors.join(", ")}.`
    };
  }

  const variant = product.variants.find((item) => variantMatches(item, size, color));
  if (!variant) {
    return {
      ok: false,
      error: `${product.title} does not have ${[color, size].filter(Boolean).join(" ")}.`,
      hint: availableAlternatives(product, size, color)
    };
  }

  if (!variant.availableForSale) {
    const wanted = describeVariant(variant);
    return {
      ok: false,
      error: `${wanted} is out of stock.`,
      hint: availableAlternatives(product, size, color)
    };
  }

  return { ok: true, product, variant };
}

export async function resolveProduct(
  client: GraphqlClient,
  query: string
): Promise<{ ok: true; product: ProductDetail } | { ok: false; error: string; hint?: string }> {
  const catalog = await loadCatalog(client);
  const cleaned = query.replace(/\b(the|a|an|in|my|please)\b/gi, " ").replace(/\s+/g, " ").trim();
  let matches = resolveFromCatalog(catalog, cleaned);

  if (!matches.length) {
    matches = resolveFromCatalog(catalog, query);
  }

  if (matches.length > 1) {
    matches = preferCanonicalHoodie(uniqueByHandle(matches));
  }

  if (matches.length > 1) {
    return {
      ok: false,
      error: `Several products match "${query}". Say which one you want.`,
      hint: matches.map((product) => `${product.title} (handle: ${product.handle})`).join("; ")
    };
  }

  const chosen = matches[0];
  const handle = chosen?.handle ?? cleaned.toLowerCase().replace(/\s+/g, "-");
  const product = await fetchProductByHandle(client, handle);
  if (!product) {
    return {
      ok: false,
      error: `No product found for "${query}".`,
      hint: "Search first, then use a product handle such as hoodie, puffer, or light-puffer."
    };
  }
  return { ok: true, product };
}

function uniqueByHandle(products: CatalogProduct[]): CatalogProduct[] {
  const seen = new Set<string>();
  const result: CatalogProduct[] = [];
  for (const product of products) {
    if (seen.has(product.handle)) continue;
    seen.add(product.handle);
    result.push(product);
  }
  return result;
}

export function preferCanonicalHoodie(matches: CatalogProduct[]): CatalogProduct[] {
  if (matches.length <= 1) return matches;
  const hoodie = matches.find((product) => product.handle === "hoodie");
  return hoodie ? [hoodie] : matches;
}
