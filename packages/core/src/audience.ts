import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type { LinkedInClient, TokenProvider } from "./http.js";
import type { AudienceUploadInput } from "./schemas.js";
import {
  generateUploadUrl,
  uploadListCsv,
  createListUploadSegment,
  attachListToSegment,
  deleteDmpSegment,
  MAX_SEGMENT_ROWS,
  RECOMMENDED_MIN_ROWS,
} from "./resources/dmpSegments.js";

/** Normalize (trim + lowercase) and SHA256-hash an email, per LinkedIn's spec. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Validate, normalize, SHA256-hash, and dedupe a list of raw emails. */
export function hashAndDedupeEmails(emails: string[]): { hashes: string[]; total: number; skipped: number } {
  const seen = new Set<string>();
  let skipped = 0;
  for (const email of emails) {
    if (!email || !EMAIL_RE.test(email)) {
      skipped += 1;
      continue;
    }
    seen.add(hashEmail(email));
  }
  return { hashes: [...seen], total: emails.length, skipped };
}

/** Reads a CSV and returns hashed emails from the given column, deduped. */
export async function hashEmailsFromCsv(
  csvPath: string,
  emailColumn: string,
): Promise<{ hashes: string[]; total: number; skipped: number }> {
  const content = await readFile(csvPath, "utf8");
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  return hashAndDedupeEmails(rows.map((r) => r[emailColumn] ?? ""));
}

export interface AudienceUploadResult {
  segmentId: string;
  uploaded: number;
  totalRows: number;
  skipped: number;
  status: "PROCESSING";
  warnings: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Full audience upload via the list-upload flow: hash emails -> generate upload
 * URL -> upload a hashed CSV -> create a LIST_UPLOAD segment -> attach the list.
 * The segment then matches asynchronously (up to 48h); poll getDmpSegment for the
 * adSegment urn to target. Needs a token for the signed binary upload.
 */
export async function uploadAudienceFromCsv(
  client: LinkedInClient,
  getToken: TokenProvider,
  input: AudienceUploadInput,
): Promise<AudienceUploadResult> {
  const { hashes, total, skipped } = await hashEmailsFromCsv(input.csvPath, input.emailColumn);
  return uploadHashedAudience(client, getToken, { accountId: input.accountId, name: input.name, hashes, total, skipped });
}

/** Upload a matched audience from a list of raw emails (e.g. from Salesforce). */
export async function uploadAudienceFromEmails(
  client: LinkedInClient,
  getToken: TokenProvider,
  input: { accountId: string; name: string; emails: string[] },
): Promise<AudienceUploadResult> {
  const { hashes, total, skipped } = hashAndDedupeEmails(input.emails);
  return uploadHashedAudience(client, getToken, { accountId: input.accountId, name: input.name, hashes, total, skipped });
}

/** Shared core: validate sizes, build the hashed CSV, run the DMP list-upload flow. */
async function uploadHashedAudience(
  client: LinkedInClient,
  getToken: TokenProvider,
  input: { accountId: string; name: string; hashes: string[]; total: number; skipped: number },
): Promise<AudienceUploadResult> {
  const { hashes, total, skipped } = input;
  const warnings: string[] = [];

  if (hashes.length === 0) {
    throw new Error("No valid emails to upload.");
  }
  if (hashes.length > MAX_SEGMENT_ROWS) {
    throw new Error(`List has ${hashes.length} emails; LinkedIn caps a single upload at ${MAX_SEGMENT_ROWS}.`);
  }
  if (hashes.length < RECOMMENDED_MIN_ROWS) {
    warnings.push(
      `Only ${hashes.length} valid emails. LinkedIn recommends >= ${RECOMMENDED_MIN_ROWS} and needs ~300 matched members to serve. Match rates run ~30-60%, so a small list may never become targetable.`,
    );
  }
  if (skipped > 0) warnings.push(`Skipped ${skipped} rows with missing/invalid emails.`);

  // Build the hashed-email CSV LinkedIn expects (single `email` column of hashes).
  const csv = `email\n${hashes.join("\n")}\n`;

  const token = await getToken();
  const uploadUrl = await generateUploadUrl(client, input.accountId);
  const mediaUrn = await uploadListCsv(uploadUrl, csv, token);
  const segment = await createListUploadSegment(client, { accountId: input.accountId, name: input.name });
  await sleep(5000); // LinkedIn requires ~5s before a segment can accept a list.
  try {
    await attachListToSegment(client, segment.id, mediaUrn);
  } catch (err) {
    // Don't leave an empty orphan segment behind if the list is rejected.
    await deleteDmpSegment(client, segment.id).catch(() => {});
    throw err;
  }

  warnings.push("Segment is matching (up to 48h). Poll get_audience_status; target it once READY.");

  return { segmentId: segment.id, uploaded: hashes.length, totalRows: total, skipped, status: "PROCESSING", warnings };
}
