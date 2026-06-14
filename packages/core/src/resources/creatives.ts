import type { LinkedInClient } from "../http.js";
import { campaignUrn, sponsoredAccountUrn } from "../urns.js";
import type { CreatedEntity } from "./campaignGroups.js";

/**
 * Creatives (ads) use LinkedIn's unified Creatives API. A creative's
 * `intendedStatus` is independent of its parent; we default to DRAFT so nothing
 * serves until explicitly activated.
 */

/** Create a creative that references an existing post (ugcPost/share/InMail urn). */
export async function createCreativeByReference(
  client: LinkedInClient,
  opts: {
    accountId: string;
    campaignId: string;
    contentReference: string; // urn:li:ugcPost:... | urn:li:share:...
    intendedStatus?: "DRAFT" | "ACTIVE" | "PAUSED";
    name?: string;
  },
): Promise<CreatedEntity> {
  const res = await client.request({
    method: "POST",
    path: `/adAccounts/${opts.accountId}/creatives`,
    body: {
      campaign: campaignUrn(opts.campaignId),
      intendedStatus: opts.intendedStatus ?? "DRAFT",
      content: { reference: opts.contentReference },
      ...(opts.name ? { name: opts.name } : {}),
    },
  });
  if (!res.restliId) throw new Error("Creative created but no id returned");
  return { id: res.restliId };
}

/**
 * Create a single-image Sponsored Content creative inline (post + creative in one
 * call). The post is created as Direct Sponsored Content owned by the org.
 */
export async function createInlineImageCreative(
  client: LinkedInClient,
  opts: {
    accountId: string;
    campaignId: string;
    organizationUrn: string;
    commentary: string;
    imageUrn: string;
    altText?: string;
    intendedStatus?: "DRAFT" | "ACTIVE" | "PAUSED";
    name?: string;
  },
): Promise<CreatedEntity> {
  const res = await client.request({
    method: "POST",
    path: `/adAccounts/${opts.accountId}/creatives`,
    query: { action: "createInline" },
    body: {
      creative: {
        campaign: campaignUrn(opts.campaignId),
        intendedStatus: opts.intendedStatus ?? "DRAFT",
        inlineContent: {
          post: {
            adContext: {
              dscAdAccount: sponsoredAccountUrn(opts.accountId),
              dscStatus: "ACTIVE",
            },
            author: opts.organizationUrn,
            commentary: opts.commentary,
            visibility: "PUBLIC",
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false,
            content: {
              media: { id: opts.imageUrn, ...(opts.altText ? { altText: opts.altText } : {}) },
            },
          },
        },
        ...(opts.name ? { name: opts.name } : {}),
      },
    },
  });
  if (!res.restliId) throw new Error("Creative created but no id returned");
  return { id: res.restliId };
}

/**
 * Legacy Text Ad creative (uses the `variables` shape per Campaign Management
 * getting-started). Text ads are a distinct campaign type from Sponsored Content.
 */
export async function createTextAdCreative(
  client: LinkedInClient,
  opts: {
    accountId: string;
    campaignId: string;
    title: string;
    text: string;
    clickUri: string;
    status?: "DRAFT" | "ACTIVE" | "PAUSED";
  },
): Promise<CreatedEntity> {
  const res = await client.request({
    method: "POST",
    path: `/adAccounts/${opts.accountId}/creatives`,
    body: {
      campaign: campaignUrn(opts.campaignId),
      intendedStatus: opts.status ?? "DRAFT",
      content: {
        textAd: { headline: opts.title, description: opts.text, landingPage: opts.clickUri },
      },
    },
  });
  if (!res.restliId) throw new Error("Creative created but no id returned");
  return { id: res.restliId };
}

export async function setCreativeStatus(
  client: LinkedInClient,
  accountId: string,
  creativeId: string,
  intendedStatus: "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED",
): Promise<void> {
  await client.request({
    method: "POST",
    path: `/adAccounts/${accountId}/creatives/${creativeId}`,
    headers: { "X-RestLi-Method": "PARTIAL_UPDATE" },
    body: { patch: { $set: { intendedStatus } } },
  });
}
