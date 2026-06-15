import type { LinkedInClient } from "../http.js";

/** Reporting levels, mapped to LinkedIn's analytics pivots. */
export type AnalyticsPivot = "ACCOUNT" | "CAMPAIGN_GROUP" | "CAMPAIGN" | "CREATIVE";
export type TimeGranularity = "ALL" | "DAILY" | "MONTHLY";

/** What to filter the report to (the parent entity to pull stats under). */
export type FilterType = "accounts" | "campaignGroups" | "campaigns" | "creatives";

export interface LiDate {
  year: number;
  month: number;
  day: number;
}
export interface DateRange {
  start: LiDate;
  end: LiDate;
}

/** Metric fields requested by default (all verified valid against the live API). */
export const DEFAULT_METRIC_FIELDS = [
  "impressions",
  "clicks",
  "costInUsd",
  "externalWebsiteConversions",
  "oneClickLeads",
  "qualifiedLeads",
  "landingPageClicks",
  "companyPageClicks",
  "totalEngagements",
  "likes",
  "comments",
  "shares",
  "follows",
  "videoViews",
];

const FILTER_URN_TYPE: Record<FilterType, string> = {
  accounts: "sponsoredAccount",
  campaignGroups: "sponsoredCampaignGroup",
  campaigns: "sponsoredCampaign",
  creatives: "sponsoredCreative",
};

export interface RawAnalyticsRow {
  pivotValues: string[];
  dateRange: DateRange;
  [metric: string]: unknown;
}

const encDate = (d: LiDate) => `(year:${d.year},month:${d.month},day:${d.day})`;
export const encDateRange = (r: DateRange) => `(start:${encDate(r.start)},end:${encDate(r.end)})`;

/**
 * The analytics engine. Pivots stats by `pivot`, filtered to the given parent
 * entities (`filterType` + ids), over `dateRange` at `timeGranularity`. Uses the
 * restli `q=analytics` finder via the client's rawQuery escape hatch (dateRange
 * and the List() of URNs need literal restli structure with encoded URNs).
 */
export async function fetchAnalytics(
  client: LinkedInClient,
  opts: {
    pivot: AnalyticsPivot;
    timeGranularity: TimeGranularity;
    dateRange: DateRange;
    filterType: FilterType;
    ids: string[];
    fields?: string[];
  },
): Promise<RawAnalyticsRow[]> {
  const fields = [...(opts.fields ?? DEFAULT_METRIC_FIELDS), "pivotValues", "dateRange"];
  const urnType = FILTER_URN_TYPE[opts.filterType];
  const list = opts.ids
    .map((id) => encodeURIComponent(`urn:li:${urnType}:${id.split(":").pop()}`))
    .join(",");
  const rawQuery =
    `q=analytics&pivot=${opts.pivot}&timeGranularity=${opts.timeGranularity}` +
    `&dateRange=${encDateRange(opts.dateRange)}&${opts.filterType}=List(${list})&fields=${fields.join(",")}`;
  const res = await client.request<{ elements: RawAnalyticsRow[] }>({ path: "/adAnalytics", rawQuery });
  return res.data.elements ?? [];
}
