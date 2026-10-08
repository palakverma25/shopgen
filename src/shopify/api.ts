import type {
  CartSnapshot,
  CatalogProduct,
  DiscountCodeStatus,
  Money,
  ProductDetail,
  ProductVariant
} from "../types.js";
import { resolveCheckoutUrl } from "../commerce/checkout.js";
import { formatMoney, optionValue, redactCartId, unitMoney } from "../commerce/format.js";
import { ShopifyError, type GraphqlClient } from "./client.js";
import {
  CART_CREATE_MUTATION,
  CART_DISCOUNT_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  CATALOG_QUERY,
  POLICIES_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  RECOMMENDATIONS_QUERY,
  SEARCH_QUERY
} from "./queries.js";

type MoneyNode = Money;

type ProductNode = {
  id: string;
  handle: string;
  title: string;
  description?: string | null;
  tags?: string[] | null;
  productType?: string | null;
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: MoneyNode;
    maxVariantPrice?: MoneyNode;
  };
  options?: { name: string; values: string[] }[] | null;
  images?: { nodes: { url: string; altText?: string | null }[] };
  variants?: {
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      quantityAvailable?: number | null;
      selectedOptions: { name: string; value: string }[];
      price: MoneyNode;
      image?: { url: string } | null;
    }[];
  };
};

type CartNode = {
  id: string;
  checkoutUrl: string | null;
  totalQuantity: number;
  discountCodes: DiscountCodeStatus[];
  cost: {
    totalAmount: MoneyNode;
    subtotalAmount: MoneyNode;
  };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      cost: { totalAmount: MoneyNode };
      merchandise: {
        id?: string;
        title?: string;
        selectedOptions?: { name: string; value: string }[];
        price?: MoneyNode;
        product?: { title: string; handle: string };
      };
    }[];
  };
};

type UserError = { field?: string[] | null; message: string; code?: string | null };

type MutationPayload = {
  cart?: CartNode | null;
  userErrors: UserError[];
};

export function mapCatalogProduct(node: ProductNode): CatalogProduct {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? "",
    tags: node.tags ?? [],
    productType: node.productType ?? "",
    availableForSale: node.availableForSale,
    priceMin: node.priceRange.minVariantPrice,
    priceMax: node.priceRange.maxVariantPrice ?? node.priceRange.minVariantPrice,
    options: node.options ?? [],
    imageUrl: node.images?.nodes[0]?.url
  };
}

export function mapProductDetail(node: ProductNode): ProductDetail {
  const variants: ProductVariant[] = (node.variants?.nodes ?? []).map((variant) => ({
    id: variant.id,
    title: variant.title,
    availableForSale: variant.availableForSale,
    quantityAvailable: variant.quantityAvailable ?? null,
    selectedOptions: variant.selectedOptions,
    price: variant.price,
    imageUrl: variant.image?.url
  }));

  return {
    ...mapCatalogProduct(node),
    variants,
    images: (node.images?.nodes ?? []).map((image) => ({
      url: image.url,
      altText: image.altText ?? null
    }))
  };
}

export function mapCart(cart: CartNode): CartSnapshot {
  return {
    ok: true,
    cart_id: cart.id,
    checkout_url: resolveCheckoutUrl(cart.id, cart.checkoutUrl),
    total_quantity: cart.totalQuantity,
    lines: cart.lines.nodes.map((line) => {
      const merchandise = line.merchandise;
      return {
        line_id: line.id,
        product: merchandise.product?.title ?? merchandise.title ?? "Item",
        handle: merchandise.product?.handle ?? "",
        size: optionValue(merchandise.selectedOptions ?? [], "Size"),
        color: optionValue(merchandise.selectedOptions ?? [], "Color"),
        quantity: line.quantity,
        unit_price: formatMoney(unitMoney(merchandise.price, line.cost.totalAmount, line.quantity)),
        line_total: formatMoney(line.cost.totalAmount)
      };
    }),
    subtotal: formatMoney(cart.cost.subtotalAmount),
    total: formatMoney(cart.cost.totalAmount),
    discount_codes: cart.discountCodes,
    note: "Always pass the full cart_id, including ?key=, on later cart calls. Do not truncate it."
  };
}

function mutationCart(payload: MutationPayload | null | undefined, action: string): CartSnapshot {
  const errors = payload?.userErrors ?? [];
  if (errors.length) {
    throw new ShopifyError(
      `${action} failed: ${errors.map((error) => error.message).join("; ")}`,
      errors.map((error) => error.message)
    );
  }
  if (!payload?.cart) {
    throw new ShopifyError(`${action} did not return a cart. Nothing was changed.`);
  }
  return mapCart(payload.cart);
}

export async function fetchCatalog(client: GraphqlClient): Promise<CatalogProduct[]> {
  const data = await client.graphql<{ products: { nodes: ProductNode[] } }>(CATALOG_QUERY, {
    first: 50
  });
  return data.products.nodes.map(mapCatalogProduct);
}

export async function searchStoreHandles(
  client: GraphqlClient,
  query: string,
  first = 10
): Promise<string[]> {
  const data = await client.graphql<{
    search: { nodes: Array<{ handle?: string } | null> };
  }>(SEARCH_QUERY, { q: query, first });
  return (data.search.nodes ?? [])
    .map((node) => node?.handle)
    .filter((handle): handle is string => Boolean(handle));
}

export async function fetchProductByHandle(
  client: GraphqlClient,
  handle: string
): Promise<ProductDetail | null> {
  const data = await client.graphql<{ product: ProductNode | null }>(PRODUCT_BY_HANDLE_QUERY, {
    handle
  });
  return data.product ? mapProductDetail(data.product) : null;
}

export async function fetchRecommendations(
  client: GraphqlClient,
  productId: string,
  intent: "RELATED" | "COMPLEMENTARY"
): Promise<CatalogProduct[]> {
  const data = await client.graphql<{ productRecommendations: ProductNode[] | null }>(
    RECOMMENDATIONS_QUERY,
    { productId, intent }
  );
  return (data.productRecommendations ?? []).map(mapCatalogProduct);
}

export async function fetchPolicies(client: GraphqlClient): Promise<{
  shop: string;
  privacy: { title: string; body: string } | null;
  refund: { title: string; body: string } | null;
  shipping: { title: string; body: string } | null;
}> {
  const data = await client.graphql<{
    shop: {
      name: string;
      privacyPolicy: { title: string; body: string } | null;
      refundPolicy: { title: string; body: string } | null;
      shippingPolicy: { title: string; body: string } | null;
    };
  }>(POLICIES_QUERY);
  return {
    shop: data.shop.name,
    privacy: data.shop.privacyPolicy,
    refund: data.shop.refundPolicy,
    shipping: data.shop.shippingPolicy
  };
}

export async function fetchCart(client: GraphqlClient, cartId: string): Promise<CartSnapshot> {
  const data = await client.graphql<{ cart: CartNode | null }>(CART_QUERY, { id: cartId });
  if (!data.cart) {
    throw new ShopifyError(
      `No cart found for ${redactCartId(cartId)}. Use the full cart_id from the last cart tool result.`
    );
  }
  return mapCart(data.cart);
}

export async function createCart(
  client: GraphqlClient,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<CartSnapshot> {
  const data = await client.graphql<{ cartCreate: MutationPayload }>(CART_CREATE_MUTATION, {
    lines
  });
  return mutationCart(data.cartCreate, "Creating the cart");
}

export async function addCartLines(
  client: GraphqlClient,
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<CartSnapshot> {
  const data = await client.graphql<{ cartLinesAdd: MutationPayload }>(CART_LINES_ADD_MUTATION, {
    cartId,
    lines
  });
  return mutationCart(data.cartLinesAdd, "Adding to the cart");
}

export async function updateCartLines(
  client: GraphqlClient,
  cartId: string,
  lineId: string,
  quantity: number
): Promise<CartSnapshot> {
  const data = await client.graphql<{ cartLinesUpdate: MutationPayload }>(
    CART_LINES_UPDATE_MUTATION,
    { cartId, lines: [{ id: lineId, quantity }] }
  );
  return mutationCart(data.cartLinesUpdate, "Updating the cart");
}

export async function removeCartLines(
  client: GraphqlClient,
  cartId: string,
  lineIds: string[]
): Promise<CartSnapshot> {
  const data = await client.graphql<{ cartLinesRemove: MutationPayload }>(
    CART_LINES_REMOVE_MUTATION,
    { cartId, lineIds }
  );
  return mutationCart(data.cartLinesRemove, "Removing from the cart");
}

export async function updateDiscountCodes(
  client: GraphqlClient,
  cartId: string,
  discountCodes: string[]
): Promise<CartSnapshot> {
  const data = await client.graphql<{ cartDiscountCodesUpdate: MutationPayload }>(
    CART_DISCOUNT_MUTATION,
    { cartId, discountCodes }
  );
  return mutationCart(data.cartDiscountCodesUpdate, "Applying the discount");
}
