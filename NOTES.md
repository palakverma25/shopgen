# NOTES

## Tools

Ten tools. Reads and writes are split on purpose so the model isn't picking an action out of one giant cart tool.

- `search_products` — intent search, plus price / category / size / color / stock filters. Also pulls "under $100" out of the query if the model forgets `max_price`.
- `get_product` — description, prices with currency, full size/color matrix, stock.
- `compare_products` — 2–4 products side by side.
- `suggest_products` — Shopify `productRecommendations`, then shared tags if that's empty.
- `add_to_cart` — size and color required when those options exist. We resolve the variant and echo what was added. Several products go in `items[]` so they share one cart. Parallel adds in the same chat are serialized (Durable Object on the worker, mutex locally).
- `update_cart` — find a line by product+size+color or `line_id`. Fails if more than one line matches.
- `get_cart` — lines, totals, currency.
- `apply_discount` — success only if `applicable` is true and the total actually changed.
- `checkout` — returns a URL. No payment.
- `get_policy` — strips HTML, wraps copy in `<store_content>`.

`search_products` is the one that actually matters. mock.shop search is basically keyword match. `hoodie` is fine, `puffer hoodie` comes back empty, and "warm for winter" will not find puffers. So we load the 29-product catalog, expand a few intent words (`warm` / `winter` → hoodie, puffer, crewneck, beanie), score locally, then filter ourselves. Shopify search is only a boost if it happens to return something.

I wasted a bit of time assuming Shopify `search` / `products(query:)` would be enough. Multi-word queries are empty on this catalog, tag filters look ignored, collection facets are often empty. If this was just a thin GraphQL proxy it would fail the sample chat.

## API surprises

- Prices are CAD. "Under $100" means CA$100. A CA$90 hoodie is in range.
- Two products are both titled "Hoodie" (`hoodie` and `hoodie-old`). Have to go by handle, not title. Weird one: adding the Green Medium `hoodie` can come back on the cart as "Soft Cotton Hoodie in Green" — same size, color, price. We still echo what we added.
- Size and color live on variants. Cart lines need a variant GID. Product GID will not work.
- Cart IDs have `?key=` on them. If you drop the query string, mutations fail. That key is also why you can't just guess someone else's cart.
- `SAVE10` sometimes comes back with `applicable: false` and the same total. We treat that as a failed discount, not a success.
- Policy HTML has leftover template notes in it ("clarify to customers…"). That's why store text gets wrapped as data, not instructions.
- Checkout is fake. Nothing actually gets ordered.
- `cart.checkoutUrl` from mock.shop is `https://demostore.hydrogen.mock.shop/checkout` with no cart token. That Hydrogen page looks at its own cookie, so API carts always look empty. If the URL has no `/cart/c/` token or `key`, we send people to `/checkout?cart_id=` on this server instead, which loads the Storefront cart and shows the lines.
- Claude will happily shop the open web instead of this catalog. Happens if the connector is off for that chat, or if it starts interviewing ("what's your budget?", "sweater or hoodie?") and then answers from general knowledge — Carhartt, Champion, Uniqlo, etc. Those multiple-choice chips are Claude's shopping UI, not our tools. I put `openWorldHint: false` on the tools, banned outside retailers in the instructions, mapped "cheaper"/"budget" to under CA$100, and added a `shop` prompt. Still need a new chat with the connector actually toggled on. Easy tell: you should see a `search_products` call and CA$ prices. Interview chips or "Searched the web" means it never hit the store.

## Security

The model can add to a cart, so it can also mix two shoppers or follow junk sitting in a product description.

Prompt injection: descriptions and policies get HTML stripped and wrapped in `<store_content>`. Server instructions say that block is data, not commands.

Cart isolation: Shopify owns the cart. We only remember `cart_id` per MCP session (`mcp-session-id` / `x-shop-session`), not per IP. If you pass `cart_id` explicitly that wins. Missing / truncated / non-cart IDs get rejected. No list-carts tool. Logs drop the key.

Wrong variant: size and color are required. We resolve the variant. The model can't just say "add a hoodie".

Fake success: we check `userErrors`, stock, empty checkout, and discount `applicable` before returning `ok: true`.

The server only POSTs to `https://mock.shop/api`. Inputs are size-capped, Shopify calls time out at 10s, 60 req/min per IP (Durable Object on the worker so it isn't per-isolate). Bad JSON shouldn't take the process down.

Checkout is a link. No payment.

No auth — it's a public demo catalog. Real shop you'd want OAuth or a connector header, per-shop tokens, audit logs. Nothing secret in the repo.

## Next

If I had more than ~5 hours: product cards with images (MCP Apps), embeddings instead of the synonym list, ChatGPT OAuth on the worker, a real-store adapter behind env vars, and a couple more live tests against cart mutations.

## How I used AI

Cursor helped scaffold the MCP server, the Shopify client, and first-pass tests. I didn't take its word on the store API — I poked `https://mock.shop/api` myself before locking search and carts.

Biggest miss: it treated Shopify `search` like it understands buyer intent and wanted to pass "warm winter hoodie under 100" straight through. Live, `search("puffer hoodie")` is zero products. Local catalog scoring is what actually works; Shopify search is just a keyword boost.

Video: https://www.loom.com/share/3a0dc465fe6445ca8ace41b980da896e
