/**
 * Official LinkedIn Ad Library API client.
 *
 * Calls the vetted partner endpoint `GET /rest/adLibrary?q=criteria`
 * (finder `partnerApiAdTransparencyCreativeEntities.FINDER-criteria`). Verified
 * against live responses. The API returns rich, structured METADATA per ad:
 *
 *   {
 *     adUrl, isRestricted,
 *     details: {
 *       type,                                  // ad format, e.g. SPONSORED_STATUS_UPDATE
 *       advertiser: { advertiserName, adPayer, advertiserUrl },
 *       adStatistics: {                        // EU-served ads only
 *         firstImpressionAt, latestImpressionAt,   // epoch ms
 *         totalImpressions: { from, to },
 *         impressionsDistributionByCountry: [{ country: "urn:li:country:RO", impressionPercentage }]
 *       },
 *       adTargeting: [{ facetName, includedSegments, excludedSegments, isIncluded, isExcluded }]
 *     }
 *   }
 *
 * It does NOT return the ad creative copy/image — only the detail-page URL. Copy
 * is layered in separately by the scraper (see competitorAds.ts).
 *
 * Confirmed `criteria` params: `keyword`, `advertiser` (name), `countries`
 * (restli List of country URNs). There is no company-id or date-range param.
 *
 * ACCESS: vetted product. The app must be granted "LinkedIn Ad Library" in the
 * Developer Portal; until then the endpoint returns 403 ACCESS_DENIED.
 */

import type { LinkedInClient } from "./http.js";
import type { AdLibraryAd, AdLibraryDetail } from "./adLibrary.js";

export interface AdLibraryApiOptions {
  keyword?: string;
  /** Advertiser display name (the only advertiser filter the API supports). */
  advertiser?: string;
  /** ISO-3166 country codes, e.g. ["US", "GB"] — converted to country URNs. */
  countries?: string[];
  /** Max ads to collect across pages (default 50). */
  max?: number;
}

/** An ad enriched with the raw API element it was normalized from. */
export type AdLibraryApiAd = AdLibraryAd & { raw?: unknown };

export interface AdLibraryApiResult {
  fetched: number;
  /** The advertiser-wide total the API reports for this query. */
  totalReported?: number;
  ads: AdLibraryApiAd[];
}

/** Raised when the app isn't provisioned for the Ad Library product. */
export class AdLibraryAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdLibraryAccessError";
  }
}

/** Restli list literal of country URNs, e.g. List(urn:li:country:us,urn:li:country:gb). */
const countryList = (codes: string[]) =>
  `List(${codes.map((c) => `urn:li:country:${c.toLowerCase()}`).join(",")})`;

const epochToDate = (ms: unknown): string | undefined => {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
};

const compactImpressions = (range: unknown): string | undefined => {
  if (!range || typeof range !== "object") return undefined;
  const r = range as { from?: number; to?: number };
  const fmt = (n?: number) => (typeof n === "number" ? (n >= 1000 ? `${n / 1000}k` : String(n)) : "?");
  if (r.from == null && r.to == null) return undefined;
  return `${fmt(r.from)}-${fmt(r.to)}`;
};

const countryCode = (urn: unknown): string =>
  typeof urn === "string" ? urn.replace(/^urn:li:country:/, "").toUpperCase() : String(urn ?? "");

/** Normalize one live API element into our unified AdLibraryAd shape. */
export function normalizeApiElement(el: Record<string, unknown>): AdLibraryApiAd {
  const adUrl = typeof el.adUrl === "string" ? el.adUrl : "";
  const detailId = adUrl.match(/detail\/(\d+)/)?.[1] ?? "";
  const details = (el.details ?? {}) as Record<string, unknown>;
  const advertiser = (details.advertiser ?? {}) as Record<string, unknown>;
  const stats = details.adStatistics as Record<string, unknown> | undefined;
  const targetingArr = Array.isArray(details.adTargeting) ? (details.adTargeting as Record<string, unknown>[]) : [];

  const detail: AdLibraryDetail = {};
  if (typeof details.type === "string") detail.format = details.type;
  if (typeof advertiser.adPayer === "string") detail.paidForBy = advertiser.adPayer;
  if (typeof advertiser.advertiserUrl === "string") detail.advertiserUrl = advertiser.advertiserUrl;

  if (stats) {
    const from = epochToDate(stats.firstImpressionAt);
    const to = epochToDate(stats.latestImpressionAt);
    if (from) detail.ranFrom = from;
    if (to) detail.ranTo = to;
    const impr = compactImpressions(stats.totalImpressions);
    if (impr) detail.totalImpressions = impr;
    const dist = stats.impressionsDistributionByCountry;
    if (Array.isArray(dist)) {
      detail.impressionsByCountry = dist
        .map((c) => {
          const o = c as Record<string, unknown>;
          const pct = o.impressionPercentage;
          return {
            country: countryCode(o.country),
            share: typeof pct === "number" ? `${pct.toFixed(1)}%` : String(pct ?? ""),
          };
        })
        .filter((c) => c.country);
    }
  }

  const targeting = targetingArr
    .map((t) => ({
      facet: typeof t.facetName === "string" ? t.facetName : "",
      included: Array.isArray(t.includedSegments) ? (t.includedSegments as string[]) : [],
      excluded: Array.isArray(t.excludedSegments) ? (t.excludedSegments as string[]) : [],
    }))
    // Keep only facets that actually carry segments (the API lists empty ones too).
    .filter((t) => t.facet && (t.included.length || t.excluded.length));
  if (targeting.length) detail.targeting = targeting;

  return {
    detailId,
    detailUrl: adUrl || (detailId ? `https://www.linkedin.com/ad-library/detail/${detailId}` : ""),
    advertiser: typeof advertiser.advertiserName === "string" ? advertiser.advertiserName : "",
    promotedBy: typeof advertiser.adPayer === "string" ? advertiser.adPayer : undefined,
    // The API has no copy/image; the scraper fills these in later (hybrid).
    commentary: undefined,
    format: typeof details.type === "string" ? details.type : undefined,
    detail: Object.keys(detail).length ? detail : undefined,
    raw: el,
  };
}

/**
 * Search the official Ad Library API, paging until `max` ads or exhaustion.
 * Throws AdLibraryAccessError on 403 so the caller can fall back to the scraper.
 */
export async function searchAdLibraryApi(
  client: LinkedInClient,
  opts: AdLibraryApiOptions,
): Promise<AdLibraryApiResult> {
  if (!opts.advertiser && !opts.keyword) {
    throw new Error(
      "The Ad Library API filters by advertiser name or keyword (it has no company-id parameter). " +
        "Provide `advertiser` or `keyword`.",
    );
  }
  const max = opts.max ?? 50;
  const ads: AdLibraryApiAd[] = [];
  let start = 0;
  let totalReported: number | undefined;
  const pageSize = Math.min(100, max);

  while (ads.length < max) {
    const query: Record<string, string | number | undefined> = { q: "criteria", count: pageSize, start };
    if (opts.keyword) query.keyword = opts.keyword;
    if (opts.advertiser) query.advertiser = opts.advertiser;
    if (opts.countries?.length) query.countries = countryList(opts.countries);

    let res;
    try {
      res = await client.request<{
        elements?: Record<string, unknown>[];
        paging?: { total?: number };
      }>({ path: "/adLibrary", query });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) {
        throw new AdLibraryAccessError(
          "The Ad Library API is not provisioned for this app. Request the 'LinkedIn Ad Library' product " +
            "in the Developer Portal (Products tab). " + (err.message ?? ""),
        );
      }
      throw e;
    }

    if (totalReported === undefined && typeof res.data.paging?.total === "number") {
      totalReported = res.data.paging.total;
    }
    const elements = res.data.elements ?? [];
    if (!elements.length) break;
    for (const el of elements) {
      ads.push(normalizeApiElement(el));
      if (ads.length >= max) break;
    }
    if (elements.length < pageSize) break;
    start += pageSize;
  }

  return { fetched: ads.length, totalReported, ads };
}
