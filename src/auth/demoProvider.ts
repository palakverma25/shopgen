import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

type CodeRecord = {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
};

type TokenRecord = {
  clientId: string;
  scopes: string[];
  expiresAt: number;
  refreshOf?: string;
};

const ALLOWED_REDIRECT_HOSTS = new Set([
  "chatgpt.com",
  "www.chatgpt.com",
  "openai.com",
  "www.openai.com",
  "claude.ai",
  "claude.com",
  "localhost",
  "127.0.0.1"
]);

export class DemoClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string) {
    return this.clients.get(clientId);
  }

  async registerClient(client: OAuthClientInformationFull) {
    this.clients.set(client.client_id, client);
    return client;
  }
}

export class DemoAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new DemoClientsStore();
  private readonly codes = new Map<string, CodeRecord>();
  private readonly tokens = new Map<string, TokenRecord>();
  private readonly refreshTokens = new Map<string, string>();

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      res.status(400).send("Unregistered redirect_uri");
      return;
    }
    if (!redirectAllowed(params.redirectUri)) {
      res.status(400).send("Redirect host is not allowed");
      return;
    }

    const code = randomUUID();
    this.codes.set(code, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? ["mcp:tools"]
    });

    const target = new URL(params.redirectUri);
    target.searchParams.set("code", code);
    if (params.state) target.searchParams.set("state", params.state);
    res.redirect(target.toString());
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string) {
    const record = this.codes.get(authorizationCode);
    if (!record) throw new Error("Invalid authorization code");
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    const record = this.codes.get(authorizationCode);
    if (!record || record.clientId !== client.client_id) {
      throw new Error("Invalid authorization code");
    }
    if (redirectUri && redirectUri !== record.redirectUri) {
      throw new Error("redirect_uri mismatch");
    }
    this.codes.delete(authorizationCode);
    return this.issueTokens(record.clientId, record.scopes);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[]
  ): Promise<OAuthTokens> {
    const accessToken = this.refreshTokens.get(refreshToken);
    if (!accessToken) throw new Error("Invalid refresh token");
    const record = this.tokens.get(accessToken);
    if (!record || record.clientId !== client.client_id) {
      throw new Error("Invalid refresh token");
    }
    this.tokens.delete(accessToken);
    this.refreshTokens.delete(refreshToken);
    return this.issueTokens(record.clientId, scopes ?? record.scopes);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = this.tokens.get(token);
    if (!record || record.expiresAt < Date.now()) {
      throw new Error("Invalid or expired token");
    }
    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt / 1000)
    };
  }

  private issueTokens(clientId: string, scopes: string[]): OAuthTokens {
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    this.tokens.set(accessToken, {
      clientId,
      scopes,
      expiresAt: Date.now() + 60 * 60 * 1000
    });
    this.refreshTokens.set(refreshToken, accessToken);
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes.join(" ")
    };
  }
}

function redirectAllowed(uri: string): boolean {
  try {
    const host = new URL(uri).hostname;
    return ALLOWED_REDIRECT_HOSTS.has(host);
  } catch {
    return false;
  }
}
