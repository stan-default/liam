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

/** Change a campaign group's status (e.g. archive cleanup). */
export async function setCampaignGroupStatus(
  client: LinkedInClient,
  accountId: string,
  groupId: string,
  status: "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED",
): Promise<void> {
  await client.request({
    method: "POST",
    path: `/adAccounts/${accountId}/adCampaignGroups/${groupId}`,
    headers: { "X-RestLi-Method": "PARTIAL_UPDATE" },
    body: { patch: { $set: { status } } },
  });
}
