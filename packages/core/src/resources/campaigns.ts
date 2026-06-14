import type { LinkedInClient } from "../http.js";
import type { CampaignInput } from "../schemas.js";
import { sponsoredAccountUrn, campaignGroupUrn } from "../urns.js";
import { buildTargetingCriteria } from "./targeting.js";
import type { CreatedEntity } from "./campaignGroups.js";

/**
 * Creates a campaign ("ad group" in common parlance) — this is where targeting,
 * budget, bid, and schedule live. Defaults to DRAFT. Targeting comes from an
 * explicit targetingCriteria, or is built from geoUrns + audienceSegmentUrn.
 */
export async function createCampaign(
  client: LinkedInClient,
  input: CampaignInput,
): Promise<CreatedEntity> {
  const targetingCriteria =
    input.targetingCriteria ??
    buildTargetingCriteria({ geoUrns: input.geoUrns, audienceSegmentUrn: input.audienceSegmentUrn });

  const body: Record<string, unknown> = {
    account: sponsoredAccountUrn(input.accountId),
    campaignGroup: campaignGroupUrn(input.campaignGroupId),
    name: input.name,
    type: input.type,
    costType: input.costType,
    locale: input.locale,
    runSchedule: input.runSchedule,
    status: input.status,
    targetingCriteria,
  };
  if (input.dailyBudget) body.dailyBudget = input.dailyBudget;
  if (input.totalBudget) body.totalBudget = input.totalBudget;
  if (input.unitCost) body.unitCost = input.unitCost;

  const res = await client.request({
    method: "POST",
    path: `/adAccounts/${input.accountId}/adCampaigns`,
    body,
  });
  if (!res.restliId) throw new Error("Campaign created but no id returned");
  return { id: res.restliId };
}

export async function getCampaign(client: LinkedInClient, accountId: string, campaignId: string) {
  const res = await client.request({ path: `/adAccounts/${accountId}/adCampaigns/${campaignId}` });
  return res.data;
}
