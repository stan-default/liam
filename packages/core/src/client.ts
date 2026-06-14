import { loadConfig } from "./config.js";
import { LinkedInClient, type TokenProvider } from "./http.js";
import { createTokenProvider } from "./auth.js";

export interface Liads {
  client: LinkedInClient;
  /** Returns a valid bearer token (used for image binary uploads). */
  getToken: TokenProvider;
}

/**
 * Builds a ready-to-use LinkedIn client: loads app config, wires the
 * auto-refreshing token provider. Throws a clear error if not yet authenticated.
 */
export async function createLiads(): Promise<Liads> {
  const config = await loadConfig();
  const getToken = await createTokenProvider();
  const client = new LinkedInClient(config, getToken);
  return { client, getToken };
}
