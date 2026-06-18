#!/usr/bin/env node
import { Command } from "commander";
import {
  login,
  exportHostedEnv,
  createLiads,
  listAdAccounts,
  uploadAudienceFromFile,
  cleanAudienceCsv,
  getDmpSegment,
  launchFromBrief,
  requireDefaultAccountId,
  searchTargeting,
  estimateAudience,
  audienceFromSalesforce,
  listConversions,
  performanceSummary,
  getPerformance,
  performanceTrend,
  resolveDateRange,
  scanCompetitorAds,
  parseAdvertiserQuery,
} from "@liads/core";

const program = new Command();
program.name("liam").description("Liam, an ad manager for LinkedIn (CLI)").version("0.1.0");

const auth = program.command("auth").description("Authentication");
auth
  .command("login")
  .description("Run the OAuth flow and store tokens")
  .action(async () => {
    const creds = await login();
    console.log(`Authenticated. Scopes: ${creds.scope ?? "(unknown)"}`);
  });

auth
  .command("export")
  .description("Print env vars for the hosted (Vercel) MCP server")
  .action(async () => {
    const env = await exportHostedEnv();
    for (const [k, v] of Object.entries(env)) if (v) console.log(`${k}=${v}`);
    console.warn("! Treat these as secrets. Paste into Vercel project env, do not commit.");
  });

const accounts = program.command("accounts").description("Ad accounts");
accounts
  .command("list")
  .description("List accessible ad accounts")
  .action(async () => {
    const liads = await createLiads();
    const list = await listAdAccounts(liads.client);
    if (list.length === 0) {
      console.log("No ad accounts found. Map your account in the Developer Portal > Products > View Ad Accounts.");
      return;
    }
    for (const a of list) console.log(`${a.id}\t${a.status}\t${a.name}`);
  });

const audience = program.command("audience").description("Matched audiences");
audience
  .command("upload")
  .description("Clean a CSV (fix columns, drop extras, domains->URLs) and upload as a matched audience")
  .requiredOption("-n, --name <name>", "Audience name")
  .requiredOption("-f, --csv <path>", "CSV file path")
  .option("-a, --account <id>", "Ad account id (defaults to config defaultAccountId)")
  .option("-t, --type <type>", "contact|company (auto-detected if omitted)")
  .option("--dry-run", "Show the cleaned result without uploading")
  .action(async (opts) => {
    const { readFile } = await import("node:fs/promises");
    if (opts.dryRun) {
      const clean = cleanAudienceCsv(await readFile(opts.csv, "utf8"), { type: opts.type });
      console.log(`type: ${clean.type} | rows: ${clean.rowCount} | kept columns: ${clean.columns.join(", ")}`);
      if (clean.dropped.length) console.log(`dropped: ${clean.dropped.join(", ")}`);
      clean.warnings.forEach((w: string) => console.warn(`! ${w}`));
      console.log("\nsample:");
      console.log(clean.columns.join(","));
      clean.rows.slice(0, 3).forEach((r) => console.log(clean.columns.map((c) => r[c] ?? "").join(",")));
      return;
    }
    const liads = await createLiads();
    const res = await uploadAudienceFromFile(liads.client, liads.getToken, {
      accountId: opts.account ?? (await requireDefaultAccountId()),
      name: opts.name,
      csvPath: opts.csv,
      type: opts.type,
    });
    console.log(`Segment ${res.segmentId} (${res.audienceType}) — status ${res.status}`);
    console.log(`Uploaded ${res.uploaded} (${res.skipped} skipped of ${res.totalRows} rows).`);
    res.warnings.forEach((w: string) => console.warn(`! ${w}`));
  });

audience
  .command("from-salesforce")
  .description("Build a matched audience from a Salesforce SOQL query")
  .requiredOption("-n, --name <name>", "Audience name")
  .requiredOption("-q, --soql <query>", "SOQL selecting an email column")
  .option("-a, --account <id>", "Ad account id (defaults to config defaultAccountId)")
  .option("--email-field <col>", "Email column name if not 'Email'")
  .action(async (opts) => {
    const liads = await createLiads();
    const res = await audienceFromSalesforce(liads.client, liads.getToken, {
      accountId: opts.account ?? (await requireDefaultAccountId()),
      name: opts.name,
      soql: opts.soql,
      emailField: opts.emailField,
    });
    console.log(`Fetched ${res.fetchedFromSalesforce} emails from Salesforce.`);
    console.log(`Segment ${res.segmentId} — status ${res.status} (${res.uploaded} uploaded).`);
    res.warnings.forEach((w: string) => console.warn(`! ${w}`));
  });

audience
  .command("status <segmentId>")
  .description("Check a DMP segment's matching status")
  .action(async (segmentId: string) => {
    const liads = await createLiads();
    const s = await getDmpSegment(liads.client, segmentId);
    console.log(JSON.stringify(s, null, 2));
  });

const targeting = program.command("targeting").description("Audience targeting");
targeting
  .command("search <facet> <query>")
  .description("Typeahead-search entities in a facet (e.g. titles 'marketing')")
  .action(async (facet: string, query: string) => {
    const liads = await createLiads();
    const entities = await searchTargeting(liads.client, facet, query);
    for (const e of entities) console.log(`${e.urn}\t${e.name}`);
  });
targeting
  .command("estimate <facet> <urns...>")
  .description("Estimate audience size for one facet's URNs (comma/space separated)")
  .action(async (facet: string, urns: string[]) => {
    const liads = await createLiads();
    const est = await estimateAudience(liads.client, { include: { [facet]: urns } });
    console.log(`total ${est.total} | active ${est.active} | canServe ${est.canServe}`);
  });

const conversions = program.command("conversions").description("Conversions (insight tags)");
conversions
  .command("list")
  .description("List the account's conversions to select one for a campaign")
  .option("-a, --account <id>", "Ad account id (defaults to config defaultAccountId)")
  .action(async (opts) => {
    const liads = await createLiads();
    const acct = opts.account ?? (await requireDefaultAccountId());
    const list = await listConversions(liads.client, acct);
    for (const c of list) console.log(`${c.id}\t${c.enabled ? "on " : "off"}\t${c.type}\t${c.name}`);
  });

const pctf = (x: number) => `${(x * 100).toFixed(2)}%`;
const report = program.command("report").description("Performance reporting and insights");
report
  .command("summary")
  .description("Account rollup: totals, top/bottom performers, flags")
  .option("-a, --account <id>", "Ad account id (defaults to config)")
  .option("-p, --period <period>", "last_7_days|last_30_days|last_90_days|month_to_date|last_month", "last_30_days")
  .action(async (opts) => {
    const liads = await createLiads();
    const accountId = opts.account ?? (await requireDefaultAccountId());
    const s = await performanceSummary(liads.client, { accountId, dateRange: resolveDateRange({ period: opts.period }) });
    const t = s.totals;
    console.log(`TOTALS  spend $${t.costUsd}  impr ${t.impressions}  clicks ${t.clicks}  CTR ${pctf(t.ctr)}  conv ${t.conversions}  CPL/conv $${t.costPerConversion}`);
    console.log("\nTop campaigns by spend:");
    for (const g of s.topBySpend) console.log(`  $${g.costUsd}\tCTR ${pctf(g.ctr)}\tconv ${g.conversions}\t${g.name ?? g.entityId}`);
    if (s.flags.length) {
      console.log("\nFlags:");
      for (const f of s.flags) console.log(`  [${f.kind}] ${f.name ?? f.entityUrn}: ${f.detail}`);
    }
  });
report
  .command("perf <level>")
  .description("Per-entity rows (account|campaign_group|campaign|creative)")
  .option("-a, --account <id>", "Ad account id (defaults to config)")
  .option("--parent <id>", "Parent group id (campaigns) or campaign id (creatives)")
  .option("-p, --period <period>", "Date period", "last_30_days")
  .action(async (level, opts) => {
    const liads = await createLiads();
    const accountId = opts.account ?? (await requireDefaultAccountId());
    const rows = await getPerformance(liads.client, { accountId, level, parentId: opts.parent, dateRange: resolveDateRange({ period: opts.period }) });
    for (const r of rows) console.log(`$${r.costUsd}\timpr ${r.impressions}\tCTR ${pctf(r.ctr)}\tCPC $${r.cpc}\tconv ${r.conversions}\t${r.name ?? r.entityId}`);
  });
report
  .command("trend <level> <entityId>")
  .description("Weekly or monthly trend with deltas")
  .option("-b, --bucket <bucket>", "weekly|monthly", "weekly")
  .option("-p, --period <period>", "Date period", "last_90_days")
  .action(async (level, entityId, opts) => {
    const liads = await createLiads();
    const points = await performanceTrend(liads.client, { level, entityId, bucket: opts.bucket, dateRange: resolveDateRange({ period: opts.period }) });
    for (const p of points) {
      const dc = p.deltas?.costUsd;
      const d = dc !== undefined ? ` (spend ${dc >= 0 ? "+" : ""}${pctf(dc)})` : "";
      console.log(`${p.periodStart}\t$${p.costUsd}\timpr ${p.impressions}\tCTR ${pctf(p.ctr)}\tconv ${p.conversions}${d}`);
    }
  });

const competitor = program.command("competitor").description("Competitor ad intelligence (public LinkedIn Ad Library)");
competitor
  .command("ads <advertiser>")
  .description("Scan a competitor's ads from the public Ad Library. <advertiser> = company name, numeric company id, or an ad-library/company URL.")
  .option("--company-id <id>", "Force a numeric LinkedIn company id (most precise)")
  .option("-k, --keyword <text>", "Keyword search across ad copy instead of an advertiser")
  .option("-c, --country <codes>", "Comma-separated ISO country codes, e.g. US,GB")
  .option("-e, --engine <engine>", "auto | api | scraper", "auto")
  .option("-m, --max <n>", "Max ads to collect", (v) => parseInt(v, 10), 50)
  .option("--no-deep", "auto: skip copy layering (API metadata only); scraper: skip per-ad detail — faster")
  .option("--headed", "Scraper: show the browser window (debug)")
  .option("--json", "Print raw JSON instead of a summary")
  .action(async (advertiser: string, opts) => {
    const parsed = parseAdvertiserQuery(advertiser);
    const scan = await scanCompetitorAds({
      advertiser: opts.companyId ? undefined : parsed.advertiser,
      companyId: opts.companyId ?? parsed.companyId,
      keyword: opts.keyword ?? parsed.keyword,
      countries: opts.country ? String(opts.country).split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
      engine: opts.engine,
      max: opts.max,
      deep: opts.deep,
      headless: !opts.headed,
      onProgress: (m) => console.error(`… ${m}`),
    });
    if (opts.json) {
      console.log(JSON.stringify(scan, null, 2));
      return;
    }
    const q = scan.query.advertiser ?? scan.query.companyId ?? scan.query.keyword;
    console.log(`\n${q} — ${scan.fetched} ads via ${scan.engine}${scan.totalReported ? ` (library reports ${scan.totalReported} total)` : ""}`);
    if (scan.note) console.log(scan.note);
    console.log("");
    scan.ads.forEach((a, i) => {
      const d = a.detail;
      const sponsor = a.promotedBy ? ` [${a.promotedBy}]` : "";
      const fmt = (d?.format ?? a.format) ? ` {${d?.format ?? a.format}}` : "";
      const ran = d?.ranFrom ? `  ran ${d.ranFrom}${d.ranTo && d.ranTo !== d.ranFrom ? `→${d.ranTo}` : ""}` : "";
      const impr = d?.totalImpressions ? `  impr ${d.totalImpressions}` : "";
      const geo = d?.impressionsByCountry?.length ? `  geo ${d.impressionsByCountry.slice(0, 3).map((c) => `${c.country} ${c.share}`).join(", ")}` : "";
      console.log(`${String(i + 1).padStart(2)}. ${a.advertiser}${sponsor}${fmt}${ran}${impr}${geo}`);
      const copy = (a.commentary ?? "").replace(/\s+/g, " ").trim();
      if (copy) console.log(`    “${copy.slice(0, 180)}${copy.length > 180 ? "…" : ""}”`);
      if (d?.targeting?.length) {
        const tg = d.targeting
          .map((t) => `${t.facet}: ${[...t.included, ...t.excluded.map((e) => `-${e}`)].join("/")}`)
          .join("  ·  ");
        console.log(`    🎯 ${tg}`);
      }
      console.log(`    ${a.detailUrl}`);
    });
    console.log(`\nReview the copy + formats + targeting + cadence above to synthesize messaging themes and how this account is run.`);
  });

program
  .command("launch")
  .description("Launch a draft campaign from a brief JSON file")
  .requiredOption("-b, --brief <path>", "Path to a LaunchFromBrief JSON file")
  .action(async (opts) => {
    const { readFile } = await import("node:fs/promises");
    const input = JSON.parse(await readFile(opts.brief, "utf8"));
    if (!input.accountId) input.accountId = await requireDefaultAccountId();
    const liads = await createLiads();
    const res = await launchFromBrief(liads, input);
    console.log("Created (all DRAFT):");
    console.log(`  Campaign group: ${res.campaignGroupId}`);
    console.log(`  Campaign:       ${res.campaignId}`);
    console.log(`  Creatives:      ${res.creativeIds.join(", ") || "(none)"}`);
    console.log(`  Review: ${res.links.campaign}`);
    res.warnings.forEach((w: string) => console.warn(`! ${w}`));
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
