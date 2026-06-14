import type { LinkedInClient } from "../http.js";

export interface AdAccount {
  id: number;
  name: string;
  status: string;
  type: string;
  currency?: string;
}

/** Lists ad accounts the authenticated app/user can access. */
export async function listAdAccounts(client: LinkedInClient): Promise<AdAccount[]> {
  const res = await client.request<{ elements: AdAccount[] }>({
    path: "/adAccounts",
    query: { q: "search" },
  });
  return res.data.elements ?? [];
}

export async function getAdAccount(client: LinkedInClient, accountId: string): Promise<AdAccount> {
  const res = await client.request<AdAccount>({ path: `/adAccounts/${accountId}` });
  return res.data;
}
