import type { LinkedInClient } from "../http.js";
import type { CampaignInput } from "../schemas.js";
import { sponsoredAccountUrn, campaignGroupUrn } from "../urns.js";
import { buildTargetingCriteria, geoSegmentSpec, withDefaultExclusions } from "./targeting.js";
import { associateCampaignWithConversion, resolveConversionIdByName } from "./conversions.js";
import { loadConfig } from "../config.js";
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
  const baseCriteria =
    input.targetingCriteria ??
    buildTargetingCriteria(
      input.targeting ?? geoSegmentSpec(input.geoUrns, input.audienceSegmentUrn),
    );
  // Standing rule: apply default audience exclusions unless explicitly opted out.
  const targetingCriteria =
    (input.applyDefaultExclusions ?? true) ? withDefaultExclusions(baseCriteria) : baseCriteria;

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

  // Conversions: use explicit ids if given, otherwise fall back to the account's
  // default conversion (config.defaultConversionName) unless opted out.
  let conversionIds = input.conversionIds ?? [];
  if (conversionIds.length === 0 && (input.applyDefaultConversion ?? true)) {
    const name = (await loadConfig()).defaultConversionName;
    if (name) {
      const id = await resolveConversionIdByName(client, input.accountId, name);
      if (id) conversionIds = [id];
    }
  }
  // Select existing conversions (e.g. an insight tag) for this campaign.
  for (const conversionId of conversionIds) {
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
