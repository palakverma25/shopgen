export const INTENT_FAMILIES: Record<string, string[]> = {
  warm: ["hoodie", "puffer", "crewneck", "half zip", "beanie", "sweatpants"],
  winter: ["hoodie", "puffer", "crewneck", "half zip", "beanie"],
  cold: ["hoodie", "puffer", "crewneck", "beanie"],
  cozy: ["hoodie", "crewneck", "sweatpants", "half zip"],
  chilly: ["hoodie", "puffer", "beanie"],
  fleece: ["hoodie", "crewneck"],
  outerwear: ["puffer", "jacket"],
  jacket: ["puffer", "hoodie", "jacket"],
  coat: ["puffer", "jacket"],
  lightweight: ["puffer", "hoodie"],
  packable: ["puffer"],
  layer: ["hoodie", "crewneck", "puffer"],
  budget: ["hoodie", "puffer"],
  cheap: ["hoodie", "puffer"],
  cheaper: ["hoodie", "puffer"],
  hoodie: ["hoodie"],
  sweater: ["hoodie", "crewneck", "half zip"],
  pullover: ["hoodie", "crewneck"],
  sweatshirt: ["hoodie"],
  puffer: ["puffer"],
  vest: ["puffer"],
  pants: ["sweatpants", "leggings", "shorts"],
  bottoms: ["sweatpants", "leggings", "shorts"],
  shoes: ["sneakers", "slides", "runners"],
  sneakers: ["sneakers", "runners"],
  accessories: ["sunnies", "beanie", "frontpack", "slides"]
};

export const CATEGORY_TAGS: Record<string, string[]> = {
  tops: ["tops", "hoodie", "crewneck", "shirt", "half zip"],
  bottoms: ["bottoms", "sweatpants", "leggings", "shorts"],
  shoes: ["shoes", "sneakers", "slides", "runners"],
  accessories: ["accessories", "sunnies", "beanie", "frontpack"],
  men: ["men"],
  women: ["women"],
  unisex: ["unisex"]
};

export function expandIntent(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const family = INTENT_FAMILIES[token];
    if (family) {
      for (const term of family) expanded.add(term);
    }
  }
  return [...expanded];
}

export function keywordCandidates(query: string): string[] {
  const stop = new Set([
    "something",
    "some",
    "for",
    "the",
    "and",
    "under",
    "over",
    "with",
    "a",
    "an",
    "in",
    "on",
    "of",
    "to",
    "my",
    "me",
    "i",
    "need",
    "want",
    "show",
    "get",
    "please",
    "ones",
    "looking",
    "find",
    "finding"
  ]);
  return expandIntent(query).filter((token) => token.length > 2 && !stop.has(token) && !/^\d+$/.test(token));
}
