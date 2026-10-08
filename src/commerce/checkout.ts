const DEFAULT_ORIGIN = "https://shopgen-mcp.shopgen.workers.dev";

export function checkoutOrigin(): string {
  const raw = typeof process !== "undefined" ? process.env.PUBLIC_URL : undefined;
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // ignore invalid PUBLIC_URL
    }
  }
  return DEFAULT_ORIGIN;
}

export function hostedCheckoutUrl(cartId: string, origin = checkoutOrigin()): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/checkout?cart_id=${encodeURIComponent(cartId)}`;
}

export function isUsableStoreCheckoutUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const path = parsed.pathname;
    return (
      /\/cart\/c\//i.test(path) ||
      /\/checkouts\//i.test(path) ||
      parsed.searchParams.has("key") ||
      parsed.searchParams.has("cart_id")
    );
  } catch {
    return false;
  }
}

export function resolveCheckoutUrl(
  cartId: string,
  storeCheckoutUrl: string | null | undefined,
  origin = checkoutOrigin()
): string {
  if (isUsableStoreCheckoutUrl(storeCheckoutUrl)) {
    return storeCheckoutUrl;
  }
  return hostedCheckoutUrl(cartId, origin);
}
