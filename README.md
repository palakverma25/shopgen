# mock.shop MCP server

Remote MCP server for Shopify's demo catalog at [https://mock.shop/api](https://mock.shop/api). Search, compare, cart, discount, checkout link.

Public URL: [https://shopgen-mcp.shopgen.workers.dev/mcp](https://shopgen-mcp.shopgen.workers.dev/mcp)

## Local

Node 20+.

```bash
npm install
npm start
```

- MCP: http://127.0.0.1:3000/mcp
- Health: http://127.0.0.1:3000/health

```bash
npm test
```

`HOST=0.0.0.0 PORT=3000 npm start` if you need a tunnel.

## Claude

Free Desktop Version or Paid plan. Add a custom connector pointing at `/mcp`.

Settings showing Connected is not enough — in a **new chat**, click **+ → Connectors** and turn **mock.shop** on for that conversation. Then: `I need something warm for winter, under $100.`

You should see a `search_products` call and CA$ prices. If Claude starts interviewing you or searching the web, the connector isn't on for that chat. More on this in [NOTES.md](NOTES.md).

## ChatGPT

Plus / Pro / Team / Enterprise. Developer mode on, then Settings → Connectors → Create.

- Name: `mock.shop`
- URL: `https://<host>/mcp`
- Auth: none (OAuth demo login if it insists)

New chat, enable the connector, same prompt as above.

## Deploy

```bash
npx wrangler login
npm run deploy
```

## Tools

| Tool | |
|---|---|
| `search_products` | intent + price / size / color / stock filters |
| `get_product` | variants, prices, stock |
| `compare_products` | 2–4 products |
| `suggest_products` | similar items |
| `add_to_cart` | size and color when those options exist |
| `update_cart` | qty or remove |
| `get_cart` | lines and totals |
| `apply_discount` | fails if the code does not apply |
| `checkout` | link only, no payment |
| `get_policy` | returns / shipping / privacy |

Cart ids include `?key=`. Don't strip it.

Design notes: [NOTES.md](NOTES.md). 
