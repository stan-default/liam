import { createMcpHandler } from "mcp-handler";
import { withRequestCredentials, type RequestCredentials } from "@liads/core";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { registerTools } from "@liads/mcp/tools";

/**
 * Hosted MCP server at /api/mcp (Streamable HTTP). Two ways in:
 *
 * 1. Bring your own credentials (multi-tenant): send your LinkedIn developer
 *    app details as headers on every request — X-Liads-Client-Id,
 *    X-Liads-Client-Secret, X-Liads-Refresh-Token, plus optional
 *    X-Liads-Account-Id and X-Liads-Linkedin-Version. The request runs
 *    entirely against YOUR app and ad account; no shared secret needed, since
 *    the headers grant nothing beyond what the caller already owns.
 *    Credentials are used in-memory only and never logged or persisted.
 *
 * 2. Env tenant (the deploy owner): no X-Liads headers. Credentials come from
 *    LIADS_* env vars and access is gated by MCP_AUTH_TOKEN.
 */
const mcpHandler = createMcpHandler(
  // The adapter's server is the same MCP SDK type; cast across the version boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server) => registerTools(server as any),
  { serverInfo: { name: "liam", version: "0.1.0" } },
  { basePath: "/api" },
);

/** Caller-supplied credentials, when the request carries all three required headers. */
function headerCredentials(req: Request): RequestCredentials | null {
  const clientId = req.headers.get("x-liads-client-id");
  const clientSecret = req.headers.get("x-liads-client-secret");
  const refreshToken = req.headers.get("x-liads-refresh-token");
  if (!clientId || !clientSecret || !refreshToken) return null;
  return {
    clientId,
    clientSecret,
    refreshToken,
    defaultAccountId: req.headers.get("x-liads-account-id") ?? undefined,
    linkedinVersion: req.headers.get("x-liads-linkedin-version") ?? undefined,
  };
}

function authorized(req: Request): boolean {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) return true; // Unset = open. Always set MCP_AUTH_TOKEN in production.
  if (req.headers.get("authorization") === `Bearer ${token}`) return true;
  return new URL(req.url).searchParams.get("key") === token;
}

async function guard(req: Request): Promise<Response> {
  const creds = headerCredentials(req);
  if (creds) {
    return withRequestCredentials(creds, () => mcpHandler(req));
  }
  if (!authorized(req)) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        hint: "Send Authorization: Bearer <MCP_AUTH_TOKEN>, or bring your own LinkedIn app via X-Liads-Client-Id / X-Liads-Client-Secret / X-Liads-Refresh-Token headers (see the README).",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  return mcpHandler(req);
}

export { guard as GET, guard as POST, guard as DELETE };
