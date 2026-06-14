import type { LinkedInClient } from "../http.js";
import type { CampaignGroupInput } from "../schemas.js";
import { sponsoredAccountUrn } from "../urns.js";

export interface CreatedEntity {
  id: string;
}

/**
 * Creates a campaign group ("campaign" in common parlance). Defaults to DRAFT
 * so nothing serves until explicitly activated. Returns the new numeric id.
 */
export async function createCampaignGroup(
  client: LinkedInClient,
  input: CampaignGroupInput,
): Promise<CreatedEntity> {
  const body: Record<string, unknown> = {
    account: sponsoredAccountUrn(input.accountId),
    name: input.name,
    status: input.status,
  };
  if (input.totalBudget) body.totalBudget = input.totalBudget;
  if (input.runSchedule) body.runSchedule = input.runSchedule;

  const res = await client.request({
    method: "POST",
    path: `/adAccounts/${input.accountId}/adCampaignGroups`,
    body,
  });
  if (!res.restliId) throw new Error("Campaign group created but no id returned");
  return { id: res.restliId };
}

export async function getCampaignGroup(client: LinkedInClient, accountId: string, groupId: string) {
  const res = await client.request({
    path: `/adAccounts/${accountId}/adCampaignGroups/${groupId}`,
  });
  return res.data;
}
