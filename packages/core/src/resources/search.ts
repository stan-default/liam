import type { LinkedInClient } from "../http.js";

/**
 * Drain a q=search finder that uses token pagination. LinkedIn's adAccounts
 * sub-resources (adCampaignGroups, adCampaigns, ...) page via
 * `metadata.nextPageToken` + `pageToken=` — the classic `start=` offset param
 * is silently ignored and returns the same first page forever.
 */
export async function searchAll<T = Record<string, unknown>>(
  client: LinkedInClient,
  path: string,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 300;
  const maxPages = opts.maxPages ?? 50;
  const all: T[] = [];
  let token: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const rawQuery = `q=search&pageSize=${pageSize}` + (token ? `&pageToken=${token}` : "");
    const res = await client.request({ path, rawQuery });
    const data = res.data as { elements?: T[]; metadata?: { nextPageToken?: string } };
    all.push(...(data.elements ?? []));
    token = data.metadata?.nextPageToken;
    if (!token) break;
  }
  return all;
}
