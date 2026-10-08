import { validateCartId } from "../commerce/cart.js";
import { redactCartId } from "../commerce/format.js";
import { fetchCart } from "../shopify/api.js";
import { shopify } from "../shopify/client.js";
import type { CartSnapshot } from "../types.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function optionLabel(size: string | null, color: string | null): string {
  return [color, size].filter(Boolean).join(" · ");
}

export function renderCheckoutHtml(input: {
  cart?: CartSnapshot;
  error?: string;
  placed?: boolean;
}): string {
  const { cart, error, placed } = input;
  const title = placed ? "Order confirmed" : "Checkout";
  const lines = cart?.lines ?? [];
  const empty = !cart || cart.total_quantity < 1;

  const body = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : placed && cart
      ? `<div class="banner ok">Mock order confirmed. Nothing was charged, and nothing will ship.</div>
        <p class="lead">Your confirmation total is <strong>${escapeHtml(cart.total ?? "")}</strong>.</p>
        ${renderLines(lines)}`
      : empty
        ? `<div class="banner">This is a mock checkout.</div>
          <p>Your cart is empty. Add something in chat and ask for checkout again.</p>`
        : `<div class="banner">This is a mock checkout. No payment is taken, nothing ships, and nothing you enter is saved.</div>
          ${renderLines(lines)}
          <div class="total">
            <span>Total</span>
            <strong>${escapeHtml(cart?.total ?? "")}</strong>
          </div>
          <form method="post">
            <input type="hidden" name="cart_id" value="${escapeHtml(cart?.cart_id ?? "")}" />
            <input type="hidden" name="action" value="place" />
            <button type="submit">Confirm mock order</button>
          </form>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Mock.shop</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #111; background: #fff; }
    main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
    h1 { font-size: 2.75rem; letter-spacing: -0.04em; margin: 0 0 1.25rem; }
    .banner, .error { background: #f3f3f3; border-radius: 1rem; padding: 1rem 1.15rem; line-height: 1.45; }
    .banner.ok { background: #ecfdf3; }
    .error { background: #fef2f2; }
    .lead { margin: 1.25rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    th { text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #666; padding-bottom: 0.6rem; }
    td { padding: 0.85rem 0; border-top: 1px solid #ececec; vertical-align: top; }
    td.qty, td.price { text-align: right; white-space: nowrap; }
    .muted { color: #666; font-size: 0.92rem; margin-top: 0.2rem; }
    .total { display: flex; justify-content: space-between; font-size: 1.15rem; margin: 0.5rem 0 1.5rem; }
    button { appearance: none; border: 0; background: #111; color: #fff; border-radius: 999px; padding: 0.85rem 1.3rem; font-size: 1rem; cursor: pointer; }
    .fine { margin-top: 2rem; color: #777; font-size: 0.85rem; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${body}
    <p class="fine">Mock.shop catalog via the shopping assistant. This page loads your cart from the store API — the Hydrogen <code>/checkout</code> URL is a dummy and does not include the cart.</p>
  </main>
</body>
</html>`;
}

function renderLines(lines: CartSnapshot["lines"]): string {
  if (!lines.length) return "";
  const rows = lines
    .map((line) => {
      const options = optionLabel(line.size, line.color);
      return `<tr>
        <td>
          <div>${escapeHtml(line.product)}</div>
          ${options ? `<div class="muted">${escapeHtml(options)} × ${escapeHtml(String(line.quantity))}</div>` : `<div class="muted">Qty ${escapeHtml(String(line.quantity))}</div>`}
        </td>
        <td class="price">${escapeHtml(line.line_total)}</td>
      </tr>`;
    })
    .join("");
  return `<table>
    <thead><tr><th>Item</th><th class="price">Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function readCartId(request: Request): Promise<{ cartId: string; placed: boolean }> {
  const url = new URL(request.url);
  let cartId = url.searchParams.get("cart_id") ?? "";
  let placed = url.searchParams.get("placed") === "1";

  if (request.method === "POST") {
    const form = await request.formData();
    cartId = String(form.get("cart_id") ?? cartId);
    placed = String(form.get("action") ?? "") === "place" || placed;
  }

  return { cartId, placed };
}

export async function handleCheckoutRequest(request: Request): Promise<Response> {
  const htmlHeaders = { "Content-Type": "text/html; charset=utf-8" };

  try {
    const { cartId, placed } = await readCartId(request);
    if (!cartId) {
      return new Response(
        renderCheckoutHtml({ error: "This checkout link is missing a cart. Ask the assistant for a new checkout link." }),
        { status: 400, headers: htmlHeaders }
      );
    }

    const id = validateCartId(cartId, true);
    const cart = await fetchCart(shopify, id);

    if (request.method === "POST" && placed) {
      const redirect = new URL(request.url);
      redirect.search = "";
      redirect.searchParams.set("cart_id", id);
      redirect.searchParams.set("placed", "1");
      return Response.redirect(redirect.toString(), 303);
    }

    if (cart.total_quantity < 1 && !placed) {
      return new Response(renderCheckoutHtml({ cart }), { status: 200, headers: htmlHeaders });
    }

    return new Response(renderCheckoutHtml({ cart, placed }), { status: 200, headers: htmlHeaders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/gid:\/\/shopify\/Cart\/[^\s]+/g, (id) => redactCartId(id))
        : "Could not load this checkout.";
    return new Response(renderCheckoutHtml({ error: message }), { status: 400, headers: htmlHeaders });
  }
}
