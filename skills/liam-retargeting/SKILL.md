---
name: liam-retargeting
description: Evaluate LinkedIn retargeting with Liam. Finds the retargeting campaigns, compares them against cold prospecting on CTR and cost per lead, ranks them, and diagnoses the usual failure causes (small or stale audiences, fatigue, wrong-funnel creative). Use for "which retargeting campaigns work", "is retargeting worth it", "retargeting vs cold", "audit my retargeting".
---

# Liam: retargeting audit

Retargeting exists to convert warm attention cheaper than cold outreach. The audit
answers: is it actually doing that, which retargeting campaigns earn their budget, and
why the failing ones fail.

## How to reach Liam

Prefer the `liam` MCP tools if they are loaded (`list_campaigns`, `get_performance`,
`performance_trend`, `get_audience_status`). Otherwise the CLI: `liam campaigns list`,
`liam report perf campaign`, `liam audience status <segmentId>`, or
`node <liam-repo>/packages/cli/dist/index.js`. Read-only.

## Step 1: find the retargeting pool

`list_campaigns` for the full tree, then classify campaigns as retargeting by name:
retarget, rtg, remarketing, warm, website visitors, engagers, MQL, customer list, or
similar. Show the user the classified list and let them correct it before judging;
a misclassified pool poisons the whole comparison. Everything not classified as
retargeting and not a draft forms the cold pool.

## Step 2: compare the pools

`get_performance` at `campaign` level, default `last_30_days` (widen to 90 days if
conversions are sparse, and say so). Aggregate each pool: spend, impressions, CTR,
CPC, CPM, conversions, cost per conversion.

Expectations to test against:

- Retargeting CTR should beat cold, often 1.5-2x.
- Retargeting cost per conversion should beat cold. CPM will usually be higher; that
  is fine and worth saying, because small audiences cost more to reach but should
  convert better.
- If retargeting is at or worse than cold on cost per conversion, the audit's job is
  the diagnosis below, not just the number.

Then rank individual retargeting campaigns by cost per conversion, with the usual
floors: no verdict under ~1,000 impressions or on fewer than ~3 conversions.

## Step 3: diagnose the laggards

Work through the usual causes in order:

1. **Audience too small.** A matched audience needs ~300 members to serve at all and
   is unstable below ~1,000. `get_audience_status` on the attached segments.
2. **Audience stale.** Built once and never refreshed; ask when the source list was
   last updated. A retargeting list from two quarters ago is a cold list with better
   branding.
3. **Fatigue.** `performance_trend` weekly: CTR declining multiple consecutive weeks
   on a small audience means the same people are tired of the same ad. Fix is new
   creative (recreate as drafts: `delete_ad` + `create_image_ad`; LinkedIn ignores
   edits to live posts) or a bigger audience.
4. **Wrong-funnel creative.** Warm audiences shown cold-intro messaging waste the
   warmth. Retargeting should carry proof, product, offer, or a direct ask (demo,
   pricing, case study), not "what is <company>".
5. **Double counting.** View-through conversions can flatter retargeting; note it when
   conversion rate looks implausible against clicks.

## Report format

- **Verdict:** is retargeting pulling its weight, in one paragraph with the two
  headline numbers (retargeting vs cold cost per conversion).
- **Pool comparison table:** retargeting vs cold across spend, CTR, CPC, CPM,
  conversions, cost per conversion.
- **Campaign ranking:** each retargeting campaign with its numbers and a keep/fix/kill
  read.
- **Diagnoses:** for each laggard, which failure cause the evidence points to.
- **Actions:** max 4, most valuable first. Liam never activates or pauses campaigns;
  budget and status changes happen in Campaign Manager.
