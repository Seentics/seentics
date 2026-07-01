import type { AppConfig } from "../../config";
import { sql } from "../../db";
import { deleteS3Objects, deleteSessionPrefix } from "../../lib/s3";
import type { WebsiteRetentionOverride } from "./overrides";
import { fetchRetentionOverrides } from "./overrides";
import { log as baseLog } from "../../lib/logger";

const log = baseLog.child({ category: "retention" });

export type DataCleanupStats = {
  websitesProcessed: number;
  analyticsGeneralRows: number;
  analyticsFunnelRows: number;
  automationExecutionRows: number;
  replaySessionsPurged: number;
  sessionReplayPgRows: number;
  heatmapPointRows: number;
  heatmapSnapshotRows: number;
  heatmapSnapshotS3Deleted: number;
};

type EffectivePolicy = {
  analyticsDays: number;
  replayDays: number;
  heatmapDays: number;
  funnelAutomationDays: number;
};

function mergePolicy(
  base: AppConfig["dataRetention"],
  uuid: string,
  overrides: Map<string, WebsiteRetentionOverride>,
): EffectivePolicy {
  const o = overrides.get(uuid);
  return {
    analyticsDays: typeof o?.analytics_days === "number" ? o.analytics_days : base.analyticsDays,
    replayDays: typeof o?.replay_days === "number" ? o.replay_days : base.replayDays,
    heatmapDays: typeof o?.heatmap_days === "number" ? o.heatmap_days : base.heatmapDays,
    funnelAutomationDays:
      typeof o?.funnel_automation_days === "number"
        ? o.funnel_automation_days
        : base.funnelAutomationDays,
  };
}

function affectedRows(r: unknown): number {
  if (r && typeof r === "object" && "count" in r && typeof (r as { count: unknown }).count === "number") {
    return (r as { count: number }).count;
  }
  return 0;
}

let cleanupInFlight = false;

/**
 * Deletes aged analytics, funnel events, automation history, replay metadata + S3 bundles,
 * heatmap aggregates, layout snapshots. Merges per-website overrides when a retention URL is configured.
 */
export async function runDataRetentionCleanup(cfg: AppConfig): Promise<DataCleanupStats> {
  const stats: DataCleanupStats = {
    websitesProcessed: 0,
    analyticsGeneralRows: 0,
    analyticsFunnelRows: 0,
    automationExecutionRows: 0,
    replaySessionsPurged: 0,
    sessionReplayPgRows: 0,
    heatmapPointRows: 0,
    heatmapSnapshotRows: 0,
    heatmapSnapshotS3Deleted: 0,
  };

  if (!cfg.dataRetention.enabled) {
    return stats;
  }

  const overrides = await fetchRetentionOverrides(cfg);

  const sites = await sql<{ id: string; site_id: string }[]>`
    SELECT id::text AS id, site_id FROM websites
  `;

  const bucket = cfg.s3.bucket;
  const replayBatch = Math.max(50, Math.min(2000, cfg.dataRetention.replayDeleteBatchSize));

  for (const w of sites) {
    const pol = mergePolicy(cfg.dataRetention, w.id, overrides);
    const now = Date.now();
    const analyticsCut = new Date(now - pol.analyticsDays * 86_400_000);
    const funnelCut = new Date(now - pol.funnelAutomationDays * 86_400_000);
    const replayCut = new Date(now - pol.replayDays * 86_400_000);
    const heatmapCut = new Date(now - pol.heatmapDays * 86_400_000);

    const delFunnel = await sql`
      DELETE FROM analytics_events
      WHERE website_id = ${w.site_id}
        AND event_type IN ('funnel_step', 'funnel_complete')
        AND occurred_at < ${funnelCut}
    `;
    stats.analyticsFunnelRows += affectedRows(delFunnel);

    const delGeneral = await sql`
      DELETE FROM analytics_events
      WHERE website_id = ${w.site_id}
        AND (
          event_type IS NULL
          OR event_type NOT IN ('funnel_step', 'funnel_complete')
        )
        AND occurred_at < ${analyticsCut}
    `;
    stats.analyticsGeneralRows += affectedRows(delGeneral);

    const delAuto = await sql`
      DELETE FROM automation_events AS ae
      USING automations AS a
      WHERE ae.automation_id = a.id
        AND a.website_id = ${w.id}::uuid
        AND ae.created_at < ${funnelCut}
    `;
    stats.automationExecutionRows += affectedRows(delAuto);

    for (;;) {
      const oldSessions = await sql<{ website_id: string; session_id: string }[]>`
        SELECT website_id, session_id
        FROM session_replays
        WHERE sequence = 0
          AND timestamp < ${replayCut}
          AND (website_id = ${w.site_id} OR website_id = ${w.id})
        LIMIT ${replayBatch}
      `;
      if (oldSessions.length === 0) break;

      stats.replaySessionsPurged += oldSessions.length;
      for (const row of oldSessions) {
        try {
          await deleteSessionPrefix(bucket, row.website_id, row.session_id);
        } catch (e) {
          log.warn({ msg: "retention_s3_replay_delete_failed", session_id: row.session_id, err: String(e) });
        }
      }

      await sql.begin(async (tx) => {
        for (const row of oldSessions) {
          const delReplay = await tx`
            DELETE FROM session_replays
            WHERE website_id = ${row.website_id} AND session_id = ${row.session_id}
          `;
          stats.sessionReplayPgRows += affectedRows(delReplay);
        }
      });
    }

    const delHm = await sql`
      DELETE FROM heatmap_points
      WHERE website_id = ${w.id}::uuid
        AND last_updated < ${heatmapCut}
    `;
    stats.heatmapPointRows += affectedRows(delHm);

    const shots = await sql<{ s3_key: string }[]>`
      SELECT s3_key FROM heatmap_page_snapshots
      WHERE website_id = ${w.id}::uuid
        AND updated_at < ${heatmapCut}
    `;
    if (shots.length > 0) {
      const keys = shots.map((s) => s.s3_key).filter(Boolean);
      try {
        await deleteS3Objects(bucket, keys);
        stats.heatmapSnapshotS3Deleted += keys.length;
      } catch (e) {
        log.warn({ msg: "retention_heatmap_snapshot_s3_failed", website_id: w.id, n: keys.length, err: String(e) });
      }
      const delShot = await sql`
        DELETE FROM heatmap_page_snapshots
        WHERE website_id = ${w.id}::uuid
          AND updated_at < ${heatmapCut}
      `;
      stats.heatmapSnapshotRows += affectedRows(delShot);
    }

    stats.websitesProcessed += 1;
  }

  return stats;
}

/** Single-flight wrapper for cron / internal triggers. */
export async function runDataRetentionCleanupSafe(cfg: AppConfig): Promise<DataCleanupStats | null> {
  if (!cfg.dataRetention.enabled) return null;
  if (cleanupInFlight) {
    log.warn({ msg: "retention_already_running" });
    return null;
  }
  cleanupInFlight = true;
  try {
    const started = Date.now();
    const stats = await runDataRetentionCleanup(cfg);
    log.info({ msg: "retention_cleanup_done", ms: Date.now() - started, ...stats });
    return stats;
  } catch (e) {
    log.error({ msg: "retention_cleanup_failed", err: String(e) });
    throw e;
  } finally {
    cleanupInFlight = false;
  }
}
