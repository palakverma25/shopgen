import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { handleCheckoutRequest } from "./checkout/page.js";
import { createShopServer } from "./server.js";
import { requestKey } from "./security/ratelimit.js";
import { readSessionId, shopContext } from "./session/context.js";
import { DurableShopStore, type DurableNamespace } from "./session/durable.js";
import { ShopState } from "./session/shopState.js";

export { ShopState };

type Env = {
  SHOP_STATE: DurableNamespace;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version, x-shop-session",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, x-shop-session"
};

function withCors(response: Response, sessionId?: string): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  if (sessionId) {
    headers.set("mcp-session-id", sessionId);
    headers.set("x-shop-session", sessionId);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health") {
      return withCors(Response.json({ ok: true, service: "mock-shop-mcp" }));
    }

    if (url.pathname === "/") {
      return withCors(
        new Response("mock.shop MCP server. Connect Claude to POST /mcp", {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        })
      );
    }

    if (url.pathname === "/checkout") {
      return withCors(await handleCheckoutRequest(request));
    }

    if (url.pathname !== "/mcp") {
      return withCors(new Response("Not found", { status: 404 }));
    }

    const sessionId = readSessionId(request.headers);
    const ip = requestKey(request.headers);
    const store = new DurableShopStore(env.SHOP_STATE, sessionId, ip);

    if (!(await store.allow())) {
      return withCors(
        Response.json(
          {
            jsonrpc: "2.0",
            error: { code: -32000, message: "Too many requests. Try again in a minute." },
            id: null
          },
          { status: 429 }
        ),
        sessionId
      );
    }

    const server = createShopServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await server.connect(transport);
    const response = await shopContext.run({ sessionId, store }, () => transport.handleRequest(request));
    return withCors(response, sessionId);
  }
};
