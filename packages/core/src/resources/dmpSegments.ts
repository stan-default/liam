import type { LinkedInClient } from "../http.js";
import { sponsoredAccountUrn } from "../urns.js";
import type { CreatedEntity } from "./campaignGroups.js";

/**
 * DMP Segments (matched audiences).
 *
 * NOTE: these endpoints require the separate **Audiences** product on the
 * LinkedIn app, which is NOT included with base Advertising API access. If calls
 * 403, the product needs to be requested/enabled. Field shapes below follow the
 * current versioned API and should be re-verified once the product is live.
 */

/** Max hashed rows per LinkedIn list upload. */
export const MAX_SEGMENT_ROWS = 300_000;
/** LinkedIn's recommended minimum for a healthy match rate. */
export const RECOMMENDED_MIN_ROWS = 10_000;
/** Users added per batch request. */
const USER_BATCH_SIZE = 10_000;

export async function createDmpSegment(
  client: LinkedInClient,
  opts: { accountId: string; name: string; description?: string },
): Promise<CreatedEntity> {
  const res = await client.request({
    method: "POST",
    path: "/dmpSegments",
    body: {
      account: sponsoredAccountUrn(opts.accountId),
      name: opts.name,
      description: opts.description,
      type: "USER",
      accessPolicy: "PRIVATE",
      sourcePlatform: "API_SELF_SERVE",
    },
  });
  if (!res.restliId) throw new Error("DMP segment created but no id returned");
  return { id: res.restliId };
}

/** Adds SHA256-hashed emails to a segment, chunked into batches. */
export async function addHashedEmails(
  client: LinkedInClient,
  segmentId: string,
  sha256Emails: string[],
): Promise<{ added: number; batches: number }> {
  let added = 0;
  let batches = 0;
  for (let i = 0; i < sha256Emails.length; i += USER_BATCH_SIZE) {
    const chunk = sha256Emails.slice(i, i + USER_BATCH_SIZE);
    await client.request({
      method: "POST",
      path: `/dmpSegments/${segmentId}/users`,
      body: {
        elements: [
          {
            action: "ADD",
            userIds: chunk.map((hash) => ({ idType: "SHA256_EMAIL", idValue: hash })),
          },
        ],
      },
    });
    added += chunk.length;
    batches += 1;
  }
  return { added, batches };
}

export interface DmpSegmentStatus {
  id: number;
  name: string;
  status?: string;
  /** Resolved/matched member count, once processing completes (up to 48h). */
  audienceSize?: number;
}

export async function getDmpSegment(
  client: LinkedInClient,
  segmentId: string,
): Promise<DmpSegmentStatus> {
  const res = await client.request<DmpSegmentStatus>({ path: `/dmpSegments/${segmentId}` });
  return res.data;
}
