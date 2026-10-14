import type { InsightSnapshotData } from "../../analytics/interfaces";
import { log as baseLog } from "../../../platform/observability/logger";
import type { InsightLine, StoredInsight } from "../insights/types";
import { DIGEST_DAYS, buildWeeklyDigest, digestWindowEnd, type DigestSite, type WeeklyDigestNotice } from "./builder";

const log = baseLog.child({ category: "ai_digest" });

export type DigestStats = { sent: number; skipped: number; failed: number };

export type DigestRunnerDeps = {
  /** Sites with traffic in the last week, busiest first. */
  listSites(): Promise<string[]>;
  /** Name, domain and the people to mail; `null` when the site is gone. */
  describeSite(websiteId: string): Promise<DigestSite | null>;
  /** This window and the one before it, both ending at `end`. */
  snapshot(websiteId: string, days: number, end: Date): Promise<Pick<InsightSnapshotData, "traffic" | "conversion">>;
  insights: {
    latest(websiteId: string): Promise<StoredInsight | null>;
    /** Today's insight, made now when the daily job has not got to it. */
    generate(websiteId: string): Promise<{ insight: StoredInsight }>;
  };
  /** Hands one notice to the gateway. Throws when it was not accepted. */
  send(notice: WeeklyDigestNotice): Promise<void>;
  now?: () => Date;
  concurrency?: number;
};

/**
 * The lines from the site's insight for today, generating it if the daily job has not; the
 * newest older one if that fails. A digest without lines still goes out: the numbers stand alone.
 */
async function insightLines(deps: DigestRunnerDeps, websiteId: string, today: string): Promise<InsightLine[]> {
  let insight = await deps.insights.latest(websiteId).catch(() => null);
  if (insight?.insightDate !== today) {
    insight = await deps.insights.generate(websiteId).then((r) => r.insight, (err: unknown) => {
      log.warn({ msg: "ai_digest_insight_failed", website_id: websiteId, err: String(err) });
      return insight;
    });
  }
  return insight?.status === "ready" ? insight.lines : [];
}

/**
 * Builds and sends every site's weekly digest, a few sites at a time. A site that fails is
 * logged and counted; it never stops the others, and nothing is thrown out of here.
 */
export async function runWeeklyDigest(deps: DigestRunnerDeps): Promise<DigestStats> {
  const stats: DigestStats = { sent: 0, skipped: 0, failed: 0 };
  const now = (deps.now ?? (() => new Date()))();
  const end = digestWindowEnd(now);
  const today = end.toISOString().slice(0, 10);

  let websiteIds: string[];
  try {
    websiteIds = await deps.listSites();
  } catch (err) {
    log.error({ msg: "ai_digest_sites_failed", err: String(err) });
    return stats;
  }

  let next = 0;
  const worker = async () => {
    while (next < websiteIds.length) {
      const id = websiteIds[next++]!;
      try {
        const site = await deps.describeSite(id);
        if (!site || site.userIds.length === 0) { stats.skipped += 1; continue; }
        const snapshot = await deps.snapshot(id, DIGEST_DAYS, end);
        // Checked before the insight: a quiet site should not cost a model call.
        if (!(snapshot.traffic.visitors.cur > 0) && !(snapshot.traffic.visitors.prev > 0)) { stats.skipped += 1; continue; }
        const lines = await insightLines(deps, id, today);
        const notice = buildWeeklyDigest({ site, snapshot, insightLines: lines, now });
        if (!notice) { stats.skipped += 1; continue; }
        await deps.send(notice);
        stats.sent += 1;
      } catch (err) {
        stats.failed += 1;
        log.error({ msg: "ai_digest_site_failed", website_id: id, err: String(err) });
      }
    }
  };
  const concurrency = Math.max(1, Math.min(deps.concurrency ?? 2, websiteIds.length));
  await Promise.all(Array.from({ length: concurrency }, worker));
  return stats;
}

/**
 * A sender for `runWeeklyDigest`: the gateway's `POST /internal/notify`, the same endpoint and
 * key as the ops alerts (platform/observability/ops-alert.ts).
 */
export function gatewayNotifySender(target: { url: string; apiKey: string }, fetchImpl: typeof fetch = fetch) {
  return async (notice: WeeklyDigestNotice): Promise<void> => {
    const res = await fetchImpl(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": target.apiKey },
      body: JSON.stringify(notice),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`notify returned ${res.status}`);
  };
}
