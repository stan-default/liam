import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import open from "open";
import {
  type AppConfig,
  type StoredCredentials,
  type CredentialStore,
  OAUTH_REDIRECT_URI,
  loadConfig,
  FileCredentialStore,
  resolveCredentialStore,
} from "./config.js";
import type { TokenProvider } from "./http.js";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

/** Scopes for ad management. r_ads_reporting is for Phase 2 analytics. rw_conversions is for the Conversions API. */
export const DEFAULT_SCOPES = ["rw_ads", "r_ads_reporting", "rw_conversions"];

const CALLBACK_PORT = 53682;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

function toCredentials(t: TokenResponse): StoredCredentials {
  const now = Date.now();
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: now + t.expires_in * 1000,
    refreshExpiresAt: t.refresh_token_expires_in ? now + t.refresh_token_expires_in * 1000 : undefined,
    scope: t.scope,
  };
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as TokenResponse;
}

/**
 * Interactive 3-legged OAuth: spins a localhost callback server, opens the
 * browser to the consent screen, captures the code, exchanges it, and persists
 * tokens to ~/.liads/credentials.json. Returns the granted scopes.
 */
export async function login(scopes: string[] = DEFAULT_SCOPES): Promise<StoredCredentials> {
  const config = await loadConfig();
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scopes.join(" "));

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404).end();
        return;
      }
      const url = new URL(req.url, OAUTH_REDIRECT_URI);
      const returnedState = url.searchParams.get("state");
      const returnedCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      if (error) {
        res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }
      if (returnedState !== state) {
        res.end("<h2>State mismatch — possible CSRF. Aborted.</h2>");
        server.close();
        reject(new Error("OAuth state mismatch"));
        return;
      }
      res.end("<h2>LinkedIn connected.</h2><p>You can close this tab and return to the terminal.</p>");
      server.close();
      resolve(returnedCode!);
    });
    server.on("error", reject);
    server.listen(CALLBACK_PORT, () => {
      void open(authUrl.toString());
    });
  });

  const tokens = await postToken({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: OAUTH_REDIRECT_URI,
  });
  const creds = toCredentials(tokens);
  // Login is always interactive/local, so persist to the file store.
  await new FileCredentialStore().save(creds);
  return creds;
}

async function refresh(
  config: AppConfig,
  refreshToken: string,
  store: CredentialStore,
): Promise<StoredCredentials> {
  const tokens = await postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  // LinkedIn may not echo the refresh token back; keep the existing one.
  const creds = toCredentials(tokens);
  if (!creds.refreshToken) creds.refreshToken = refreshToken;
  await store.save(creds);
  return creds;
}

/**
 * Returns the environment variables needed to run the hosted MCP server, read
 * from the local login. Paste these into Vercel project settings. The refresh
 * token is long-lived (~365d); the server derives access tokens from it.
 */
export async function exportHostedEnv(): Promise<Record<string, string>> {
  const config = await loadConfig();
  const creds = await new FileCredentialStore().load();
  if (!creds?.refreshToken) {
    throw new Error("No refresh token found. Run `liam auth login` first.");
  }
  return {
    LIADS_CLIENT_ID: config.clientId,
    LIADS_CLIENT_SECRET: config.clientSecret,
    LIADS_LINKEDIN_VERSION: config.linkedinVersion ?? "",
    LIADS_REFRESH_TOKEN: creds.refreshToken,
  };
}

/** Refresh if the access token expires within this window (ms). */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Returns a TokenProvider for the HTTP client: loads stored creds (from env or
 * file), refreshes them when near expiry, and surfaces a clear error if
 * re-login is required.
 */
export async function createTokenProvider(store: CredentialStore = resolveCredentialStore()): Promise<TokenProvider> {
  const config = await loadConfig();
  let creds = await store.load();
  if (!creds) {
    throw new Error(
      "Not authenticated. Run `liam auth login` (local) or set LIADS_REFRESH_TOKEN (hosted).",
    );
  }

  return async () => {
    if (creds!.accessToken && Date.now() < creds!.expiresAt - REFRESH_SKEW_MS) {
      return creds!.accessToken;
    }
    if (creds!.refreshToken && (!creds!.refreshExpiresAt || Date.now() < creds!.refreshExpiresAt)) {
      creds = await refresh(config, creds!.refreshToken, store);
      return creds.accessToken;
    }
    throw new Error("Access token expired and no valid refresh token. Run `liam auth login` again.");
  };
}
