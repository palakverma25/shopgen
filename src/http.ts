import express from "express";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DemoAuthProvider } from "./auth/demoProvider.js";
import { handleCheckoutRequest } from "./checkout/page.js";
import { createShopServer } from "./server.js";
import { requestKey } from "./security/ratelimit.js";
import { readSessionId, shopContext } from "./session/context.js";
import { MemoryShopStore, processMemory } from "./session/memory.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const PUBLIC_URL = process.env.PUBLIC_URL;
const localOnly = HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";

const app = createMcpExpressApp({
  host: HOST,
  ...(localOnly ? { allowedHosts: ["127.0.0.1", "localhost", "[::1]"] } : {})
});

app.use(express.urlencoded({ extended: false }));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version, x-shop-session",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, x-shop-session"
};

app.use((_req, res, next) => {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

if (PUBLIC_URL?.startsWith("https://")) {
  const issuerUrl = new URL(PUBLIC_URL);
  app.use(
    mcpAuthRouter({
      provider: new DemoAuthProvider(),
      issuerUrl,
      baseUrl: issuerUrl,
      resourceServerUrl: new URL("/mcp", issuerUrl),
      scopesSupported: ["mcp:tools", "offline_access"],
      resourceName: "mock.shop shopping MCP",
      clientRegistrationOptions: {
        clientSecretExpirySeconds: 0,
        rateLimit: false
      }
    })
  );
  console.log(`OAuth discovery enabled at ${PUBLIC_URL}`);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mock-shop-mcp" });
});

app.get("/", (_req, res) => {
  res
    .type("text")
    .send("mock.shop MCP server. ChatGPT/Claude: POST /mcp");
});

app.all("/checkout", (req, res) => {
  void (async () => {
    const origin = `${req.protocol}://${req.get("host")}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
    }
    let body: string | undefined;
    if (req.method === "POST") {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries((req.body ?? {}) as Record<string, unknown>)) {
        params.set(key, String(value));
      }
      body = params.toString();
      headers.set("Content-Type", "application/x-www-form-urlencoded");
    }
    const response = await handleCheckoutRequest(
      new Request(new URL(req.originalUrl, origin), { method: req.method, headers, body })
    );
    res.status(response.status);
    res.type(response.headers.get("content-type") ?? "text/html; charset=utf-8");
    const location = response.headers.get("location");
    if (location) res.setHeader("Location", location);
    res.send(await response.text());
  })();
});

async function handleMcp(req: express.Request, res: express.Response) {
  const sessionId = readSessionId({ get: (name) => req.header(name) });
  const store = new MemoryShopStore(processMemory, sessionId, requestKey({ get: (name) => req.header(name) }));
  res.setHeader("mcp-session-id", sessionId);
  res.setHeader("x-shop-session", sessionId);

  if (!(await store.allow())) {
    res.status(429).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Too many requests. Try again in a minute." },
      id: null
    });
    return;
  }

  const server = createShopServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await shopContext.run({ sessionId, store }, () => transport.handleRequest(req, res, req.body));
  } catch (error) {
    console.error("MCP request failed", error instanceof Error ? error.message : error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  } finally {
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  }
}

app.post("/mcp", (req, res) => void handleMcp(req, res));
app.get("/mcp", (req, res) => void handleMcp(req, res));
app.delete("/mcp", (req, res) => void handleMcp(req, res));

app.listen(PORT, HOST, () => {
  console.log(`mock.shop MCP listening on http://${HOST}:${PORT}/mcp`);
});
