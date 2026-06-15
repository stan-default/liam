# Liam

**Liam** is an ad manager for LinkedIn (LinkedIn Ad Manager). Create campaigns by talking
to Claude (MCP) or from a CLI. Built for go-to-market teams who want to spin up many
campaigns from a contact list and a brief, then add creative images themselves. Everything
is created as a **draft**, so nothing spends until you explicitly activate it in Campaign
Manager.

> Unofficial and not affiliated with or endorsed by LinkedIn.

> Performance-insight reporting is on the roadmap. This release covers creation, matched
> audiences (including building one straight from Salesforce), and conversion selection.

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

## Prerequisites (everyone needs their own LinkedIn app)

1. Create a developer app at https://www.linkedin.com/developers/apps and request the
   **Advertising API** product. (The **Audiences** product, needed for CSV audience upload,
   is requested separately.)
2. Add an OAuth **redirect URL** of `http://localhost:53682/callback` for local login.

## Option A — Run locally (self-host, free)

```bash
pnpm install
pnpm -r build

# App credentials (alternatively set LIADS_CLIENT_ID / LIADS_CLIENT_SECRET env vars)
mkdir -p ~/.liads
echo '{ "clientId": "...", "clientSecret": "...", "linkedinVersion": "202605" }' > ~/.liads/config.json

node packages/cli/dist/index.js auth login     # opens browser, stores tokens in ~/.liads
node packages/cli/dist/index.js accounts list   # verify
node packages/cli/dist/index.js launch --brief examples/brief.json
```

Register the local MCP server with Claude (Desktop / Code):

```json
{
  "mcpServers": {
    "liam": { "command": "node", "args": ["/abs/path/linkedin-ads/packages/mcp/dist/index.js"] }
  }
}
```

## Option B — Host the MCP on Vercel (single-tenant, for you)

1. Get your env values locally: `node packages/cli/dist/index.js auth export`.
2. Deploy `apps/web` to Vercel (set the project **Root Directory** to `apps/web`).
3. In Vercel project settings, add the env vars from `.env.example`
   (`LIADS_CLIENT_ID`, `LIADS_CLIENT_SECRET`, `LIADS_REFRESH_TOKEN`, `LIADS_LINKEDIN_VERSION`,
   and a strong `MCP_AUTH_TOKEN`).
4. Your MCP endpoint is `https://<your-app>.vercel.app/api/mcp`.

Connect Claude to the remote server (header carries the secret):

```bash
npx mcp-remote https://<your-app>.vercel.app/api/mcp --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

## Tools (MCP)

- **Accounts:** `list_ad_accounts`
- **Targeting:** `list_targeting_facets`, `search_targeting` (typeahead a facet for entity URNs),
  `list_facet_entities`, `estimate_audience` (structured spec). Talk in plain language
  ("VPs of demand gen at SaaS companies in the US") and Liam resolves the facets, estimates
  reach, then builds the campaign.
- **Audiences:** `upload_audience_csv`, `audience_from_salesforce` (SOQL → matched audience),
  `get_audience_status`
- **Conversions:** `list_conversions` (select an existing insight-tag conversion to track).
  `create_campaign` and `launch_from_brief` accept `conversionIds` or `conversionName`, and
  fall back to `defaultConversionName` from config.
- **Campaigns:** `create_campaign_group`, `create_campaign`, `create_text_ad`, `create_image_ad`
- **Orchestrator:** `launch_from_brief` (audience + group + campaign + draft creatives in one call)

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
liam audience upload -n <name> -f <csv> # CSV of emails -> matched-audience segment
liam audience from-salesforce -n <name> -q "<SOQL>"   # Salesforce query -> matched audience
liam audience status <segmentId>        # matching status + resolved size
liam conversions list                   # account conversions (pick one to track)
liam launch --brief <brief.json>        # audience + group + campaign + draft creatives
```

`--account` defaults to `defaultAccountId` from config where applicable.

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
