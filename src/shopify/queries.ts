export const MONEY_FIELDS = `
  amount
  currencyCode
`;

export const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  discountCodes {
    code
    applicable
  }
  cost {
    totalAmount { ${MONEY_FIELDS} }
    subtotalAmount { ${MONEY_FIELDS} }
  }
  lines(first: 50) {
    nodes {
      id
      quantity
      cost {
        totalAmount { ${MONEY_FIELDS} }
      }
      merchandise {
        ... on ProductVariant {
          id
          title
          selectedOptions { name value }
          price { ${MONEY_FIELDS} }
          product { title handle }
        }
      }
    }
  }
`;

export const CATALOG_QUERY = `
  query Catalog($first: Int!) {
    products(first: $first) {
      nodes {
        id
        handle
        title
        description
        tags
        productType
        availableForSale
        priceRange {
          minVariantPrice { ${MONEY_FIELDS} }
          maxVariantPrice { ${MONEY_FIELDS} }
        }
        options { name values }
        images(first: 1) { nodes { url altText } }
      }
    }
  }
`;

export const SEARCH_QUERY = `
  query SearchProducts($q: String!, $first: Int!) {
    search(query: $q, types: [PRODUCT], first: $first) {
      nodes {
        ... on Product {
          id
          handle
          title
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      handle
      title
      description
      tags
      productType
      availableForSale
      priceRange {
        minVariantPrice { ${MONEY_FIELDS} }
        maxVariantPrice { ${MONEY_FIELDS} }
      }
      options { name values }
      images(first: 8) { nodes { url altText } }
      variants(first: 80) {
        nodes {
          id
          title
          availableForSale
          quantityAvailable
          selectedOptions { name value }
          price { ${MONEY_FIELDS} }
          image { url }
        }
      }
    }
  }
`;

export const RECOMMENDATIONS_QUERY = `
  query Recommendations($productId: ID!, $intent: ProductRecommendationIntent) {
    productRecommendations(productId: $productId, intent: $intent) {
      id
      handle
      title
      availableForSale
      tags
      priceRange {
        minVariantPrice { ${MONEY_FIELDS} }
      }
      options { name values }
      images(first: 1) { nodes { url } }
    }
  }
`;

export const POLICIES_QUERY = `
  query ShopPolicies {
    shop {
      name
      privacyPolicy { title body }
      refundPolicy { title body }
      shippingPolicy { title body }
    }
  }
`;

export const CART_QUERY = `
  query Cart($id: ID!) {
    cart(id: $id) {
      ${CART_FIELDS}
    }
  }
`;

export const CART_CREATE_MUTATION = `
  mutation CartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
    }
  }
`;

export const CART_LINES_ADD_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
    }
  }
`;

export const CART_LINES_UPDATE_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
    }
  }
`;

export const CART_LINES_REMOVE_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
    }
  }
`;

export const CART_DISCOUNT_MUTATION = `
  mutation CartDiscount($cartId: ID!, $discountCodes: [String!]!) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
    }
  }
`;
