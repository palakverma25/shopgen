import type { CatalogProduct, ProductDetail } from "../src/types.js";

const cad = (amount: string) => ({ amount, currencyCode: "CAD" });

export const catalog: CatalogProduct[] = [
  {
    id: "gid://shopify/Product/hoodie",
    handle: "hoodie",
    title: "Hoodie",
    description: "Soft fleece hoodie for chilly days.",
    tags: ["tops", "unisex"],
    productType: "",
    availableForSale: true,
    priceMin: cad("90.0"),
    priceMax: cad("90.0"),
    options: [
      { name: "Color", values: ["Clay", "Green", "Red"] },
      { name: "Size", values: ["Small", "Medium", "Large"] }
    ]
  },
  {
    id: "gid://shopify/Product/hoodie-old",
    handle: "hoodie-old",
    title: "Hoodie",
    description: "Older hoodie listing.",
    tags: ["tops"],
    productType: "",
    availableForSale: true,
    priceMin: cad("90.0"),
    priceMax: cad("90.0"),
    options: [
      { name: "Color", values: ["Red"] },
      { name: "Size", values: ["Small"] }
    ]
  },
  {
    id: "gid://shopify/Product/premium-puffer",
    handle: "premium-puffer",
    title: "Premium Puffer",
    description: "Heavy winter puffer for deep cold.",
    tags: ["tops", "unisex"],
    productType: "",
    availableForSale: true,
    priceMin: cad("180.0"),
    priceMax: cad("180.0"),
    options: [
      { name: "Size", values: ["Small", "Medium", "Large"] },
      { name: "Color", values: ["Green"] }
    ]
  },
  {
    id: "gid://shopify/Product/puffer",
    handle: "puffer",
    title: "Puffer",
    description: "Nylon puffer vest that keeps you dry and warm in winter weather.",
    tags: ["tops", "unisex"],
    productType: "",
    availableForSale: true,
    priceMin: cad("80.0"),
    priceMax: cad("80.0"),
    options: [
      { name: "Size", values: ["Small", "Medium", "Large"] },
      { name: "Color", values: ["Green", "Olive"] }
    ]
  },
  {
    id: "gid://shopify/Product/light-puffer",
    handle: "light-puffer",
    title: "Light Puffer",
    description: "Light puffer for moderate winter temperatures.",
    tags: ["tops", "unisex"],
    productType: "",
    availableForSale: true,
    priceMin: cad("80.0"),
    priceMax: cad("80.0"),
    options: [
      { name: "Size", values: ["Small", "Medium", "Large"] },
      { name: "Color", values: ["Green"] }
    ]
  },
  {
    id: "gid://shopify/Product/slides",
    handle: "slides",
    title: "Slides",
    description: "Summer slides.",
    tags: ["shoes", "accessories"],
    productType: "",
    availableForSale: true,
    priceMin: cad("25.0"),
    priceMax: cad("25.0"),
    options: [{ name: "Size", values: ["Small", "Medium"] }]
  },
  {
    id: "gid://shopify/Product/clay-hoodie",
    handle: "soft-cotton-hoodie-in-clay",
    title: "Soft Cotton Hoodie in Clay",
    description: "Sold out hoodie.",
    tags: ["tops"],
    productType: "",
    availableForSale: false,
    priceMin: cad("90.0"),
    priceMax: cad("90.0"),
    options: [{ name: "Size", values: ["Small"] }]
  }
];

export const hoodieDetail: ProductDetail = {
  ...catalog[0],
  images: [],
  variants: [
    {
      id: "gid://shopify/ProductVariant/green-medium",
      title: "Medium",
      availableForSale: true,
      quantityAvailable: 49,
      selectedOptions: [
        { name: "Color", value: "Green" },
        { name: "Size", value: "Medium" }
      ],
      price: cad("90.0")
    },
    {
      id: "gid://shopify/ProductVariant/green-small",
      title: "Small",
      availableForSale: true,
      quantityAvailable: 42,
      selectedOptions: [
        { name: "Color", value: "Green" },
        { name: "Size", value: "Small" }
      ],
      price: cad("90.0")
    },
    {
      id: "gid://shopify/ProductVariant/green-large",
      title: "Large",
      availableForSale: true,
      quantityAvailable: 10,
      selectedOptions: [
        { name: "Color", value: "Green" },
        { name: "Size", value: "Large" }
      ],
      price: cad("90.0")
    },
    {
      id: "gid://shopify/ProductVariant/clay-small",
      title: "Small",
      availableForSale: false,
      quantityAvailable: 0,
      selectedOptions: [
        { name: "Color", value: "Clay" },
        { name: "Size", value: "Small" }
      ],
      price: cad("90.0")
    },
    {
      id: "gid://shopify/ProductVariant/clay-medium",
      title: "Medium",
      availableForSale: true,
      quantityAvailable: 8,
      selectedOptions: [
        { name: "Color", value: "Clay" },
        { name: "Size", value: "Medium" }
      ],
      price: cad("90.0")
    }
  ]
};
