# AGENTS.md

Guidance for AI agents and contributors working in this repo. Liam is an MCP server
and CLI that creates LinkedIn ad campaigns. Read this before changing code.

## Architecture

pnpm + TypeScript monorepo:

- `packages/core` — the engine. No UI. Owns the LinkedIn REST client, OAuth, every
  resource module, audience hashing, targeting, conversions, and the Salesforce reader.
- `packages/mcp` — MCP server. `src/tools.ts` registers all tools and is shared by the
  stdio entry (`src/index.ts`) and the hosted Vercel route. Add tools in `tools.ts`.
- `packages/cli` — the `liam` CLI (commander) over the same core.
- `apps/web` — Next.js app hosting the MCP over HTTP at `/api/mcp` (Vercel), gated by a
  `MCP_AUTH_TOKEN` bearer.

Data flow: every tool/command builds a client via `createLiads()` (core/client.ts), which
loads config + an auto-refreshing token provider, then calls a resource module. Resource
modules are thin typed wrappers over `LinkedInClient.request()`.

## Conventions

- **Everything is created DRAFT.** Campaigns, campaign groups, and creatives default to
  `DRAFT`/`intendedStatus: DRAFT`. Never change that default. Activation is a separate,
  explicit step.
- **zod schemas are the source of truth.** All tool/command inputs live as zod schemas in
  `core/src/schemas.ts` and are reused as MCP tool input schemas (`Schema.shape`). Add or
  change a field there first, then thread it through the resource module.
- **Secrets never enter the repo.** Local credentials live in `~/.liads/`
  (`config.json` + `credentials.json`, mode 0600). Hosted credentials are `LIADS_*` env
  vars on Vercel. The config layer (core/config.ts) resolves env first, then files.
- **Internal names are frozen.** The package scope `@liads/*`, the `~/.liads` dir, and the
  `LIADS_*` env prefix are intentionally NOT renamed to "liam" (renaming breaks stored
  creds and the deployed Vercel env). The brand "Liam" is visible-surface only.
- Match the surrounding code style. Keep comments at the existing density. No em dashes in
  user-facing strings.

## LinkedIn API gotchas (learned from live testing — do not regress)

- **Versioned REST:** base `https://api.linkedin.com/rest`, headers `LinkedIn-Version`
  (pinned `202605` in config) + `X-Restli-Protocol-Version: 2.0.0`. Created-entity id comes
  back in the `x-restli-id` response header.
- **Account mapping:** development-tier apps must add each ad account in Developer Portal →
  Products → Advertising API → Account Management before they can create campaigns there.
- **Required campaign-group field:** `runSchedule` (even for drafts).
- **Required campaign fields:** `offsiteDeliveryEnabled` (bool) and `politicalIntent`
  (`NOT_POLITICAL` | `POLITICAL` | `NOT_DECLARED`). Both are auto-set.
- **Hierarchy:** Ad Account → Campaign Group → Campaign (targeting/budget/bid) → Creative.
- **Creatives** use the unified API (`content` + `intendedStatus`); single-image Sponsored
  Content is created inline via `?action=createInline`.
- **Audiences (DMP):** list-upload flow only — `generateUploadUrl` → upload hashed CSV to
  the signed URL → create `LIST_UPLOAD` segment → attach list → poll until READY for the
  `adSegment` urn. Emails are SHA256(lowercased, trimmed). `USER_LIST_UPLOAD` requires
  **300+ rows**; matching takes up to 48h. `uploadAudienceFromCsv` deletes the segment if
  the attach fails (no orphans).
- **Audience estimate:** use the `q=targetingCriteriaV2` finder with a restli-encoded
  `targetingCriteria` object (NOT the old dotted `target.includedTargetingFacets...`
  params, which now 400). The HTTP client has a `rawQuery` escape hatch for restli-encoded
  query strings (structure chars literal, URNs percent-encoded).
- **Targeting:** structured `TargetingSpec` = `{ include, exclude }` of short facet name →
  entity URNs. URNs within a facet are ORed; facets ANDed; excludes ORed. Resolve entity
  URNs with `searchTargeting` (typeahead) / `listFacetEntities`.
- **Conversions:** `associatedCampaigns` is READ-ONLY; the writable `campaigns` field is a
  **replace-whole-array** of campaign URNs (no `$add`). To attach a campaign you MUST read
  the conversion's current `campaigns`, append, and `$set` the full list — never drop
  existing associations. Update endpoint: `POST /conversions/{id}?account=<urn>` with
  `X-RestLi-Method: PARTIAL_UPDATE`.
- **Analytics:** use the `q=analytics` finder with `pivot=` (ACCOUNT|CAMPAIGN_GROUP|CAMPAIGN|
  CREATIVE), a `dateRange=(start:(year:..,month:..,day:..),end:(..))`, `timeGranularity`
  (ALL|DAILY|MONTHLY — no native WEEKLY, so bucket daily in code), and a filter
  `accounts|campaignGroups|campaigns|creatives=List(<encoded urns>)`. All restli-encoded, so it
  goes through the client's `rawQuery`. `costInUsd` is a string; metric field names are verified
  in `analytics.ts` DEFAULT_METRIC_FIELDS. Derived KPIs + flags live in `report.ts`.
- **Non-transactional orchestrator:** `launchFromBrief` creates a campaign group before the
  campaign; a later failure can orphan the group. (Cleanup-on-failure is implemented for
  audience upload; campaign-group cleanup is a known TODO.)

## Build / verify

```bash
pnpm install
pnpm -r build        # core must build before cli/mcp/web resolve its dist
pnpm -r typecheck
```

The hosted app auto-deploys on push to `main` (Vercel GitHub integration). Verify a live
change by initializing the MCP endpoint and listing tools (see README).

## Salesforce

`core/src/salesforce.ts` shells out to the authenticated `sf` CLI (`sf data query --json`).
No new credentials; reuses the user's existing `sf` login. Read-only. `audienceFromSalesforce`
turns a SOQL email query into a matched-audience DMP segment (reuses `uploadAudienceFromEmails`).
