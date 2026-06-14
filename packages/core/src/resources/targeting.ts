import type { LinkedInClient } from "../http.js";

const FACET = (name: string) => `urn:li:adTargetingFacet:${name}`;
const LOCATIONS = FACET("locations");
const AUDIENCE_SEGMENTS = FACET("audienceMatchingSegments");

export interface TargetingCriteria {
  include: { and: Array<{ or: Record<string, string[]> }> };
  exclude?: { or: Record<string, string[]> };
}

/**
 * Builds a targetingCriteria tree from the common inputs: geo locations and an
 * optional matched-audience (adSegment) urn. Both are ANDed together when present.
 */
export function buildTargetingCriteria(opts: {
  geoUrns?: string[];
  audienceSegmentUrn?: string;
}): TargetingCriteria {
  const and: Array<{ or: Record<string, string[]> }> = [];
  if (opts.geoUrns?.length) and.push({ or: { [LOCATIONS]: opts.geoUrns } });
  if (opts.audienceSegmentUrn) and.push({ or: { [AUDIENCE_SEGMENTS]: [opts.audienceSegmentUrn] } });
  if (and.length === 0) {
    throw new Error("Targeting needs at least a location or an audience segment.");
  }
  return { include: { and } };
}

/** Discover available targeting facets (industries, seniorities, locations, ...). */
export async function listTargetingFacets(client: LinkedInClient) {
  const res = await client.request<{ elements: unknown[] }>({ path: "/adTargetingFacets" });
  return res.data.elements ?? [];
}

/** Look up entities (e.g. a geo or industry) within a facet by typeahead query. */
export async function findTargetingEntities(client: LinkedInClient, facetUrn: string, query?: string) {
  const res = await client.request<{ elements: Array<{ urn: string; name: string }> }>({
    path: "/adTargetingEntities",
    query: { q: "adTargetingFacet", queryVersion: "QUERY_USES_URNS", facet: facetUrn, query },
  });
  return res.data.elements ?? [];
}

/**
 * Estimates audience size for a set of included locations. Returns the rounded
 * total. A campaign needs >= 300 members to serve, so callers should warn below that.
 */
export async function estimateAudienceByGeo(client: LinkedInClient, geoUrns: string[]): Promise<number> {
  const query: Record<string, string> = { q: "targetingCriteria" };
  geoUrns.forEach((urn, i) => {
    query[`target.includedTargetingFacets.locations[${i}]`] = urn;
  });
  const res = await client.request<{ elements: Array<{ total: number }> }>({
    path: "/audienceCounts",
    query,
  });
  return res.data.elements?.[0]?.total ?? 0;
}

export const MIN_AUDIENCE_TO_SERVE = 300;
