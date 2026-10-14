import type { HeatmapInsightFinding } from '../../heatmaps/interfaces';
import type {
  MetricValue,
  Recommendation,
  RecommendationCandidate,
  RecommendationSource,
  RecommendationStatus,
  RecommendationTarget,
  ResourceRef,
  StoredImpact,
  TargetMetric,
} from './types';

/** Where recommendations are kept. A port so the service is tested without a database. */
export interface RecommendationRepository {
  /**
   * Insert new candidates and refresh ones already stored: an open (or expired) row gets the newest
   * wording and `last_seen_at`; a dismissed one only once it has been dismissed for longer than
   * `dismissedBefore`; an applied or measured one is left alone.
   */
  upsertCandidates(
    websiteId: string,
    candidates: RecommendationCandidate[],
    opts: { now: Date; dismissedBefore: Date },
  ): Promise<{ inserted: number; refreshed: number }>;

  /** Open rows no source has suggested since `cutoff` become `expired`. Returns how many. */
  expireStale(cutoff: Date): Promise<number>;

  list(websiteId: string, opts: { statuses?: RecommendationStatus[]; limit: number }): Promise<Recommendation[]>;

  get(websiteId: string, id: string): Promise<Recommendation | null>;

  /** Move a row from one of `from` to `to`. `null` when it is not on this site or not in `from`. */
  transition(websiteId: string, id: string, from: RecommendationStatus[], to: RecommendationStatus, at: Date): Promise<Recommendation | null>;

  /**
   * Mark an open (or expired) row applied. Conditional on that status, so two confirms cannot both
   * claim it and a dismissed or already-applied row is not overwritten. `null` when nothing matched.
   */
  markApplied(input: {
    websiteId: string;
    id: string;
    userId: string;
    via: 'proposal' | 'manual';
    resource: ResourceRef | null;
    queryId: string | null;
    at: Date;
  }): Promise<Recommendation | null>;

  /** Record a change made through the assistant with no recommendation behind it, already applied. */
  insertApplied(input: {
    websiteId: string;
    source: RecommendationSource;
    sourceRef: string | null;
    dedupeKey: string;
    title: string;
    rationale: string;
    target: RecommendationTarget;
    metric: TargetMetric;
    userId: string;
    resource: ResourceRef | null;
    queryId: string | null;
    at: Date;
  }): Promise<Recommendation | null>;

  /** Store the before-reading and move the row on to `measuring`. */
  saveBaseline(id: string, baseline: MetricValue | null, at: Date): Promise<void>;

  /** Store the after-readings; `measured` once the last checkpoint is in. */
  saveImpact(id: string, impact: StoredImpact, status: RecommendationStatus, at: Date): Promise<void>;

  /** Applied and measuring rows across every site, oldest change first. */
  listToMeasure(limit: number): Promise<Recommendation[]>;

  /** Stored heatmap wording for a site's pages created since `since` (AI-owned `ai_heatmap_insights`). */
  recentHeatmapFindings(websiteId: string, since: Date): Promise<Array<{ pagePath: string; device: string; findings: HeatmapInsightFinding[] }>>;
}
