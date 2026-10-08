import { shopify } from "../src/shopify/client.js";
import { addToCartTool, applyDiscountTool, getProductTool, searchProductsTool } from "../src/tools.js";

async function main() {
  const search = await searchProductsTool(shopify, {
    query: "something warm for winter",
    max_price: 100,
    limit: 5
  });
  console.log("SEARCH", JSON.stringify(search, null, 2));

  const product = await getProductTool(shopify, {
    product: "hoodie",
    size: "Medium",
    color: "Green"
  });
  console.log("PRODUCT_FOCUS", JSON.stringify(product.requested_variant, null, 2));

  const cart = await addToCartTool(shopify, {
    product: "hoodie",
    size: "Medium",
    color: "Green",
    quantity: 1
  });
  console.log(
    "ADD",
    JSON.stringify(
      {
        ok: cart.ok,
        added: cart.added,
        total: cart.total,
        lines: cart.lines,
        cart_id_has_key: String(cart.cart_id ?? "").includes("?key=")
      },
      null,
      2
    )
  );

  const discount = await applyDiscountTool(shopify, {
    cart_id: String(cart.cart_id),
    code: "SAVE10"
  });
  console.log(
    "DISCOUNT",
    JSON.stringify({ ok: discount.ok, error: discount.error, total: discount.cart?.total ?? discount.total }, null, 2)
  );
}

void main();
