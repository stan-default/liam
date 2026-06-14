#!/usr/bin/env node
import { Command } from "commander";
import {
  login,
  exportHostedEnv,
  createLiads,
  listAdAccounts,
  uploadAudienceFromCsv,
  getDmpSegment,
  launchFromBrief,
  requireDefaultAccountId,
} from "@liads/core";

const program = new Command();
program.name("liads").description("LinkedIn ads automation CLI").version("0.1.0");

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
  .description("Upload a CSV of emails as a DMP segment")
  .option("-a, --account <id>", "Ad account id (defaults to config defaultAccountId)")
  .requiredOption("-n, --name <name>", "Audience name")
  .requiredOption("-f, --csv <path>", "CSV file path")
  .option("-c, --email-column <col>", "Email column header", "email")
  .action(async (opts) => {
    const liads = await createLiads();
    const res = await uploadAudienceFromCsv(liads.client, {
      accountId: opts.account ?? (await requireDefaultAccountId()),
      name: opts.name,
      csvPath: opts.csv,
      emailColumn: opts.emailColumn,
    });
    console.log(`Segment ${res.segmentId} (${res.adSegmentUrn})`);
    console.log(`Uploaded ${res.uploaded} hashed emails (${res.skipped} skipped of ${res.totalRows} rows).`);
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
