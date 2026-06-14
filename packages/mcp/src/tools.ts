import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createLiads,
  listAdAccounts,
  estimateAudienceByGeo,
  MIN_AUDIENCE_TO_SERVE,
  uploadAudienceFromCsv,
  getDmpSegment,
  createCampaignGroup,
  createCampaign,
  createTextAdCreative,
  createSponsoredImageDraft,
  launchFromBrief,
  CampaignGroupInputSchema,
  CampaignInputSchema,
  TextAdCreativeSchema,
  SponsoredImageCreativeSchema,
  AudienceUploadSchema,
  LaunchFromBriefSchema,
} from "@liads/core";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
});

/**
 * Registers every LinkedIn ads tool on an MCP server. Shared by the local stdio
 * entry point and the hosted (Vercel) HTTP handler so both expose the same surface.
 */
export function registerTools(server: McpServer): void {
  server.tool("list_ad_accounts", "List LinkedIn ad accounts this app can access.", {}, async () => {
    try {
      const liads = await createLiads();
      return ok(await listAdAccounts(liads.client));
    } catch (e) {
      return fail(e);
    }
  });

  server.tool(
    "estimate_audience",
    "Estimate audience size for a set of geo URNs. A campaign needs >=300 members to serve.",
    { geoUrns: z.array(z.string()).describe("urn:li:geo:... locations") },
    async ({ geoUrns }) => {
      try {
        const liads = await createLiads();
        const total = await estimateAudienceByGeo(liads.client, geoUrns);
        return ok({ total, canServe: total >= MIN_AUDIENCE_TO_SERVE, minimum: MIN_AUDIENCE_TO_SERVE });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "upload_audience_csv",
    "Upload a CSV of emails as a matched-audience DMP segment (SHA256-hashed). Requires the Audiences product. Matching takes up to 48h.",
    AudienceUploadSchema.shape,
    async (args) => {
      try {
        const liads = await createLiads();
        return ok(await uploadAudienceFromCsv(liads.client, liads.getToken, AudienceUploadSchema.parse(args)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "get_audience_status",
    "Check a DMP segment's matching status and resolved size.",
    { segmentId: z.string() },
    async ({ segmentId }) => {
      try {
        const liads = await createLiads();
        return ok(await getDmpSegment(liads.client, segmentId));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "create_campaign_group",
    "Create a campaign group (the top-level 'campaign'). Defaults to DRAFT.",
    CampaignGroupInputSchema.shape,
    async (args) => {
      try {
        const liads = await createLiads();
        return ok(await createCampaignGroup(liads.client, CampaignGroupInputSchema.parse(args)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "create_campaign",
    "Create a campaign (the 'ad group') with targeting, budget, bid, schedule. Defaults to DRAFT.",
    CampaignInputSchema.shape,
    async (args) => {
      try {
        const liads = await createLiads();
        return ok(await createCampaign(liads.client, CampaignInputSchema.parse(args)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "create_text_ad",
    "Create a Text Ad creative (DRAFT by default).",
    TextAdCreativeSchema.shape,
    async (args) => {
      try {
        const liads = await createLiads();
        return ok(await createTextAdCreative(liads.client, TextAdCreativeSchema.parse(args)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "create_image_ad",
    "Create a single-image Sponsored Content creative (DRAFT). Omit imagePath to leave the campaign ready for an image later.",
    SponsoredImageCreativeSchema.shape,
    async (args) => {
      try {
        const liads = await createLiads();
        const input = SponsoredImageCreativeSchema.parse(args);
        return ok(await createSponsoredImageDraft(liads.client, liads.getToken, input));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.tool(
    "launch_from_brief",
    "End-to-end: optional audience upload -> campaign group -> campaign -> draft creatives. Everything DRAFT. Returns Campaign Manager review links.",
    LaunchFromBriefSchema.shape,
    async (args) => {
      try {
        const liads = await createLiads();
        return ok(await launchFromBrief(liads, LaunchFromBriefSchema.parse(args)));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
