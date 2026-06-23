import { randomUUID } from "node:crypto";
import { appendFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LIADS_DIR } from "./config.js";
import type { LinkedInClient, MutationEvent } from "./http.js";
import {
  fetchAnalytics,
  type AnalyticsPivot,
  type DateRange,
  type FilterType,
  type LiDate,
} from "./resources/analytics.js";
import { aggregate, normalize, type MetricRow } from "./report.js";

/**
 * Change journal — an append-only, local record of every change made to an ad
 * entity, so a later "lift" report can compare performance before vs. after a
 * change. Stored as JSON Lines at ~/.liads/changelog.jsonl (one event per line):
 * append-only writes are safe across concurrent runs, the file is greppable and
 * diffable, and it needs no database. Changes Liam makes are captured
 * automatically (see `recordMutation`); changes made elsewhere (e.g. in Campaign
 * Manager) can be logged manually with `recordChange`.
 *
 * This is deliberately a local file, not a hosted store, so it works for any
 * open-source user the moment they clone the repo — no account or token to set up.
 */

/** The three ad entities whose changes are worth tracking for lift. */
export type AdEntityType = "campaignGroup" | "campaign" | "creative";

export interface ChangedField {
  field: string;
  /** Prior value, when known (auto-capture of updates doesn't fetch the old value). */
  before?: unknown;
  after: unknown;
}

export interface ChangeEvent {
  /** Stable id for this event. */
  id: string;
  /** ISO 8601 (UTC) timestamp the change took effect. */
  ts: string;
  /** Who/what made the change. */
  source: "liam" | "manual";
  /** create = entity made; update = field(s) changed; note = freeform annotation. */
  kind: "create" | "update" | "note";
  entity: { type: AdEntityType; id: string; name?: string; accountId?: string };
  /** Field-level diffs (for updates). */
  fields?: ChangedField[];
  /** Human-readable one-liner describing the change. */
  summary?: string;
  /** Optional user hypothesis/label (e.g. "outcome-led headline test"). */
  label?: string;
  tags?: string[];
}

/** A change to record — id and ts are filled in by `recordChange` if omitted. */
export type ChangeInput = Omit<ChangeEvent, "id" | "ts"> & { ts?: string };

/* --------------------------------- storage ---------------------------------- */

/** Path to the JSONL journal. Override with LIADS_CHANGELOG_PATH (e.g. for tests). */
export function changelogPath(): string {
  return process.env.LIADS_CHANGELOG_PATH ?? join(LIADS_DIR, "changelog.jsonl");
}

/**
 * Append one change to the journal. Best-effort: a write failure (e.g. a
 * read-only filesystem on a hosted deploy) is swallowed so it never breaks the
 * mutation that triggered it. Returns the stored event (with id + ts filled in).
 */
export async function recordChange(input: ChangeInput): Promise<ChangeEvent> {
  const { ts, ...rest } = input;
  const event: ChangeEvent = { id: `chg_${randomUUID().slice(0, 8)}`, ts: ts ?? new Date().toISOString(), ...rest };
  try {
    const path = changelogPath();
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    /* journal is non-critical; never break the caller */
  }
  return event;
}

export interface ChangeFilter {
  type?: AdEntityType;
  id?: string;
  tag?: string;
  /** ISO timestamps, inclusive bounds. */
  since?: string;
  until?: string;
}

/** Read the journal back, newest first, optionally filtered. Empty if none yet. */
export async function readChanges(filter?: ChangeFilter): Promise<ChangeEvent[]> {
  let raw: string;
  try {
    raw = await readFile(changelogPath(), "utf8");
  } catch {
    return [];
  }
  const events = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as ChangeEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is ChangeEvent => e !== null)
    .filter((e) => {
      if (filter?.type && e.entity.type !== filter.type) return false;
      if (filter?.id && e.entity.id !== filter.id) return false;
      if (filter?.tag && !(e.tags ?? []).includes(filter.tag)) return false;
      if (filter?.since && e.ts < filter.since) return false;
      if (filter?.until && e.ts > filter.until) return false;
      return true;
    });
  return events.sort((a, b) => b.ts.localeCompare(a.ts));
}

/* ------------------------------ auto-capture -------------------------------- */

const COLLECTION_TYPE: Record<string, AdEntityType> = {
  adCampaignGroups: "campaignGroup",
  adCampaigns: "campaign",
  creatives: "creative",
};

const TYPE_LABEL: Record<AdEntityType, string> = {
  campaignGroup: "campaign group",
  campaign: "campaign",
  creative: "creative (ad)",
};

const fmtVal = (v: unknown): string =>
  v === null || v === undefined ? "(none)" : typeof v === "object" ? JSON.stringify(v) : String(v);

/**
 * Translate a raw HTTP write into a structured change event, or null if it isn't
 * one of the three tracked management endpoints. Creates are POSTs to a
 * collection (id comes back in restliId); updates are POSTs to a specific id
 * carrying a `patch.$set`. Anchored on the path tail so sibling endpoints (e.g.
 * conversion association) are ignored.
 */
export function interpretMutation(m: MutationEvent): ChangeInput | null {
  if (m.method === "GET" || m.status >= 300) return null;
  const match = m.path.match(/\/adAccounts\/(\d+)\/(adCampaignGroups|adCampaigns|creatives)(?:\/([^/?]+))?$/);
  if (!match) return null;
  const [, accountId, collection, idSeg] = match;
  const type = COLLECTION_TYPE[collection!]!;
  const body = (m.body ?? {}) as Record<string, any>;

  // Update: PARTIAL_UPDATE patch against an existing entity id.
  const set = body?.patch?.$set as Record<string, unknown> | undefined;
  if (idSeg && set && typeof set === "object") {
    const fields: ChangedField[] = Object.entries(set).map(([field, after]) => ({ field, after }));
    return {
      source: "liam",
      kind: "update",
      entity: { type, id: idSeg, accountId },
      fields,
      summary: fields.map((f) => `${f.field} → ${fmtVal(f.after)}`).join(", "),
    };
  }

  // Create: POST to the collection; the new id arrives in the x-restli-id header.
  if (!idSeg) {
    const id = m.restliId;
    if (!id) return null;
    const name: string | undefined = body?.name ?? body?.creative?.name;
    return {
      source: "liam",
      kind: "create",
      entity: { type, id, name, accountId },
      summary: `Created ${TYPE_LABEL[type]}${name ? ` “${name}”` : ""}`,
    };
  }
  return null;
}

/** The onMutation hook wired into the client: interpret a write and journal it. */
export async function recordMutation(m: MutationEvent): Promise<void> {
  const change = interpretMutation(m);
  if (change) await recordChange(change);
}

/* ---------------------------------- lift ------------------------------------ */

const PIVOT_FILTER: Record<AdEntityType, { pivot: AnalyticsPivot; filterType: FilterType }> = {
  campaignGroup: { pivot: "CAMPAIGN_GROUP", filterType: "campaignGroups" },
  campaign: { pivot: "CAMPAIGN", filterType: "campaigns" },
  creative: { pivot: "CREATIVE", filterType: "creatives" },
};

const dayUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
const toLiDate = (d: Date): LiDate => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
const r4 = (x: number) => Math.round(x * 10000) / 10000;
/** Relative change. Returns +1/-1 sentinels when the baseline is zero but the after isn't. */
const pct = (after: number, before: number) => (before ? r4((after - before) / before) : after ? 1 : 0);

/** The KPIs a lift report compares across a change boundary. */
export const LIFT_METRICS = [
  "impressions",
  "clicks",
  "costUsd",
  "conversions",
  "ctr",
  "cpc",
  "cvr",
  "costPerConversion",
] as const;

export interface LiftWindow {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  days: number;
  /** True when the window was clamped (the change is too recent for a full after-window). */
  partial: boolean;
  metrics: MetricRow;
}

export interface ChangeLift {
  change: ChangeEvent;
  before: LiftWindow;
  after: LiftWindow;
  /** Relative change per metric (e.g. ctr 0.12 = +12%). */
  deltas: Record<string, number>;
}

const isoDay = (d: LiDate) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

async function windowMetrics(
  client: LinkedInClient,
  type: AdEntityType,
  entityId: string,
  range: DateRange,
): Promise<MetricRow> {
  const { pivot, filterType } = PIVOT_FILTER[type];
  const raw = await fetchAnalytics(client, { pivot, timeGranularity: "ALL", dateRange: range, filterType, ids: [entityId] });
  return aggregate(raw.map(normalize));
}

/**
 * For each recorded change to an entity, compare performance in the `windowDays`
 * before the change against the `windowDays` after. The after-window is clamped
 * to today (flagged `partial`) when the change is too recent for a full window.
 *
 * This is a directional pre/post comparison, not a controlled experiment — it is
 * confounded by seasonality, the LinkedIn learning phase after an edit, and any
 * concurrent budget change. Read the deltas as a signal, not proof.
 */
export async function computeLift(
  client: LinkedInClient,
  opts: { type: AdEntityType; entityId: string; windowDays?: number; now?: Date; changes?: ChangeEvent[] },
): Promise<ChangeLift[]> {
  const windowDays = opts.windowDays ?? 14;
  const today = dayUTC(opts.now ?? new Date());
  const changes = opts.changes ?? (await readChanges({ type: opts.type, id: opts.entityId }));

  const results: ChangeLift[] = [];
  for (const change of changes) {
    const changeDay = dayUTC(new Date(change.ts));
    const beforeStart = addDays(changeDay, -windowDays);
    const beforeEnd = addDays(changeDay, -1);
    const fullAfterEnd = addDays(changeDay, windowDays - 1);
    const afterEnd = fullAfterEnd > today ? today : fullAfterEnd;
    const afterDays = Math.max(0, Math.round((afterEnd.getTime() - changeDay.getTime()) / 86400000) + 1);

    const beforeRange: DateRange = { start: toLiDate(beforeStart), end: toLiDate(beforeEnd) };
    const afterRange: DateRange = { start: toLiDate(changeDay), end: toLiDate(afterEnd) };

    const before = await windowMetrics(client, opts.type, opts.entityId, beforeRange);
    const after = afterDays > 0 ? await windowMetrics(client, opts.type, opts.entityId, afterRange) : aggregate([]);

    const deltas: Record<string, number> = {};
    for (const k of LIFT_METRICS) deltas[k] = pct(after[k] as number, before[k] as number);

    results.push({
      change,
      before: { start: isoDay(beforeRange.start), end: isoDay(beforeRange.end), days: windowDays, partial: false, metrics: before },
      after: {
        start: isoDay(afterRange.start),
        end: isoDay(afterRange.end),
        days: afterDays,
        partial: afterDays < windowDays,
        metrics: after,
      },
      deltas,
    });
  }
  return results;
}

/* -------------------------------- helpers ----------------------------------- */

/** Map a report-style level ("campaign_group") or an entity type to AdEntityType. */
export function normalizeEntityType(input: string): AdEntityType {
  switch (input) {
    case "campaign_group":
    case "campaignGroup":
    case "group":
      return "campaignGroup";
    case "campaign":
      return "campaign";
    case "creative":
    case "ad":
      return "creative";
    default:
      throw new Error(`Unknown entity type "${input}". Use campaignGroup | campaign | creative.`);
  }
}
