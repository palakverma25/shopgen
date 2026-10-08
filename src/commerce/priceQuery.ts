import type { SearchFilters } from "../types.js";

const MONEY = String.raw`(?:ca\$|us\$|\$|€|£)?\s*(\d+(?:\.\d+)?)`;

function firstNumber(match: RegExpMatchArray | null, group = 1): number | undefined {
  if (!match?.[group]) return undefined;
  const value = Number(match[group]);
  return Number.isFinite(value) ? value : undefined;
}

export function parsePriceConstraints(query: string): { min_price?: number; max_price?: number } {
  const text = query.toLowerCase().replace(/,/g, "");
  const result: { min_price?: number; max_price?: number } = {};

  result.max_price = firstNumber(
    text.match(new RegExp(String.raw`(?:under|below|less\s+than|up\s+to|upto|at\s+most|no\s+more\s+than|max(?:imum)?)\s*${MONEY}`))
  );
  if (result.max_price === undefined) {
    result.max_price = firstNumber(text.match(new RegExp(String.raw`${MONEY}\s+(?:or\s+less|and\s+under)`)));
  }

  result.min_price = firstNumber(
    text.match(new RegExp(String.raw`(?:over|above|at\s+least|more\s+than|min(?:imum)?)\s*${MONEY}`))
  );

  if (result.max_price === undefined && /\b(cheap(?:er)?|budget|affordable|inexpensive)\b/.test(text)) {
    result.max_price = 100;
  }

  return result;
}

export function applyQueryPrices(filters: SearchFilters): SearchFilters {
  const parsed = parsePriceConstraints(filters.query);
  return {
    ...filters,
    min_price: filters.min_price ?? parsed.min_price,
    max_price: filters.max_price ?? parsed.max_price
  };
}
