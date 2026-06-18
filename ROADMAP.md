# Roadmap

Where Liam is and where it could go. Maintained by Stan (Head of Growth at Default).
Liam is an MCP server and CLI for creating and optimizing LinkedIn ads. This is a living
list of ideas, not a committed schedule. Everything Liam does keeps the safety rule: it
creates drafts, and nothing spends until you activate it.

## Shipped

- **Campaign creation** — campaign groups, campaigns, and draft creatives (text + single-image
  sponsored content), with every required LinkedIn field handled.
- **Smarter targeting** — natural language to LinkedIn facets (titles, seniority, industry,
  company size, skills), with live audience-size estimates.
- **Audiences** — CSV upload with automatic cleaning (column-name normalization, drop
  non-matcher columns, domains to website URLs), contact and company lists, plus
  build-an-audience-straight-from-Salesforce.
- **Conversions** — select an existing insight-tag conversion (e.g. Meeting Booked) when
  creating a campaign; never creates conversions.
- **Reporting and insights** — per-level performance (account, campaign group, campaign,
  creative), weekly/monthly trends with deltas, derived KPIs (CTR, CPC, CPM, CPL, conversion
  rate, cost per conversion), and heuristic flags.
- **Competitor ad intelligence** — read any company's live and recent ads from the LinkedIn Ad
  Library (no ad-account access needed). The official Ad Library API (`GET /rest/adLibrary`, verified
  live) returns structured metadata — advertiser, payer, format, and for EU-served ads run dates,
  impression ranges, per-country split, and targeting facets — but no creative; a Playwright scraper of
  the public library layers in the ad copy/image. Engines `api` / `scraper` / `auto` (default: API
  metadata + copy from each ad's detail page, scraper fallback if unprovisioned). Synthesize messaging
  themes and how the account is run from the result. CLI `competitor ads`, MCP `inspect_competitor_ads`.
- **Delivery** — local CLI, local MCP server, and a single-tenant hosted MCP on Vercel.

## Planned

### Optimization and insights

- **Salesforce ↔ LinkedIn outcome cross-reference** (next up). Join LinkedIn conversions to
  Salesforce opportunities at the account level: which targeted/converted accounts became real
  pipeline, and what the LinkedIn spend per closed-won looks like. Honest caveat: LinkedIn gives
  no person-level ad-view data, so the join is account/segment level.
- **Recommendations engine** ("what should I do"). Turn the reporting + flags into a ranked
  action list: shift budget from high-cost-per-conversion prospecting into efficient retargeting,
  pause spend-with-no-conversions lines, scale the cheap winners. Grounded in real findings (e.g.
  the 12-month read where retargeting converted at ~$95 while persona prospecting ran $2K+).
- **Demographic breakdowns**. Pivot reporting by member industry, seniority, job title, and
  company size to answer "which titles and industries actually convert," not just which campaigns.
- **Creative fatigue detection**. Track weekly CTR decay per creative and flag fatigue before it
  wastes spend.
- **Budget pacing and projections**. Spend-to-date vs budget over the flight, projected month-end,
  and over/under-pacing alerts.
- **Conversion value / ROAS**. Pull conversion value and tie it to Salesforce pipeline value for a
  true return view, not just cost per action.
- **Frequency and reach**. Surface reach and frequency to catch over-serving the same members.

### Audiences and targeting

- **Dynamic Salesforce audience sync**. A scheduled job that keeps a matched audience in lockstep
  with a flagged Salesforce list, so "accounts marked in Salesforce" stay targeted automatically.
- **Audience management**. List, refresh, and expire DMP segments; report match rates and
  targetable status once segments resolve.
- **More header aliases**. Expand CSV column-name detection as real exports surface new variants.

### Creation and scale

- **Bulk campaign creation** ("mass ads"). Feed a spreadsheet of briefs and fan out many campaigns
  in one run, each with its own audience, targeting, and creative.
- **Richer creatives**. Video, carousel, document, and event ads; lead-gen forms; verified
  image-upload path with previews.
- **A/B testing helper**. Spin up creative or audience variants under a campaign, compare
  performance, and call a winner.
- **Campaign templates / presets**. Save a brief as a reusable template for repeatable launches.

### Automation and delivery

- **Scheduled digests and alerts**. A weekly performance digest and anomaly alerts (week-over-week
  swings, spend-with-no-conversions) posted to Slack or email.
- **Activation workflow with guardrails**. An explicit activate step that shows a budget summary
  and confirms before anything goes live, plus configurable spend caps.
- **Read-only dashboard**. Optional Vercel dashboard to visualize reporting and review drafts,
  for when a chart beats JSON. (CLI/MCP stays the primary interface.)
- **Multi-account support**. Operate across multiple ad accounts with an account switcher.

### Reliability and developer experience

- **Transactional launch**. Clean up the campaign group if a later step fails, so partial
  failures never orphan entities. Add a launch `--dry-run` preview.
- **Friendly error translation**. Map LinkedIn's cryptic field/service errors to plain,
  actionable guidance (we have already collected several common ones).
- **Tests and publishing**. Unit tests for hashing, targeting, URN, and CSV cleaning, run in CI;
  publish the scoped packages so others can `npx` the tool.

## Contributing ideas

Open an issue or a PR that edits this file. Keep entries to a line or two: what it does and why
it matters.
