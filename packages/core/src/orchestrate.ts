import type { Liads } from "./client.js";
import type { LaunchFromBriefInput } from "./schemas.js";
import { uploadAudienceFromCsv } from "./audience.js";
import { createCampaignGroup } from "./resources/campaignGroups.js";
import { createCampaign } from "./resources/campaigns.js";
import { createTextAdCreative } from "./resources/creatives.js";
import { createSponsoredImageDraft } from "./creative.js";
import { estimateAudienceByGeo, MIN_AUDIENCE_TO_SERVE } from "./resources/targeting.js";
import { campaignManagerGroupLink, campaignManagerCampaignLink } from "./urns.js";

export interface LaunchResult {
  campaignGroupId: string;
  campaignId: string;
  audienceSegmentUrn?: string;
  creativeIds: string[];
  warnings: string[];
  links: { campaignGroup: string; campaign: string };
}

/**
 * One call: optional audience upload -> campaign group -> campaign -> draft
 * creatives. Everything is created DRAFT/PAUSED. Returns Campaign Manager links
 * for human review before anything is activated.
 */
export async function launchFromBrief(
  liads: Liads,
  input: LaunchFromBriefInput,
): Promise<LaunchResult> {
  const { client, getToken } = liads;
  const warnings: string[] = [];

  // 1. Audience (optional, requires Audiences/DMP product).
  let audienceSegmentUrn: string | undefined;
  if (input.audience) {
    const result = await uploadAudienceFromCsv(client, { ...input.audience, accountId: input.accountId });
    audienceSegmentUrn = result.adSegmentUrn;
    warnings.push(...result.warnings);
    warnings.push(
      `Audience "${input.audience.name}" created with ${result.uploaded} hashed emails. Matching takes up to 48h before the campaign can serve.`,
    );
  } else {
    // No matched audience -> targeting is geo-only; sanity-check it can serve.
    try {
      const size = await estimateAudienceByGeo(client, input.geoUrns);
      if (size < MIN_AUDIENCE_TO_SERVE) {
        warnings.push(`Estimated geo audience is ${size}, below the ${MIN_AUDIENCE_TO_SERVE} minimum to serve.`);
      }
    } catch {
      // Estimate is best-effort; don't block the launch on it.
    }
  }

  // 2. Campaign group (DRAFT).
  const group = await createCampaignGroup(client, {
    accountId: input.accountId,
    name: input.campaignGroupName,
    status: "DRAFT",
    totalBudget: undefined,
  });

  // 3. Campaign (DRAFT) — targeting, budget, bid live here.
  const campaign = await createCampaign(client, {
    accountId: input.accountId,
    campaignGroupId: group.id,
    name: input.campaignName,
    type: input.type,
    costType: "CPM",
    dailyBudget: input.dailyBudget,
    unitCost: input.bid,
    locale: { country: "US", language: "en" },
    runSchedule: input.runSchedule,
    status: "DRAFT",
    geoUrns: input.geoUrns,
    audienceSegmentUrn,
  });

  // 4. Draft creatives.
  const creativeIds: string[] = [];
  for (const c of input.creatives ?? []) {
    if ("organizationUrn" in c) {
      const draft = await createSponsoredImageDraft(client, getToken, {
        ...c,
        accountId: input.accountId,
        campaignId: campaign.id,
      });
      if (draft.creativeId) creativeIds.push(draft.creativeId);
      if (draft.note) warnings.push(draft.note);
    } else {
      const draft = await createTextAdCreative(client, {
        ...c,
        accountId: input.accountId,
        campaignId: campaign.id,
        status: "DRAFT",
      });
      creativeIds.push(draft.id);
    }
  }

  return {
    campaignGroupId: group.id,
    campaignId: campaign.id,
    audienceSegmentUrn,
    creativeIds,
    warnings,
    links: {
      campaignGroup: campaignManagerGroupLink(input.accountId, group.id),
      campaign: campaignManagerCampaignLink(input.accountId, campaign.id),
    },
  };
}
