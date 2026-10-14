/** Recommendations and their impact reports, as `GET /ai/recommendations/:website_id` returns them. */

export type RecommendationSource = 'insight' | 'heatmap' | 'session' | 'assistant';
export type RecommendationStatus = 'open' | 'dismissed' | 'applied' | 'measuring' | 'measured' | 'expired';
export type MetricName = 'bounce_rate' | 'conversion_rate' | 'funnel_conversion' | 'none';
export type Verdict = 'improved' | 'worse' | 'no_change' | 'too_little_data' | 'no_baseline' | 'not_measurable';

export interface RecommendationTarget {
  kind: 'page' | 'funnel' | 'channel' | 'site';
  ref: string | null;
  label: string;
  device?: string;
}

export interface MetricValue {
  /** Percentage 0-100, or null with nothing to divide by. */
  value: number | null;
  numerator: number;
  volume: number;
  from: string;
  to: string;
  event?: string | null;
}

export interface ImpactCheckpoint {
  day: 7 | 14;
  measuredAt: string;
  after: MetricValue | null;
  verdict: Verdict;
  deltaPts: number | null;
  z: number | null;
  automation: { automationId: string; totalExecutions: number; successCount: number; failureCount: number; last30Days: number } | null;
}

export interface ImpactReport {
  recommendationId: string;
  status: 'not_applied' | 'too_early' | 'measuring' | 'measured';
  target: RecommendationTarget;
  metric: { name: MetricName; windowDays: number };
  appliedAt: string | null;
  baseline: MetricValue | null;
  checkpoints: ImpactCheckpoint[];
  verdict: Verdict | null;
  headline: string;
  sentence: string;
  sentenceSource: 'ai' | 'rules';
  automation: ImpactCheckpoint['automation'];
  caveats: string[];
  nextCheckAt: string | null;
}

export interface Recommendation {
  id: string;
  source: RecommendationSource;
  title: string;
  rationale: string;
  /** What "Do it" types into the assistant. Empty for changes made straight from the assistant. */
  prompt: string;
  target: RecommendationTarget;
  metric: { name: MetricName; windowDays: number };
  status: RecommendationStatus;
  appliedAt: string | null;
  appliedVia: 'proposal' | 'manual' | null;
  resource: { resource: string; id: string } | null;
  createdAt: string;
  updatedAt: string;
  report: ImpactReport;
}
