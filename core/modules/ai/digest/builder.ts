import type { InsightSnapshotData } from "../../analytics/interfaces";
import type { InsightLine } from "../insights/types";

/**
 * The weekly digest: one notice per site, handed to the gateway, which mails it.
 *
 * Core cannot send email, so this file decides only what the email says, and says it as
 * preformatted strings: the gateway renders them as given and does no arithmetic of its own.
 * The shape is a contract with the gateway's `POST /internal/notify` (`weekly_digest`); change
 * it there first.
 */

/** Days in each window: the week reported, and the week it is compared with. */
export const DIGEST_DAYS = 7;
export const MAX_DIGEST_RECIPIENTS = 50;
export const MAX_DIGEST_METRICS = 6;
export const MAX_DIGEST_LINES = 6;

export type DigestSite = {
  id: string;
  name: string;
  domain: string;
  /** The owner first, then members. May repeat; the builder dedupes. */
  userIds: string[];
};

export type DigestMetric = { label: string; value: string; change: string | null };

export type WeeklyDigestNotice = {
  kind: "weekly_digest";
  websiteId: string;
  websiteName: string;
  websiteDomain: string;
  userIds: string[];
  /** UTC calendar days, inclusive: the seven days ending yesterday. */
  periodStart: string;
  periodEnd: string;
  metrics: DigestMetric[];
  lines: Array<{ kind: "finding" | "action"; text: string }>;
};

const DAY_MS = 86_400_000;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Midnight UTC of the day `now` falls on: where the reported week ends (exclusive). */
export function digestWindowEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const count = (n: number) => Math.round(n).toLocaleString("en-US");

/** Relative change, as a whole percent: `+8%`, `-12%`, `0%`. `null` when there is nothing to compare with. */
export function formatChange(cur: number, prev: number): string | null {
  if (!(prev > 0)) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct > 0 ? `+${count(pct)}%` : pct < 0 ? `-${count(-pct)}%` : "0%";
}

/**
 * Change in a rate, in percentage points: `+2.5 pts`. A relative change of a percentage
 * ("bounce rate +6%") reads as points and is not, so rates get points.
 */
export function formatPointChange(cur: number, prev: number, hasPrev: boolean): string | null {
  if (!hasPrev) return null;
  const pts = Math.round((cur - prev) * 10) / 10;
  return pts > 0 ? `+${pts} pts` : pts < 0 ? `-${-pts} pts` : "0 pts";
}

/** `45s`, `2m 34s`, `1h 2m`. */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

/**
 * The notice for one site, or `null` when it had no visitors in either week — an email saying
 * "nothing happened" is one an owner learns to ignore.
 *
 * `now` is when the job runs; the week reported is the seven whole UTC days before it, the same
 * window `snapshot` must have been read over (see `digestWindowEnd`).
 */
export function buildWeeklyDigest(input: {
  site: DigestSite;
  snapshot: Pick<InsightSnapshotData, "traffic" | "conversion">;
  /** The latest insight's lines; empty when there is none. */
  insightLines: ReadonlyArray<Pick<InsightLine, "kind" | "text">>;
  now: Date;
}): WeeklyDigestNotice | null {
  const { site, snapshot, now } = input;
  const t = snapshot.traffic;
  if (!(t.visitors.cur > 0) && !(t.visitors.prev > 0)) return null;

  const bounceCur = ratio(t.bounces.cur, t.sessions.cur) * 100;
  const bouncePrev = ratio(t.bounces.prev, t.sessions.prev) * 100;
  const durCur = ratio(t.durationSec.cur, t.sessions.cur);
  const durPrev = ratio(t.durationSec.prev, t.sessions.prev);

  const metrics: DigestMetric[] = [
    { label: "Visitors", value: count(t.visitors.cur), change: formatChange(t.visitors.cur, t.visitors.prev) },
    { label: "Pageviews", value: count(t.pageviews.cur), change: formatChange(t.pageviews.cur, t.pageviews.prev) },
    {
      label: "Bounce rate",
      value: `${Math.round(bounceCur)}%`,
      change: formatPointChange(bounceCur, bouncePrev, t.sessions.prev > 0 && t.sessions.cur > 0),
    },
    { label: "Avg. session", value: formatDuration(durCur), change: t.sessions.cur > 0 ? formatChange(durCur, durPrev) : null },
  ];
  const conv = snapshot.conversion;
  if (conv && (conv.count.cur > 0 || conv.count.prev > 0)) {
    metrics.push({ label: "Conversions", value: count(conv.count.cur), change: formatChange(conv.count.cur, conv.count.prev) });
  }

  const end = digestWindowEnd(now);
  return {
    kind: "weekly_digest",
    websiteId: site.id,
    websiteName: site.name,
    websiteDomain: site.domain,
    userIds: [...new Set(site.userIds.filter(Boolean))].slice(0, MAX_DIGEST_RECIPIENTS),
    periodStart: dayOf(new Date(end.getTime() - DIGEST_DAYS * DAY_MS)),
    periodEnd: dayOf(new Date(end.getTime() - DAY_MS)),
    metrics: metrics.slice(0, MAX_DIGEST_METRICS),
    lines: input.insightLines
      .filter((l) => (l.kind === "finding" || l.kind === "action") && l.text.trim())
      .slice(0, MAX_DIGEST_LINES)
      .map((l) => ({ kind: l.kind, text: l.text.trim() })),
  };
}
