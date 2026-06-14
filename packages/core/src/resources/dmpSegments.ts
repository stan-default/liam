import type { LinkedInClient } from "../http.js";
import { sponsoredAccountUrn } from "../urns.js";
import type { CreatedEntity } from "./campaignGroups.js";

/**
 * DMP Segments (matched audiences) via the list-upload flow:
 *   1. generateUploadUrl  2. upload hashed CSV  3. create segment
 *   4. attach list        5. poll until READY -> adSegment urn (up to 48h)
 *
 * Requires the Audiences product on the LinkedIn app. The resolved adSegment urn
 * (for campaign targeting) is only available once the segment reaches READY.
 */

/** Max rows per LinkedIn list upload. */
export const MAX_SEGMENT_ROWS = 300_000;
/** Recommended minimum rows for contact lists (companies: 1,000). */
export const RECOMMENDED_MIN_ROWS = 10_000;

export type SegmentType = "USER_LIST_UPLOAD" | "COMPANY_LIST_UPLOAD";

/** Step 1: get a signed URL to upload the CSV to. */
export async function generateUploadUrl(client: LinkedInClient, accountId: string): Promise<string> {
  const res = await client.request<{ value: string }>({
    method: "POST",
    path: "/dmpSegments",
    query: { action: "generateUploadUrl" },
    body: { owner: sponsoredAccountUrn(accountId) },
  });
  if (!res.data?.value) throw new Error("generateUploadUrl returned no upload URL");
  return res.data.value;
}

/** Step 2: upload the CSV bytes to the signed URL; returns the media URN. */
export async function uploadListCsv(uploadUrl: string, csv: string, token: string): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/csv" },
    body: csv,
  });
  if (!res.ok) throw new Error(`List CSV upload failed (${res.status}): ${await res.text()}`);
  const location = res.headers.get("location");
  if (!location) throw new Error("List upload succeeded but no media location returned");
  return `urn:li:media:${location}`;
}

/** Step 3: create the LIST_UPLOAD segment (empty staging entity). */
export async function createListUploadSegment(
  client: LinkedInClient,
  opts: { accountId: string; name: string; type?: SegmentType },
): Promise<CreatedEntity> {
  const res = await client.request({
    method: "POST",
    path: "/dmpSegments",
    body: {
      account: sponsoredAccountUrn(opts.accountId),
      destinations: [{ destination: "LINKEDIN" }],
      name: opts.name,
      sourcePlatform: "LIST_UPLOAD",
      type: opts.type ?? "USER_LIST_UPLOAD",
    },
  });
  if (!res.restliId) throw new Error("DMP segment created but no id returned");
  return { id: res.restliId };
}

/** Step 4: attach an uploaded list (media URN) to the segment. */
export async function attachListToSegment(
  client: LinkedInClient,
  segmentId: string,
  mediaUrn: string,
): Promise<void> {
  await client.request({
    method: "POST",
    path: `/dmpSegments/${segmentId}/listUploads`,
    body: { inputFile: mediaUrn },
  });
}

export interface DmpDestination {
  destination: string;
  status?: string;
  audienceSize?: number;
  matchedCount?: number;
  /** The adSegment urn to target, present once status is READY. */
  destinationSegmentId?: string;
}

export interface DmpSegmentStatus {
  id: number;
  name: string;
  type?: string;
  inputCount?: number;
  destinations?: DmpDestination[];
}

/** Step 5: poll segment status. READY destinations carry the adSegment urn. */
export async function getDmpSegment(client: LinkedInClient, segmentId: string): Promise<DmpSegmentStatus> {
  const res = await client.request<DmpSegmentStatus>({ path: `/dmpSegments/${segmentId}` });
  return res.data;
}

/** Convenience: the adSegment urn for targeting, or undefined until READY. */
export function readyAdSegmentUrn(segment: DmpSegmentStatus): string | undefined {
  return segment.destinations?.find((d) => d.status === "READY")?.destinationSegmentId;
}

/** Delete a DMP segment (e.g. cleanup of an empty/failed segment). */
export async function deleteDmpSegment(client: LinkedInClient, segmentId: string): Promise<void> {
  await client.request({ method: "DELETE", path: `/dmpSegments/${segmentId}` });
}
