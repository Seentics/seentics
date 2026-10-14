import { log as baseLog } from '../../../platform/observability/logger';
import type { FrustratedSessionRow } from '../../recordings/interfaces';
import type { InsightLine } from '../insights/types';
import type { AppliedProposal } from '../services/agent/proposal-applier';
import { fromHeatmaps, fromInsight, fromSessions } from './collector';
import { afterWindow, baselineWindow, buildReport, dueCheckpoints, headlineFor, judge, METRIC_LABEL } from './impact';
import { readMetric, type ImpactPorts } from './metrics';
import type { ImpactNarrator } from './narration';
import type { RecommendationRepository } from './repository';
import {
  DISMISS_QUIET_DAYS,
  EXPIRE_AFTER_DAYS,
  type ImpactCheckpoint,
  type ImpactReport,
  type Recommendation,
  type RecommendationCandidate,
  type RecommendationStatus,
  type RecommendationTarget,
  type TargetMetric,
} from './types';

const log = baseLog.child({ category: 'ai_recommendations' });
const DAY_MS = 86_400_000;

/** How far back the collector looks at each source. */
export const SOURCE_DAYS = 7;
/** An insight older than this is not collected from: its suggestions are about a past week. */
const INSIGHT_MAX_AGE_DAYS = 3;
/** Rows the measuring job reads per run. */
const MEASURE_BATCH = 500;

export type RecommendationDeps = {
  repo: RecommendationRepository;
  ports: ImpactPorts;
  sources: {
    /** The newest stored daily insight (this module's own `ai_insights`). */
    latestInsight(websiteId: string): Promise<{ insightDate: string; status: string; lines: InsightLine[] } | null>;
    /** The most frustrated analysed sessions in the window (recordings, through its port). */
    frustratedSessions(websiteId: string, days: number): Promise<FrustratedSessionRow[]>;
  };
  narrator: ImpactNarrator;
  now?: () => Date;
};

export type RecommendationRunStats = {
  sites: number;
  inserted: number;
  refreshed: number;
  expired: number;
  baselines: number;
  measured: number;
  failed: number;
};

export type RecommendationView = Recommendation & { report: ImpactReport };

/**
 * The recommendations loop: collect, act, measure.
 *
 * Collection and measurement run in the daily job; acting happens in requests ("Do it" leads to a
 * confirmed draft, "I did this myself", "Dismiss"). Every transition is conditional on the current
 * status in the repository, so two requests cannot both apply one recommendation.
 */
export class RecommendationService {
  private readonly now: () => Date;

  constructor(private readonly deps: RecommendationDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Candidates from every source for one site. A source that fails is skipped, not fatal. */
  async candidates(websiteId: string): Promise<RecommendationCandidate[]> {
    const now = this.now();
    const out: RecommendationCandidate[] = [];
    const attempt = async (source: string, fn: () => Promise<RecommendationCandidate[]>) => {
      try {
        out.push(...(await fn()));
      } catch (err) {
        log.warn({ msg: 'recommendation_source_failed', source, website_id: websiteId, err: String(err) });
      }
    };
    await attempt('insight', async () => {
      const insight = await this.deps.sources.latestInsight(websiteId);
      if (!insight || insight.status !== 'ready') return [];
      const age = now.getTime() - new Date(`${insight.insightDate}T00:00:00Z`).getTime();
      return age <= INSIGHT_MAX_AGE_DAYS * DAY_MS ? fromInsight(insight) : [];
    });
    await attempt('heatmap', async () =>
      fromHeatmaps(await this.deps.repo.recentHeatmapFindings(websiteId, new Date(now.getTime() - SOURCE_DAYS * DAY_MS))));
    await attempt('session', async () =>
      fromSessions(await this.deps.sources.frustratedSessions(websiteId, SOURCE_DAYS), SOURCE_DAYS));
    return out;
  }

  /** Collect for one site and store, deduplicated. */
  async collect(websiteId: string): Promise<{ inserted: number; refreshed: number }> {
    const found = await this.candidates(websiteId);
    if (!found.length) return { inserted: 0, refreshed: 0 };
    const now = this.now();
    return this.deps.repo.upsertCandidates(websiteId, found, {
      now,
      dismissedBefore: new Date(now.getTime() - DISMISS_QUIET_DAYS * DAY_MS),
    });
  }

  async list(websiteId: string, opts: { statuses?: RecommendationStatus[]; limit?: number } = {}): Promise<RecommendationView[]> {
    const rows = await this.deps.repo.list(websiteId, { statuses: opts.statuses, limit: opts.limit ?? 50 });
    const now = this.now();
    return rows.map((r) => ({ ...r, report: buildReport(r, now) }));
  }

  async get(websiteId: string, id: string): Promise<RecommendationView | null> {
    const row = await this.deps.repo.get(websiteId, id);
    return row ? { ...row, report: buildReport(row, this.now()) } : null;
  }

  /** Dismiss an open suggestion. `null` when it is not open on this site. */
  async dismiss(websiteId: string, id: string): Promise<RecommendationView | null> {
    const row = await this.deps.repo.transition(websiteId, id, ['open', 'expired'], 'dismissed', this.now());
    return row ? { ...row, report: buildReport(row, this.now()) } : null;
  }

  /** "I did this myself": applied with nothing created, and measured like any other. */
  async markDone(websiteId: string, id: string, userId: string): Promise<RecommendationView | null> {
    const row = await this.deps.repo.markApplied({
      websiteId, id, userId, via: 'manual', resource: null, queryId: null, at: this.now(),
    });
    if (!row) return null;
    this.captureBaselineLater(row);
    return { ...row, report: buildReport(row, this.now()) };
  }

  /**
   * A draft was confirmed in the assistant. With a recommendation behind it (and that
   * recommendation open on this site), mark it applied and link what was created. Without one, or
   * when the id does not check out, record the change as its own applied row so it is measured too.
   */
  async recordApplied(e: AppliedProposal): Promise<Recommendation | null> {
    const at = this.now();
    let row: Recommendation | null = null;
    if (e.recommendationId) {
      row = await this.deps.repo.markApplied({
        websiteId: e.websiteId, id: e.recommendationId, userId: e.userId, via: 'proposal',
        resource: e.created, queryId: e.queryId, at,
      });
    }
    if (!row) {
      const { target, metric } = assistantTarget(e);
      row = await this.deps.repo.insertApplied({
        websiteId: e.websiteId,
        source: 'assistant',
        sourceRef: e.queryId,
        dedupeKey: `assistant|${e.queryId}`,
        title: (e.proposal.summary?.title || `New ${e.created.resource}`).slice(0, 120),
        rationale: `Created from the assistant.`,
        target,
        metric,
        userId: e.userId,
        resource: e.created,
        queryId: e.queryId,
        at,
      });
    }
    if (row) this.captureBaselineLater(row);
    return row;
  }

  /**
   * Read the 14 days before the change and store them. Windows are fixed by `applied_at`, so a
   * baseline read later (by the daily job, after a failure here) reads the same days.
   */
  async captureBaseline(rec: Recommendation): Promise<void> {
    if (!rec.appliedAt) return;
    const baseline = rec.metric.name === 'none'
      ? null
      : await readMetric(this.deps.ports, rec, baselineWindow(new Date(rec.appliedAt)));
    await this.deps.repo.saveBaseline(rec.id, baseline, this.now());
  }

  /** Not awaited by the request that applied it: the read can take a moment on a busy site. */
  private captureBaselineLater(rec: Recommendation): void {
    void this.captureBaseline(rec).catch((err) =>
      log.warn({ msg: 'recommendation_baseline_failed', id: rec.id, err: String(err) }));
  }

  /** Take every checkpoint that is due for one row. Returns how many were taken. */
  async measure(rec: Recommendation): Promise<number> {
    if (!rec.appliedAt) return 0;
    const due = dueCheckpoints(rec, this.now());
    if (!due.length) return 0;
    const applied = new Date(rec.appliedAt);
    const checkpoints = [...(rec.impact?.checkpoints ?? [])];
    for (const day of due) {
      const after = rec.metric.name === 'none'
        ? null
        : await readMetric(this.deps.ports, rec, afterWindow(applied, day), rec.baseline?.event ?? null);
      const automation = rec.resource?.resource === 'automation'
        ? await this.deps.ports.automationActivity(rec.websiteId, rec.resource.id).catch(() => null)
        : null;
      const { verdict, deltaPts, z } = judge(rec.metric.name, rec.baseline, after);
      checkpoints.push({ day, measuredAt: this.now().toISOString(), after, verdict, deltaPts, z, automation });
    }
    checkpoints.sort((a, b) => a.day - b.day);
    const latest = checkpoints[checkpoints.length - 1]!;
    const headline = headlineFor(rec, rec.baseline, latest);
    const worded = await this.deps.narrator.word({ headline, verdict: latest.verdict, extra: facts(rec, latest) });
    const done = checkpoints.some((c) => c.day === 14);
    await this.deps.repo.saveImpact(
      rec.id,
      { checkpoints, sentence: worded.sentence, sentenceSource: worded.source },
      done ? 'measured' : 'measuring',
      this.now(),
    );
    return due.length;
  }

  /** Baselines that are missing, then checkpoints that are due, across every site. */
  async measureDue(): Promise<{ baselines: number; measured: number; failed: number }> {
    let baselines = 0;
    let measured = 0;
    let failed = 0;
    for (const rec of await this.deps.repo.listToMeasure(MEASURE_BATCH)) {
      try {
        let current = rec;
        if (rec.status === 'applied') {
          await this.captureBaseline(rec);
          baselines++;
          current = (await this.deps.repo.get(rec.websiteId, rec.id)) ?? rec;
        }
        if (await this.measure(current)) measured++;
      } catch (err) {
        failed++;
        log.warn({ msg: 'recommendation_measure_failed', id: rec.id, err: String(err) });
      }
    }
    return { baselines, measured, failed };
  }

  /** The daily job: collect for each site, expire what went stale, measure what is due. Never throws. */
  async runDaily(websiteIds: string[]): Promise<RecommendationRunStats> {
    const stats: RecommendationRunStats = { sites: 0, inserted: 0, refreshed: 0, expired: 0, baselines: 0, measured: 0, failed: 0 };
    for (const id of websiteIds) {
      try {
        const r = await this.collect(id);
        stats.sites++;
        stats.inserted += r.inserted;
        stats.refreshed += r.refreshed;
      } catch (err) {
        stats.failed++;
        log.warn({ msg: 'recommendation_collect_failed', website_id: id, err: String(err) });
      }
    }
    try {
      stats.expired = await this.deps.repo.expireStale(new Date(this.now().getTime() - EXPIRE_AFTER_DAYS * DAY_MS));
    } catch (err) {
      stats.failed++;
      log.warn({ msg: 'recommendation_expire_failed', err: String(err) });
    }
    try {
      const m = await this.measureDue();
      stats.baselines = m.baselines;
      stats.measured = m.measured;
      stats.failed += m.failed;
    } catch (err) {
      stats.failed++;
      log.warn({ msg: 'recommendation_measure_run_failed', err: String(err) });
    }
    return stats;
  }
}

/** What a change made straight from the assistant is measured by. */
export function assistantTarget(e: Pick<AppliedProposal, 'created' | 'proposal'>): { target: RecommendationTarget; metric: TargetMetric } {
  const title = e.proposal.summary?.title?.trim() || '';
  switch (e.created.resource) {
    case 'funnel':
      return { target: { kind: 'funnel', ref: e.created.id, label: title }, metric: { name: 'funnel_conversion', windowDays: 14 } };
    case 'automation':
      return { target: { kind: 'site', ref: null, label: 'the site' }, metric: { name: 'conversion_rate', windowDays: 14 } };
    default:
      // A goal changes what is measured, not what visitors see: there is no before and after.
      return { target: { kind: 'site', ref: null, label: 'the site' }, metric: { name: 'none', windowDays: 14 } };
  }
}

/** The figures a narrator may quote beyond the headline. */
function facts(rec: Recommendation, c: ImpactCheckpoint): string[] {
  const out: string[] = [];
  if (rec.baseline) out.push(`before: ${rec.baseline.value ?? 'n/a'}% ${METRIC_LABEL[rec.metric.name]} over ${rec.baseline.volume} sessions in the 14 days before`);
  if (c.after) out.push(`after: ${c.after.value ?? 'n/a'}% over ${c.after.volume} sessions in the ${c.day} days after`);
  if (c.automation) out.push(`automation runs: ${c.automation.totalExecutions}, successful actions: ${c.automation.successCount}`);
  return out;
}
