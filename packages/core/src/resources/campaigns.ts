import type { LinkedInClient } from "../http.js";
import type { CampaignInput } from "../schemas.js";
import { sponsoredAccountUrn, campaignGroupUrn } from "../urns.js";
import { buildTargetingCriteria, geoSegmentSpec } from "./targeting.js";
import { associateCampaignWithConversion } from "./conversions.js";
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
  // Targeting precedence: explicit raw criteria > structured spec > geo/segment shorthand.
  const targetingCriteria =
    input.targetingCriteria ??
    buildTargetingCriteria(
      input.targeting ?? geoSegmentSpec(input.geoUrns, input.audienceSegmentUrn),
    );

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
    // Hard rule: never enable Audience Expansion or the LinkedIn Audience
    // Network. Both are forced off on every ad set we create — they spend
    // budget on low-quality, off-target reach. Not configurable on purpose.
    audienceExpansionEnabled: false,
    offsiteDeliveryEnabled: false,
    politicalIntent: input.politicalIntent ?? "NOT_POLITICAL",
  };
  if (input.objectiveType) body.objectiveType = input.objectiveType;
  if (input.dailyBudget) body.dailyBudget = input.dailyBudget;
  if (input.totalBudget) body.totalBudget = input.totalBudget;
  if (input.unitCost) body.unitCost = input.unitCost;

  const res = await client.request({
    method: "POST",
    path: `/adAccounts/${input.accountId}/adCampaigns`,
    body,
  });
  if (!res.restliId) throw new Error("Campaign created but no id returned");

  // Select existing conversions (e.g. an insight tag) for this campaign.
  for (const conversionId of input.conversionIds ?? []) {
    await associateCampaignWithConversion(client, input.accountId, conversionId, res.restliId);
  }
  return { id: res.restliId };
}

export async function getCampaign(client: LinkedInClient, accountId: string, campaignId: string) {
  const res = await client.request({ path: `/adAccounts/${accountId}/adCampaigns/${campaignId}` });
  return res.data;
}

/** Change a campaign's status (e.g. archive cleanup). */
export async function setCampaignStatus(
  client: LinkedInClient,
  accountId: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED",
): Promise<void> {
  await client.request({
    method: "POST",
    path: `/adAccounts/${accountId}/adCampaigns/${campaignId}`,
    headers: { "X-RestLi-Method": "PARTIAL_UPDATE" },
    body: { patch: { $set: { status } } },
  });
}
