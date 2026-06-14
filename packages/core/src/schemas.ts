import { z } from "zod";

/** A money value as LinkedIn expects it. */
export const MoneySchema = z.object({
  amount: z.string().describe("Decimal string, e.g. '100.00'"),
  currencyCode: z.string().length(3).default("USD"),
});

export const RunScheduleSchema = z.object({
  /** Epoch ms. */
  start: z.number().int().positive(),
  /** Epoch ms. Omit for an open-ended schedule. */
  end: z.number().int().positive().optional(),
});

export const CampaignGroupInputSchema = z.object({
  accountId: z.string().describe("Numeric ad account id (no urn prefix)"),
  name: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
  totalBudget: MoneySchema.optional(),
  runSchedule: RunScheduleSchema.optional(),
});
export type CampaignGroupInput = z.infer<typeof CampaignGroupInputSchema>;

/** Supported campaign (ad group) formats we handle today. */
export const CampaignTypeSchema = z.enum([
  "SPONSORED_UPDATES",
  "TEXT_AD",
  "SPONSORED_INMAILS",
]);

export const CampaignInputSchema = z.object({
  accountId: z.string(),
  campaignGroupId: z.string().describe("Numeric campaign group id"),
  name: z.string().min(1),
  type: CampaignTypeSchema.default("SPONSORED_UPDATES"),
  costType: z.enum(["CPC", "CPM", "CPV"]).default("CPM"),
  dailyBudget: MoneySchema.optional(),
  totalBudget: MoneySchema.optional(),
  unitCost: MoneySchema.optional().describe("Bid amount"),
  locale: z.object({ country: z.string(), language: z.string() }).default({ country: "US", language: "en" }),
  runSchedule: RunScheduleSchema,
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
  /**
   * Raw targetingCriteria object (include/exclude tree). Build with helpers in
   * targeting.ts, or pass an adSegment urn via `audienceSegmentUrn` for convenience.
   */
  targetingCriteria: z.record(z.any()).optional(),
  audienceSegmentUrn: z.string().optional().describe("urn:li:adSegment:... to target a matched audience"),
  geoUrns: z.array(z.string()).optional().describe("urn:li:geo:... locations to include"),
});
export type CampaignInput = z.infer<typeof CampaignInputSchema>;

export const TextAdCreativeSchema = z.object({
  accountId: z.string(),
  campaignId: z.string(),
  title: z.string().max(25),
  text: z.string().max(75),
  clickUri: z.string().url(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
});
export type TextAdCreativeInput = z.infer<typeof TextAdCreativeSchema>;

export const SponsoredImageCreativeSchema = z.object({
  accountId: z.string(),
  campaignId: z.string(),
  organizationUrn: z.string().describe("urn:li:organization:... that owns the post"),
  commentary: z.string().describe("The post body / ad intro text"),
  clickUri: z.string().url(),
  headline: z.string(),
  /** Local path to the image to upload. Omit to leave a copy-only draft for later. */
  imagePath: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("DRAFT"),
});
export type SponsoredImageCreativeInput = z.infer<typeof SponsoredImageCreativeSchema>;

export const AudienceUploadSchema = z.object({
  accountId: z.string(),
  name: z.string().min(1),
  csvPath: z.string(),
  /** Column header holding the email address. */
  emailColumn: z.string().default("email"),
  description: z.string().optional(),
});
export type AudienceUploadInput = z.infer<typeof AudienceUploadSchema>;

export const LaunchFromBriefSchema = z.object({
  accountId: z.string(),
  campaignGroupName: z.string(),
  campaignName: z.string(),
  audience: AudienceUploadSchema.omit({ accountId: true }).optional(),
  dailyBudget: MoneySchema,
  bid: MoneySchema.optional(),
  type: CampaignTypeSchema.default("SPONSORED_UPDATES"),
  runSchedule: RunScheduleSchema,
  geoUrns: z.array(z.string()).default(["urn:li:geo:103644278"]).describe("Defaults to United States"),
  creatives: z.array(z.union([TextAdCreativeSchema.omit({ accountId: true, campaignId: true }), SponsoredImageCreativeSchema.omit({ accountId: true, campaignId: true })])).optional(),
});
export type LaunchFromBriefInput = z.infer<typeof LaunchFromBriefSchema>;
