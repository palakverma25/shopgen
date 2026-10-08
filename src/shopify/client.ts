export const STOREFRONT_URL = "https://mock.shop/api";
export const REQUEST_TIMEOUT_MS = 10_000;

export class ShopifyError extends Error {
  readonly userErrors: string[];

  constructor(message: string, userErrors: string[] = []) {
    super(message);
    this.name = "ShopifyError";
    this.userErrors = userErrors;
  }
}

export type GraphqlClient = {
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export function createShopifyClient(fetchImpl: typeof fetch = fetch): GraphqlClient {
  return {
    async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetchImpl(STOREFRONT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new ShopifyError(
            `The store API returned HTTP ${response.status}. Nothing was changed. Try again.`
          );
        }

        const json = (await response.json()) as GraphqlResponse<T>;
        if (json.errors?.length) {
          throw new ShopifyError(
            `The store API rejected the request: ${json.errors.map((error) => error.message).join("; ")}`
          );
        }
        if (!json.data) {
          throw new ShopifyError("The store API returned no data. Nothing was changed. Try again.");
        }
        return json.data;
      } catch (error) {
        if (error instanceof ShopifyError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new ShopifyError("The store API timed out. Nothing was changed. Try again.");
        }
        throw new ShopifyError("Could not reach the store. Nothing was changed. Try again.");
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

export const shopify = createShopifyClient();
