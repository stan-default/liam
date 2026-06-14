import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";

/** Directory holding app credentials + OAuth tokens for local use. Never in the repo. */
export const LIADS_DIR = join(homedir(), ".liads");
const CONFIG_PATH = join(LIADS_DIR, "config.json");
const CREDENTIALS_PATH = join(LIADS_DIR, "credentials.json");

/** Default LinkedIn API version (YYYYMM). Pinned; bump deliberately. */
export const DEFAULT_LINKEDIN_VERSION = "202605";

/** OAuth callback the local login server listens on. Must match the app's redirect URL. */
export const OAUTH_REDIRECT_URI = "http://localhost:53682/callback";

export interface AppConfig {
  clientId: string;
  clientSecret: string;
  /** YYYYMM. Falls back to DEFAULT_LINKEDIN_VERSION. */
  linkedinVersion?: string;
  /** Numeric ad account id used when a command/brief omits one. */
  defaultAccountId?: string;
}

export interface StoredCredentials {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  /** Epoch ms when the refresh token expires, if known. */
  refreshExpiresAt?: number;
  scope?: string;
}

/**
 * Loads app config. Prefers environment variables (hosted / Vercel), falls back
 * to ~/.liads/config.json (local CLI and self-host).
 */
export async function loadConfig(): Promise<AppConfig> {
  if (process.env.LIADS_CLIENT_ID && process.env.LIADS_CLIENT_SECRET) {
    return {
      clientId: process.env.LIADS_CLIENT_ID,
      clientSecret: process.env.LIADS_CLIENT_SECRET,
      linkedinVersion: process.env.LIADS_LINKEDIN_VERSION,
      defaultAccountId: process.env.LIADS_DEFAULT_ACCOUNT_ID,
    };
  }
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf8");
  } catch {
    throw new Error(
      `No credentials. Set LIADS_CLIENT_ID/LIADS_CLIENT_SECRET env vars, or create ${CONFIG_PATH} with { "clientId", "clientSecret", "linkedinVersion" }.`,
    );
  }
  const parsed = JSON.parse(raw) as AppConfig;
  if (!parsed.clientId || !parsed.clientSecret) {
    throw new Error(`${CONFIG_PATH} must include clientId and clientSecret.`);
  }
  return parsed;
}

export function linkedinVersion(config: AppConfig): string {
  return config.linkedinVersion ?? DEFAULT_LINKEDIN_VERSION;
}

/** Resolves the default ad account id from config, or throws if none is set. */
export async function requireDefaultAccountId(): Promise<string> {
  const { defaultAccountId } = await loadConfig();
  if (!defaultAccountId) {
    throw new Error("No account id provided and no defaultAccountId in config.");
  }
  return defaultAccountId;
}

/**
 * Abstraction over where OAuth tokens live, so the same auth logic serves the
 * local CLI (file-backed) and the hosted server (env-seeded, memory-backed).
 */
export interface CredentialStore {
  load(): Promise<StoredCredentials | null>;
  save(creds: StoredCredentials): Promise<void>;
}

/** Local file store at ~/.liads/credentials.json (mode 0600). */
export class FileCredentialStore implements CredentialStore {
  async load(): Promise<StoredCredentials | null> {
    try {
      return JSON.parse(await readFile(CREDENTIALS_PATH, "utf8")) as StoredCredentials;
    } catch {
      return null;
    }
  }
  async save(creds: StoredCredentials): Promise<void> {
    await mkdir(LIADS_DIR, { recursive: true });
    await writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  }
}

/**
 * Hosted store: seeds from LIADS_REFRESH_TOKEN (long-lived, ~365d). The access
 * token is derived at runtime and cached in memory only, so the server stays
 * stateless and no token is persisted back to the environment.
 */
export class EnvCredentialStore implements CredentialStore {
  private memory: StoredCredentials | null = null;
  constructor(private readonly refreshToken: string) {}
  async load(): Promise<StoredCredentials | null> {
    if (this.memory) return this.memory;
    // Expired access token forces an immediate refresh from the seed refresh token.
    return { accessToken: "", refreshToken: this.refreshToken, expiresAt: 0 };
  }
  async save(creds: StoredCredentials): Promise<void> {
    this.memory = creds;
  }
}

/** Picks the env store when a refresh token is provided, else the file store. */
export function resolveCredentialStore(): CredentialStore {
  if (process.env.LIADS_REFRESH_TOKEN) {
    return new EnvCredentialStore(process.env.LIADS_REFRESH_TOKEN);
  }
  return new FileCredentialStore();
}
