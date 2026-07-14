# Liam

**Liam** is an ad manager for LinkedIn (LinkedIn Ad Manager). Create campaigns by talking
to Claude (MCP) or from a CLI. Built for go-to-market teams who want to spin up many
campaigns from a contact list and a brief, then add creative images themselves. Everything
is created as a **draft**, so nothing spends until you explicitly activate it in Campaign
Manager.

> Unofficial and not affiliated with or endorsed by LinkedIn.

> Covers creation, matched audiences (including building one straight from Salesforce),
> conversion selection, performance reporting/insights, competitor ad intelligence, and a
> change journal with before/after lift. See [ROADMAP.md](./ROADMAP.md) for what's shipped
> and what's planned next.

## What you can do with it

Once Liam is connected, you talk to your assistant in plain language. Real requests it
handles today, roughly in the order a campaign comes together:

- "How many VPs of demand gen at US SaaS companies can we reach?" (resolves targeting
  facets, estimates reach before any money is involved)
- "Upload this CSV as a matched audience." (auto-cleans columns, hashes emails, converts
  company domains to URLs)
- "Build an audience from Salesforce: every contact on an account flagged as a target."
  (SOQL straight to a matched audience)
- "Launch a draft campaign for that audience, $100/day, tracking the demo-booked
  conversion." (campaign group + campaign + draft ads in one call)
- "What ads is HubSpot running right now, and what offers are they pushing?" (reads the
  public Ad Library: copy, formats, and EU targeting metadata for any company)
- "How did retargeting do last month vs the month before?" (trend report with deltas)
- "Which ads should I pause this week?" (account rollup with top/bottom performers and
  flags)
- "Rewrite the copy on the losing ad." (delete + recreate as a fresh draft; LinkedIn
  ignores edits to a live ad's post)
- "Did the new headline actually help?" (change journal + before/after lift)

Liam resolves the details, does the work, and reports back the ids. Every capability is
also a `liam` CLI command for scripted or batch use.

### Put it on a loop

Liam has no scheduler of its own, and doesn't need one: the client you drive it from does.
Some loops that work well:

- "Every Monday at 9am, pull last week's performance summary, compare it to the week
  before, and flag anything that moved more than 20%." (a Claude Code scheduled agent)
- "Every Friday, check what new ads our top three competitors shipped this week and
  summarize the angles."
- "Check the audience match status every few hours and tell me when it clears 300
  members." (the minimum for a matched audience to serve)
- Or skip the assistant entirely and put the CLI in cron:
  `0 9 * * 1 liam report summary -p last_7_days`

## Hierarchy mapping (LinkedIn differs from Google/Meta)

| Common term | LinkedIn entity    | Holds                                    |
| ----------- | ------------------ | ---------------------------------------- |
| Campaign    | **Campaign Group** | status, total/shared budget              |
| Ad group    | **Campaign**       | targeting, budget, bid, schedule, format |
| Ad          | **Creative**       | the rendered ad (`status: DRAFT`)        |
| Audience    | **DMP Segment**    | attached to a Campaign's targeting       |

## Packages

- `@liads/core` — LinkedIn REST client, OAuth, resource modules, CSV + SHA256 hashing, Salesforce reader.
- `@liads/mcp` — MCP server (stdio for local; reused by the hosted app). **Primary interface.**
- `@liads/cli` — the `liam` CLI over the same core, for scripted batch runs.
- `@liads/web` — Next.js app that hosts the MCP over HTTP on Vercel.

## How it works

Both interfaces are thin layers over the same engine. Every MCP tool and CLI command builds
a client via `createLiads()` (`core/src/client.ts`), which loads config plus an
auto-refreshing OAuth token provider, then calls a typed resource module
(`campaigns.ts`, `audience.ts`, `report.ts`, ...) that wraps LinkedIn's versioned REST API
(`LinkedIn-Version` pinned in config). Input shapes live as zod schemas in
`core/src/schemas.ts` and are reused verbatim as the MCP tool input schemas, so the CLI and
MCP can never drift apart.

The draft-only safety rule is enforced at creation: campaign groups, campaigns, and
creatives are all written with `DRAFT` status, and there is deliberately no "activate"
tool or command. Every write also passes through one HTTP chokepoint that appends to a
local change journal (`~/.liads/changelog.jsonl`) for later lift analysis.

[AGENTS.md](./AGENTS.md) has the full architecture notes and the LinkedIn API gotchas
(restli encoding, required fields, DMP audience flow) learned from live testing.

## Install

There are two ways to install Liam:

1. **[As an MCP server](#option-1-install-as-an-mcp-server)**, registered with Claude
   Code, Claude Desktop, Cursor, or any MCP client, so you create campaigns by talking
   to your assistant.
2. **[As a terminal CLI](#option-2-install-the-terminal-cli)**, a global `liam` command
   for running everything from your terminal, scripts, or cron.

Both run against **your own LinkedIn developer app**, so your credentials and your ad
account stay yours. Both share the same first two steps: create a LinkedIn app (step 0)
and build + authenticate (step 1). After that, pick your path, or do both; they read the
same `~/.liads` credentials.

### Step 0: create a LinkedIn app (once)

1. Create an app at https://www.linkedin.com/developers/apps. It must be associated
   with your company's LinkedIn Page.
2. On the **Products** tab, request access:

   | Product | Needed for | Required? |
   | --- | --- | --- |
   | Advertising API | campaigns, ads, targeting, reporting, conversions | **Yes** |
   | Audiences | uploading CSV contact/company lists as matched audiences | Only for audience upload |
   | LinkedIn Ad Library | competitor ad metadata via the official API | Optional (the browser scraper works without it) |

3. On the **Auth** tab, add `http://localhost:53682/callback` as an authorized redirect
   URL, and note your **Client ID** and **Client Secret**.
4. Once the Advertising API is approved, map your ad account under
   **Products → Advertising API → View Ad Accounts**. Skip this and `accounts list`
   comes back empty.

**OAuth scopes.** `liam auth login` requests `rw_ads` (create and edit campaigns),
`r_ads_reporting` (reporting), `rw_conversions` (conversion tracking), and
`w_organization_social` (image ads create a post owned by your LinkedIn Page). If you add
a product or scope later, run `auth login` again; a token refresh keeps only the scopes
you originally granted.

### Step 1: build and authenticate (once, both paths)

Requires git, Node.js 20+, and pnpm.

```bash
git clone https://github.com/stan-default/liam.git
cd liam
pnpm install && pnpm -r build

# App credentials (alternatively set LIADS_CLIENT_ID / LIADS_CLIENT_SECRET env vars)
mkdir -p ~/.liads
echo '{ "clientId": "...", "clientSecret": "...", "linkedinVersion": "202605" }' > ~/.liads/config.json

node packages/cli/dist/index.js auth login      # opens the browser; tokens land in ~/.liads
node packages/cli/dist/index.js accounts list   # verify, then set defaultAccountId in config.json
```

### Option 1: install as an MCP server

Register the server with your MCP client; it reads the `~/.liads` credentials from step 1.

**Claude Code**

```bash
claude mcp add liam -- node /abs/path/liam/packages/mcp/dist/index.js
```

**Claude Desktop, Cursor, or any MCP client**, in its MCP config JSON:

```json
{
  "mcpServers": {
    "liam": { "command": "node", "args": ["/abs/path/liam/packages/mcp/dist/index.js"] }
  }
}
```

Ask for something read-only to confirm it works: "List my ad accounts" or "How did my
account do in the last 30 days?"

**Hosted on Vercel (optional, single-tenant).** Run the MCP server in the cloud so it
works from clients that can't spawn local processes:

1. Get your env values locally: `node packages/cli/dist/index.js auth export`.
2. Deploy `apps/web` to Vercel (set the project **Root Directory** to `apps/web`).
3. In Vercel project settings, add the env vars from `.env.example`
   (`LIADS_CLIENT_ID`, `LIADS_CLIENT_SECRET`, `LIADS_REFRESH_TOKEN`, `LIADS_LINKEDIN_VERSION`,
   and a strong `MCP_AUTH_TOKEN`).
4. Your MCP endpoint is `https://<your-app>.vercel.app/api/mcp`. Connect with the secret
   in the header:

```bash
claude mcp add --transport http liam https://<your-app>.vercel.app/api/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
# or, for clients without native HTTP transport:
npx mcp-remote https://<your-app>.vercel.app/api/mcp --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

The scraper engine for competitor ads needs a local browser, so it stays local-only; the
hosted server uses the official Ad Library API engine.

### Option 2: install the terminal CLI

Step 1 already left a working CLI at `node packages/cli/dist/index.js`. To get a global
`liam` command instead of the long `node` path:

```bash
cd packages/cli && pnpm link --global
liam accounts list
```

(No pnpm link? An alias works too: `alias liam="node /abs/path/liam/packages/cli/dist/index.js"`.)

A sensible first session:

```bash
liam targeting search titles "demand generation"   # resolve targeting URNs
liam report summary -p last_30_days                # account rollup + flags
liam launch --brief examples/brief.json            # creates DRAFTS only
```

The full [CLI reference](#cli-reference) is below.

### Or paste this prompt and let your assistant do the setup

Copy the whole block into Claude (or any capable assistant with terminal access) and it
will walk you through everything above, one step at a time:

```text
You are helping me set up Liam, an open-source LinkedIn Ad Manager from
https://github.com/stan-default/liam. It runs locally as an MCP server and a CLI.
Everything it creates on LinkedIn is a draft, so nothing spends money until I
activate it myself in Campaign Manager.

Walk me through the setup one step at a time. Run commands for me where you can,
show me exactly what to click where you cannot, and wait for my confirmation
before moving to the next step.

1. Check that git, Node.js 20 or newer, and pnpm are installed. Help me install
   whatever is missing.
2. Clone https://github.com/stan-default/liam and run "pnpm install" then
   "pnpm -r build" in the repo root.
3. Help me create a LinkedIn developer app at
   https://www.linkedin.com/developers/apps (it must be associated with my
   company's LinkedIn Page):
   a. On the Products tab, request access to the "Advertising API" product.
      This is the only required product; approval can take a while.
   b. Optional: also request "Audiences" if I want to upload CSV contact or
      company lists as matched audiences.
   c. Optional: also request "LinkedIn Ad Library" if I want competitor ad
      metadata through the official API.
   d. On the Auth tab, add http://localhost:53682/callback as an authorized
      redirect URL, and show me where the Client ID and Client Secret live.
4. Create ~/.liads/config.json containing my clientId, clientSecret, and
   "linkedinVersion": "202605".
5. Run "node packages/cli/dist/index.js auth login". My browser opens LinkedIn's
   consent screen; after I approve, tokens are stored in ~/.liads/credentials.json.
6. Verify with "node packages/cli/dist/index.js accounts list". If no accounts
   show up, remind me to map my ad account in the Developer Portal under
   Products > Advertising API > View Ad Accounts. Then set my account id as
   "defaultAccountId" in ~/.liads/config.json.
7. Register the MCP server with the assistant I use:
   - Claude Code: claude mcp add liam -- node <abs repo path>/packages/mcp/dist/index.js
   - Claude Desktop or another client: add {"command": "node", "args":
     ["<abs repo path>/packages/mcp/dist/index.js"]} under mcpServers in its config.
8. Confirm the tools load, then show me one read-only call working, for example
   list_ad_accounts or a last_30_days performance summary.

If any step fails, show me the exact error and fix it with me before moving on.
```

## Tools (MCP)

- **Accounts:** `list_ad_accounts`
- **Targeting:** `list_targeting_facets`, `search_targeting` (typeahead a facet for entity URNs),
  `list_facet_entities`, `estimate_audience` (structured spec). Talk in plain language
  ("VPs of demand gen at SaaS companies in the US") and Liam resolves the facets, estimates
  reach, then builds the campaign.
- **Audiences:** `upload_audience_csv` (auto-cleans the CSV: normalizes column names, drops
  non-matcher columns, hashes emails, converts company domains to website URLs; supports both
  contact and company lists), `audience_from_salesforce` (SOQL → matched audience), `get_audience_status`
- **Conversions:** `list_conversions` (select an existing insight-tag conversion to track).
  `create_campaign` and `launch_from_brief` accept `conversionIds` or `conversionName`, and
  fall back to `defaultConversionName` from config.
- **Campaigns:** `create_campaign_group`, `create_campaign`, `create_text_ad`, `create_image_ad`;
  `list_campaigns` (the account structure — campaign groups and their ad groups, **drafts
  included**, unlike reporting which only shows entities with spend), `list_ads`, `delete_ad`
  (removes the creative and best-effort its Direct Sponsored Content post). LinkedIn's editor
  ignores post edits on a live ad, so to change copy you recreate: `delete_ad` + `create_image_ad`.
- **Orchestrator:** `launch_from_brief` (audience + group + campaign + draft creatives in one call)
- **Reporting:** `performance_summary` (account rollup + top/bottom + flags), `get_performance`
  (per-entity KPIs at any level), `performance_trend` (weekly/monthly with deltas). KPIs: CTR,
  CPC, CPM, CPL, conversion rate, cost per conversion. Levels: campaign_group → campaign → creative.
- **Competitor intel:** `inspect_competitor_ads` — read any company's ads from the LinkedIn Ad
  Library (no ad-account access needed). The **official Ad Library API** (`GET /rest/adLibrary`,
  requires the "LinkedIn Ad Library" product grant) returns structured metadata — advertiser, payer,
  format, and for EU-served ads run dates, impression ranges, per-country split, and targeting facets —
  but no creative. A **Playwright scraper** of the public library supplies the ad copy/image. Engines
  (`engine`): `api` (metadata only, fast, works hosted), `scraper` (copy via browser, local, supports
  company-id), and `auto` (default — API metadata + copy layered from each ad's detail page, falling
  back to the scraper if the API isn't provisioned). Search by `advertiser` name or `keyword` (the API
  has no company-id or date filter). CLI: `liam competitor ads`.
- **Change journal & lift:** `log_ad_change` (record a change), `list_ad_changes`, `compute_lift`
  (before-vs-after performance for each recorded change). Liam auto-journals every change it makes;
  see [Change journal & lift](#change-journal--lift) below.

### Targeting spec

Structured targeting uses short facet names mapped to entity URNs (resolve URNs with
`search_targeting`). URNs within a facet are ORed; facets are ANDed; excluded facets are ORed.

```json
{ "include": { "locations": ["urn:li:geo:103644278"], "seniorities": ["urn:li:seniority:7"], "titles": ["urn:li:title:26587"] },
  "exclude": { "industries": ["urn:li:industry:47"] } }
```

## CLI reference

All commands also work via `node packages/cli/dist/index.js <cmd>`.

```
liam auth login                         # OAuth, stores tokens in ~/.liads
liam auth export                        # print env vars for the hosted (Vercel) server
liam accounts list                      # list accessible ad accounts
liam targeting search <facet> <query>   # typeahead a facet for entity URNs
liam targeting estimate <facet> <urns…> # audience size for one facet's URNs
liam audience upload -n <name> -f <csv> # clean + upload a CSV as a matched audience
liam audience upload -n <name> -f <csv> --dry-run   # preview the cleaned CSV, no upload
liam audience from-salesforce -n <name> -q "<SOQL>"   # Salesforce query -> matched audience
liam audience status <segmentId>        # matching status + resolved size
liam conversions list                   # account conversions (pick one to track)
liam campaigns list [--group <id>] [--all]   # campaign groups + ad groups, drafts included
liam ad list <campaignId>               # ads in an ad group (id, status, name), drafts included
liam ad delete <creativeId>             # delete an ad (creative + its DSC post)
liam report summary [-p <period>]       # account rollup: totals, top performers, flags
liam report perf <level> [--parent <id>] # per-entity KPI rows
liam report trend <level> <id> [-b weekly|monthly]  # trend with deltas
liam launch --brief <brief.json>        # audience + group + campaign + draft creatives
liam competitor ads <advertiser>        # any company's ads from the public Ad Library
                                        #   <advertiser> = name, company id, or company URL
                                        #   -k <keyword> -c <countries> -e auto|api|scraper -m <max> --json
liam changelog list [-t <type>] [-i <id>]           # recorded ad changes, newest first
liam changelog add -t <type> -i <id> -f <field> --after <v> [-l <label>]   # log a change made elsewhere
liam lift <level> <id> [-w <days>]      # before-vs-after performance for each recorded change
```

Periods: `last_7_days`, `last_30_days`, `last_90_days`, `month_to_date`, `last_month`.

`--account` defaults to `defaultAccountId` from config where applicable.

## Change journal & lift

Liam keeps an append-only journal of every change made to an ad entity so you can measure the
**lift** of a change: how performance differed in the window before it versus after.

- **Where it lives:** `~/.liads/changelog.jsonl` (one JSON object per line). It's a plain local
  file — no database, no account, no setup. Override the path with `LIADS_CHANGELOG_PATH`.
- **Auto-capture:** every create/update Liam makes to a campaign group, campaign, or creative is
  journaled automatically (captured at the one HTTP chokepoint, so it can't be forgotten).
- **Manual entries:** log changes made outside Liam (e.g. in Campaign Manager), or attach a
  hypothesis, with `liam changelog add` / the `log_ad_change` tool. Use `-l/--label` to name the
  test (e.g. `"outcome-led headline test"`) and `--tags` to group related changes.
- **Lift:** `liam lift <level> <entityId>` (or `compute_lift`) reads the journal for that entity
  and, for each change, compares the `--window` days before (default 14) against the same window
  after, reporting before/after KPIs and per-metric deltas (CTR, CPC, conversion rate,
  cost-per-conversion, …). Recent changes get a clamped, `partial` after-window.

This is a **directional pre/post comparison, not a controlled experiment** — it's confounded by
seasonality, the LinkedIn learning phase after an edit, and any concurrent budget change. Read the
deltas as a signal, not proof. Set `LIADS_NO_CHANGELOG=1` to disable auto-capture; journaling is
also off on hosted deploys (read-only filesystem).

## Configuration

Local config lives in `~/.liads/config.json` (mode 0600, never in the repo):

| Field | Purpose |
| --- | --- |
| `clientId`, `clientSecret` | LinkedIn app credentials (or `LIADS_CLIENT_ID`/`LIADS_CLIENT_SECRET`) |
| `linkedinVersion` | Pinned API version, e.g. `202605` |
| `defaultAccountId` | Ad account used when a command/brief omits one |
| `defaultConversionName` | Conversion auto-selected for new campaigns when none is given |
| `mcpAuthToken` | Bearer secret for the hosted MCP endpoint |

Hosted equivalents are the `LIADS_*` env vars plus `MCP_AUTH_TOKEN` (see `.env.example`).
OAuth tokens are stored separately in `~/.liads/credentials.json`.

## Salesforce integration

Liam reads Salesforce by shelling out to the authenticated `sf` CLI (`sf data query`), so it
reuses your existing login and needs no new credentials. `audience_from_salesforce` (and
`liam audience from-salesforce`) take a SOQL query that selects an email column and turn the
result into a matched audience, closing the loop from "accounts flagged in Salesforce" to
"LinkedIn targeting." Example:

```
liam audience from-salesforce -n "Q3 target accounts" \
  -q "SELECT Email FROM Contact WHERE Account.Target_List__c = true AND Email != null"
```

## Safety

- Every campaign/creative is created **DRAFT/PAUSED**. Activation is a separate, explicit step.
- Matched-audience matching takes up to 48h, and a campaign needs ~300 matched members to serve.
- LinkedIn does not expose person-level ad-view data; cross-referencing is account/segment-level.
- Secrets never enter the repo. Local: `~/.liads`. Hosted: Vercel env vars.

## License

MIT
