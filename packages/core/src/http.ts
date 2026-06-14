import { type AppConfig, linkedinVersion } from "./config.js";

export const LINKEDIN_REST_BASE = "https://api.linkedin.com/rest";

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly serviceErrorCode?: number,
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Path relative to the REST base, e.g. "/adAccounts". */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Extra headers (merged over defaults). */
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  /** Value of the x-restli-id response header (the created entity id), when present. */
  restliId?: string;
  headers: Headers;
}

/** Supplies a valid (auto-refreshed) bearer token. Implemented in auth.ts. */
export type TokenProvider = () => Promise<string>;

const MAX_RETRIES = 4;

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(LINKEDIN_REST_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The one place every LinkedIn REST call flows through. Injects the versioned
 * headers, the bearer token, parses x-restli-id, and retries on 429 / 5xx.
 */
export class LinkedInClient {
  constructor(
    private readonly config: AppConfig,
    private readonly getToken: TokenProvider,
  ) {}

  async request<T = unknown>(opts: RequestOptions): Promise<ApiResponse<T>> {
    const url = buildUrl(opts.path, opts.query);
    const method = opts.method ?? "GET";

    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.getToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": linkedinVersion(this.config),
        "X-Restli-Protocol-Version": "2.0.0",
        ...opts.headers,
      };
      let bodyStr: string | undefined;
      if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
        bodyStr = JSON.stringify(opts.body);
      }

      let res: Response;
      try {
        res = await fetch(url, { method, headers, body: bodyStr });
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 500);
          continue;
        }
        throw err;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
        continue;
      }

      const text = await res.text();
      const data = text ? safeJson(text) : undefined;

      if (!res.ok) {
        const serviceErrorCode =
          data && typeof data === "object" && "serviceErrorCode" in data
            ? Number((data as Record<string, unknown>).serviceErrorCode)
            : undefined;
        const message =
          (data && typeof data === "object" && "message" in data
            ? String((data as Record<string, unknown>).message)
            : text) || `LinkedIn API ${res.status}`;
        throw new LinkedInApiError(message, res.status, data ?? text, serviceErrorCode);
      }

      return {
        data: data as T,
        status: res.status,
        restliId: res.headers.get("x-restli-id") ?? undefined,
        headers: res.headers,
      };
    }
    throw lastErr instanceof Error ? lastErr : new Error("Request failed");
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
