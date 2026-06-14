import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type { LinkedInClient } from "./http.js";
import type { AudienceUploadInput } from "./schemas.js";
import {
  createDmpSegment,
  addHashedEmails,
  MAX_SEGMENT_ROWS,
  RECOMMENDED_MIN_ROWS,
} from "./resources/dmpSegments.js";
import { adSegmentUrn } from "./urns.js";

/** Normalize (trim + lowercase) and SHA256-hash an email, per LinkedIn's spec. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Reads a CSV and returns hashed emails from the given column, deduped. */
export async function hashEmailsFromCsv(
  csvPath: string,
  emailColumn: string,
): Promise<{ hashes: string[]; total: number; skipped: number }> {
  const content = await readFile(csvPath, "utf8");
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];

  const seen = new Set<string>();
  let skipped = 0;
  for (const row of rows) {
    const email = row[emailColumn];
    if (!email || !EMAIL_RE.test(email)) {
      skipped += 1;
      continue;
    }
    seen.add(hashEmail(email));
  }
  return { hashes: [...seen], total: rows.length, skipped };
}

export interface AudienceUploadResult {
  segmentId: string;
  adSegmentUrn: string;
  uploaded: number;
  totalRows: number;
  skipped: number;
  warnings: string[];
}

/**
 * Full audience upload: CSV -> hashed emails -> new DMP segment -> users added.
 * Returns the adSegment urn to target in a campaign. Matching can take up to 48h
 * and the audience must reach ~300 matched members before a campaign will serve.
 */
export async function uploadAudienceFromCsv(
  client: LinkedInClient,
  input: AudienceUploadInput,
): Promise<AudienceUploadResult> {
  const { hashes, total, skipped } = await hashEmailsFromCsv(input.csvPath, input.emailColumn);
  const warnings: string[] = [];

  if (hashes.length === 0) {
    throw new Error(`No valid emails found in column "${input.emailColumn}" of ${input.csvPath}`);
  }
  if (hashes.length > MAX_SEGMENT_ROWS) {
    throw new Error(`List has ${hashes.length} emails; LinkedIn caps a single upload at ${MAX_SEGMENT_ROWS}.`);
  }
  if (hashes.length < RECOMMENDED_MIN_ROWS) {
    warnings.push(
      `Only ${hashes.length} valid emails. LinkedIn recommends >= ${RECOMMENDED_MIN_ROWS}, and a campaign needs ~300 matched members to serve. Match rates are typically 30-60%, so a small list may never become targetable.`,
    );
  }
  if (skipped > 0) warnings.push(`Skipped ${skipped} rows with missing/invalid emails.`);

  const segment = await createDmpSegment(client, {
    accountId: input.accountId,
    name: input.name,
    description: input.description,
  });
  const { added } = await addHashedEmails(client, segment.id, hashes);

  return {
    segmentId: segment.id,
    adSegmentUrn: adSegmentUrn(segment.id),
    uploaded: added,
    totalRows: total,
    skipped,
    warnings,
  };
}
