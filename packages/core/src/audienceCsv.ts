import { parse } from "csv-parse/sync";

/**
 * Cleans a messy CSV into LinkedIn's required matched-audience format before
 * upload: normalizes column names (aliases -> canonical), drops everything that
 * isn't a matcher, and turns company domains into website URLs.
 *
 * Two list types:
 *  - contact (USER_LIST_UPLOAD): matched by email. Kept column: `email`.
 *  - company (COMPANY_LIST_UPLOAD): matched by website. Kept columns:
 *    `companyname`, `companywebsite` (full https:// URL, since LinkedIn matches
 *    accounts on the website URL).
 */

export type AudienceType = "contact" | "company";

const normKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const EMAIL_KEYS = new Set(
  ["email", "emailaddress", "emailaddr", "mail", "workemail", "useremail", "primaryemail", "emailaddress1"],
);
const COMPANY_NAME_KEYS = new Set(
  ["companyname", "company", "accountname", "account", "organization", "organisation", "companylegalname", "name"],
);
const WEBSITE_KEYS = new Set(
  ["companywebsite", "website", "websiteurl", "url", "web", "companyurl", "companywebsiteurl", "homepage",
   "domain", "companydomain", "companyemaildomain", "emaildomain", "websitedomain", "webdomain"],
);

/** Turn a domain or messy URL into a clean https:// website URL (or "" if not a domain). */
export function toWebsiteUrl(raw: string): string {
  let s = (raw ?? "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0]!.replace(/:\d+$/, "");
  if (!s.includes(".")) return "";
  return `https://${s}`;
}

export interface CleanedCsv {
  type: AudienceType;
  /** Canonical columns kept in the output. */
  columns: string[];
  /** Cleaned rows (raw email for contacts; website is already a URL for companies). */
  rows: Record<string, string>[];
  /** Original headers that were dropped. */
  dropped: string[];
  rowCount: number;
  warnings: string[];
}

function findHeader(headers: string[], keys: Set<string>): string | undefined {
  return headers.find((h) => keys.has(normKey(h)));
}

function detectType(headers: string[]): AudienceType {
  if (findHeader(headers, EMAIL_KEYS)) return "contact";
  if (findHeader(headers, COMPANY_NAME_KEYS) || findHeader(headers, WEBSITE_KEYS)) return "company";
  throw new Error("Could not detect list type from columns. Pass an explicit type (contact|company).");
}

/** Parse + normalize a CSV into LinkedIn's matched-audience format. */
export function cleanAudienceCsv(text: string, opts: { type?: AudienceType } = {}): CleanedCsv {
  const parsed = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const headers = parsed.length ? Object.keys(parsed[0]!) : [];
  if (headers.length === 0) throw new Error("CSV has no header row.");

  const type = opts.type ?? detectType(headers);
  const warnings: string[] = [];

  if (type === "contact") {
    const emailCol = findHeader(headers, EMAIL_KEYS);
    if (!emailCol) throw new Error("No email column found for a contact list.");
    const rows = parsed.map((r) => ({ email: (r[emailCol] ?? "").trim().toLowerCase() })).filter((r) => r.email);
    const dropped = headers.filter((h) => h !== emailCol);
    if (dropped.length) warnings.push(`Dropped ${dropped.length} non-matcher column(s): ${dropped.join(", ")}.`);
    return { type, columns: ["email"], rows, dropped, rowCount: rows.length, warnings };
  }

  // company
  const nameCol = findHeader(headers, COMPANY_NAME_KEYS);
  const webCol = findHeader(headers, WEBSITE_KEYS);
  if (!webCol && !nameCol) throw new Error("No company name or website/domain column found.");
  if (!webCol) warnings.push("No website/domain column found; matching on company name only.");

  const columns = [...(nameCol ? ["companyname"] : []), ...(webCol ? ["companywebsite"] : [])];
  let convertedDomains = 0;
  const rows: Record<string, string>[] = [];
  for (const r of parsed) {
    const out: Record<string, string> = {};
    if (nameCol) out.companyname = (r[nameCol] ?? "").trim();
    if (webCol) {
      const url = toWebsiteUrl(r[webCol] ?? "");
      if (url) {
        out.companywebsite = url;
        if (!/^https?:\/\//i.test((r[webCol] ?? "").trim())) convertedDomains += 1;
      }
    }
    if (out.companyname || out.companywebsite) rows.push(out);
  }
  const dropped = headers.filter((h) => h !== nameCol && h !== webCol);
  if (dropped.length) warnings.push(`Dropped ${dropped.length} non-matcher column(s): ${dropped.join(", ")}.`);
  if (convertedDomains) warnings.push(`Converted ${convertedDomains} domain(s) to https:// website URLs.`);

  return { type, columns, rows, dropped, rowCount: rows.length, warnings };
}

/** Render a CleanedCsv back to CSV text (used for company uploads and dry-run preview). */
export function cleanedToCsv(clean: CleanedCsv): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = clean.columns.join(",");
  const body = clean.rows.map((r) => clean.columns.map((c) => esc(r[c] ?? "")).join(",")).join("\n");
  return `${head}\n${body}\n`;
}
