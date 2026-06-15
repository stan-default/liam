import type { LinkedInClient } from "../http.js";

/** A campaign needs >= 300 members to serve. */
export const MIN_AUDIENCE_TO_SERVE = 300;

/** Full facet URN from a short name, e.g. "seniorities" -> urn:li:adTargetingFacet:seniorities. */
export const facetUrn = (name: string) => `urn:li:adTargetingFacet:${name}`;

/**
 * The common targeting facets, with the entity URN type each resolves to. Use a
 * short name as a key in TargetingSpec; resolve entity URNs via searchTargeting.
 */
export const COMMON_FACETS: Record<string, string> = {
  locations: "urn:li:geo",
  profileLocations: "urn:li:geo",
  seniorities: "urn:li:seniority",
  titles: "urn:li:title",
  functions: "urn:li:function",
  industries: "urn:li:industry",
  staffCountRanges: "(enum)",
  skills: "urn:li:skill",
  employers: "urn:li:organization",
  employersPast: "urn:li:organization",
  audienceMatchingSegments: "urn:li:adSegment",
  interests: "urn:li:interest",
  degrees: "urn:li:degree",
  fieldsOfStudy: "urn:li:fieldOfStudy",
  schools: "urn:li:school",
  groups: "urn:li:group",
};

/**
 * Structured targeting. Keys are short facet names (see COMMON_FACETS); values
 * are entity URNs. Within a facet the URNs are ORed; facets are ANDed together.
 * Excluded facets are ORed.
 */
export interface TargetingSpec {
  include: Record<string, string[]>;
  exclude?: Record<string, string[]>;
}

const nonEmpty = (rec?: Record<string, string[]>) =>
  Object.entries(rec ?? {}).filter(([, urns]) => urns && urns.length > 0);

/** Builds the targetingCriteria object for campaign create/update from a spec. */
export function buildTargetingCriteria(spec: TargetingSpec): Record<string, unknown> {
  const and = nonEmpty(spec.include).map(([name, urns]) => ({ or: { [facetUrn(name)]: urns } }));
  if (and.length === 0) throw new Error("Targeting needs at least one included facet with entities.");
  const criteria: Record<string, unknown> = { include: { and } };
  const ex = nonEmpty(spec.exclude);
  if (ex.length > 0) {
    criteria.exclude = { or: Object.fromEntries(ex.map(([name, urns]) => [facetUrn(name), urns])) };
  }
  return criteria;
}

/** Encodes a spec into the restli-2.0 targetingCriteria string for audienceCounts. */
export function encodeTargetingCriteria(spec: TargetingSpec): string {
  const enc = encodeURIComponent;
  const orClause = ([name, urns]: [string, string[]]) =>
    `(or:(${enc(facetUrn(name))}:List(${urns.map(enc).join(",")})))`;
  const and = nonEmpty(spec.include).map(orClause).join(",");
  let body = `include:(and:List(${and}))`;
  const ex = nonEmpty(spec.exclude);
  if (ex.length > 0) {
    const exPairs = ex.map(([name, urns]) => `${enc(facetUrn(name))}:List(${urns.map(enc).join(",")})`).join(",");
    body += `,exclude:(or:(${exPairs}))`;
  }
  return `(${body})`;
}

/** All available targeting facets (name, entity types, finders). */
export async function listTargetingFacets(client: LinkedInClient) {
  const res = await client.request<{ elements: unknown[] }>({ path: "/adTargetingFacets" });
  return res.data.elements ?? [];
}

export interface TargetingEntity {
  urn: string;
  name: string;
  facetUrn?: string;
}

/**
 * Typeahead search for entities within a facet, e.g. searchTargeting(client,
 * "titles", "marketing") -> [{name:"Marketing Manager", urn:"urn:li:title:..."}].
 * This is the building block for natural-language targeting.
 */
export async function searchTargeting(
  client: LinkedInClient,
  facet: string,
  query: string,
): Promise<TargetingEntity[]> {
  const res = await client.request<{ elements: TargetingEntity[] }>({
    path: "/adTargetingEntities",
    query: { q: "typeahead", query, facet: facetUrn(facet) },
  });
  return res.data.elements ?? [];
}

/** Lists all entities of a facet (for small enumerations like seniorities). */
export async function listFacetEntities(client: LinkedInClient, facet: string): Promise<TargetingEntity[]> {
  const res = await client.request<{ elements: TargetingEntity[] }>({
    path: "/adTargetingEntities",
    query: { q: "adTargetingFacet", queryVersion: "QUERY_USES_URNS", facet: facetUrn(facet) },
  });
  return res.data.elements ?? [];
}

export interface AudienceEstimate {
  total: number;
  active: number;
  canServe: boolean;
}

/** Estimates audience size for a full targeting spec (restli targetingCriteriaV2). */
export async function estimateAudience(client: LinkedInClient, spec: TargetingSpec): Promise<AudienceEstimate> {
  const rawQuery = `q=targetingCriteriaV2&targetingCriteria=${encodeTargetingCriteria(spec)}`;
  const res = await client.request<{ elements: Array<{ total: number; active: number }> }>({
    path: "/audienceCounts",
    rawQuery,
  });
  const el = res.data.elements?.[0];
  const total = el?.total ?? 0;
  return { total, active: el?.active ?? 0, canServe: total >= MIN_AUDIENCE_TO_SERVE };
}

/** Convenience: build a spec from geo URNs and an optional matched-audience segment. */
export function geoSegmentSpec(geoUrns?: string[], audienceSegmentUrn?: string): TargetingSpec {
  const include: Record<string, string[]> = {};
  if (geoUrns?.length) include.locations = geoUrns;
  if (audienceSegmentUrn) include.audienceMatchingSegments = [audienceSegmentUrn];
  return { include };
}
