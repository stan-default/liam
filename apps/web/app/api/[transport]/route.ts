import { createMcpHandler } from "mcp-handler";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { registerTools } from "@liads/mcp/tools";

/**
 * Hosted (single-tenant) MCP server. The MCP endpoint is /api/mcp (Streamable
 * HTTP). LinkedIn credentials come from env (LIADS_CLIENT_ID/SECRET +
 * LIADS_REFRESH_TOKEN) via @liads/core's config layer. Access is gated by a
 * shared secret so only you can drive your ad account.
 */
const mcpHandler = createMcpHandler(
  // The adapter's server is the same MCP SDK type; cast across the version boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server) => registerTools(server as any),
  {},
  { basePath: "/api" },
);

function authorized(req: Request): boolean {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) return true; // Unset = open. Always set MCP_AUTH_TOKEN in production.
  if (req.headers.get("authorization") === `Bearer ${token}`) return true;
  return new URL(req.url).searchParams.get("key") === token;
}

async function guard(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return mcpHandler(req);
}

export { guard as GET, guard as POST, guard as DELETE };
