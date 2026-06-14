/** Helpers to convert between numeric ids and LinkedIn URNs. */

const stripPrefix = (v: string) => (v.includes(":") ? v.split(":").pop()! : v);

export const sponsoredAccountUrn = (id: string) => `urn:li:sponsoredAccount:${stripPrefix(id)}`;
export const campaignGroupUrn = (id: string) => `urn:li:sponsoredCampaignGroup:${stripPrefix(id)}`;
export const campaignUrn = (id: string) => `urn:li:sponsoredCampaign:${stripPrefix(id)}`;
export const adSegmentUrn = (id: string) => `urn:li:adSegment:${stripPrefix(id)}`;

export const idFromUrn = (urn: string) => stripPrefix(urn);

/** Campaign Manager deep link for a campaign group, for human review. */
export const campaignManagerGroupLink = (accountId: string, groupId: string) =>
  `https://www.linkedin.com/campaignmanager/accounts/${stripPrefix(accountId)}/campaign-groups/${stripPrefix(groupId)}`;

export const campaignManagerCampaignLink = (accountId: string, campaignId: string) =>
  `https://www.linkedin.com/campaignmanager/accounts/${stripPrefix(accountId)}/campaigns/${stripPrefix(campaignId)}`;
