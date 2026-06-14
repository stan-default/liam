import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Reads from Salesforce by shelling out to the already-authenticated `sf` CLI
 * (reuses existing auth — no new credentials). Phase 3 cross-referencing builds
 * on this. Read-only by design.
 */
export async function soql<T = Record<string, unknown>>(
  query: string,
  opts: { targetOrg?: string } = {},
): Promise<T[]> {
  const args = ["data", "query", "--json", "-q", query];
  if (opts.targetOrg) args.push("-o", opts.targetOrg);

  const { stdout } = await execFileAsync("sf", args, { maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(stdout) as { status: number; result?: { records?: T[] }; message?: string };
  if (parsed.status !== 0) throw new Error(`sf query failed: ${parsed.message ?? "unknown error"}`);
  return parsed.result?.records ?? [];
}

/**
 * Phase 3 helper: pull email addresses for accounts flagged in Salesforce, to feed
 * a matched audience. Customize the SOQL to Default's schema (field/list names).
 */
export async function emailsForFlaggedAccounts(flagField: string): Promise<string[]> {
  const records = await soql<{ Email?: string }>(
    `SELECT Email FROM Contact WHERE Account.${flagField} = true AND Email != null`,
  );
  return records.map((r) => r.Email!).filter(Boolean);
}
