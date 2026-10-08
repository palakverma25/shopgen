export type Money = {
  amount: string;
  currencyCode: string;
};

export type ProductOption = {
  name: string;
  values: string[];
};

export type SelectedOption = {
  name: string;
  value: string;
};

export type CatalogProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  tags: string[];
  productType: string;
  availableForSale: boolean;
  priceMin: Money;
  priceMax: Money;
  options: ProductOption[];
  imageUrl?: string;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: SelectedOption[];
  price: Money;
  imageUrl?: string;
};

export type ProductDetail = CatalogProduct & {
  variants: ProductVariant[];
  images: { url: string; altText: string | null }[];
};

export type CartLineSnapshot = {
  line_id: string;
  product: string;
  handle: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type DiscountCodeStatus = {
  code: string;
  applicable: boolean;
};

export type CartSnapshot = {
  ok: true;
  cart_id: string;
  checkout_url: string | null;
  total_quantity: number;
  lines: CartLineSnapshot[];
  subtotal: string | null;
  total: string | null;
  discount_codes: DiscountCodeStatus[];
  note: string;
};

export type SearchFilters = {
  query: string;
  min_price?: number;
  max_price?: number;
  category?: string;
  size?: string;
  color?: string;
  in_stock_only?: boolean;
  limit?: number;
};

export type ScoredProduct = CatalogProduct & {
  score: number;
  why: string;
};

export type ToolFailure = {
  ok: false;
  error: string;
  hint?: string;
};
