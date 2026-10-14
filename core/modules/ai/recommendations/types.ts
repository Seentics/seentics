/**
 * Recommendations: the autopilot loop of suggestion -> action -> measured impact.
 *
 * A recommendation is something the product found worth doing (a daily insight's suggested
 * action, a heatmap fix, a page where recorded sessions show frustration), stored once per site
 * however many days in a row it is suggested. "Do it" opens the assistant with a specific prompt
 * that leads to a draft; confirming that draft marks the recommendation applied and links what was
 * created. "I did this myself" marks it applied with nothing created. Either way the target metric
 * is read over the 14 days before, and again 7 and 14 days after, and the difference is reported
 * with a volume guard and a seasonality caveat rather than claimed as cause.
 */

export const RECOMMENDATION_SOURCES = ['insight', 'heatmap', 'session', 'assistant'] as const;
export type RecommendationSource = (typeof RECOMMENDATION_SOURCES)[number];

export const RECOMMENDATION_STATUSES = ['open', 'dismissed', 'applied', 'measuring', 'measured', 'expired'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const isRecommendationStatus = (v: unknown): v is RecommendationStatus =>
  typeof v === 'string' && (RECOMMENDATION_STATUSES as readonly string[]).includes(v);

export type TargetKind = 'page' | 'funnel' | 'channel' | 'site';

/** What a recommendation is about. `ref` is a path, a funnel id or a channel name; null for the site. */
export type RecommendationTarget = {
  kind: TargetKind;
  ref: string | null;
  /** How the target reads in a sentence: "/pricing", "Mobile visitors", "the Checkout funnel". */
  label: string;
  /** Narrows a site or channel target to one device bucket ("mobile"). */
  device?: string;
};

/**
 * The figure a recommendation is meant to move.
 *
 * - `bounce_rate`: share of sessions with one pageview; for a page target, sessions that entered there.
 * - `conversion_rate`: share of sessions that fired the site's main conversion event.
 * - `funnel_conversion`: the funnel's entries that completed it.
 * - `none`: nothing to measure before and after (setting up an alert, tracking a goal).
 */
export type MetricName = 'bounce_rate' | 'conversion_rate' | 'funnel_conversion' | 'none';

export type TargetMetric = {
  name: MetricName;
  /** Length of the baseline window, in days. */
  windowDays: number;
};

/** Lower is better for bounce; higher for the rest. */
export const LOWER_IS_BETTER: Record<MetricName, boolean> = {
  bounce_rate: true,
  conversion_rate: false,
  funnel_conversion: false,
  none: false,
};

/** One reading of a metric over a window: a percentage, and the counts behind it. */
export type MetricValue = {
  /** Percentage 0-100, or null when there was nothing to divide by. */
  value: number | null;
  /** Bounces, conversions or completions. */
  numerator: number;
  /** Sessions, or funnel entries. */
  volume: number;
  /** ISO 8601 window bounds. */
  from: string;
  to: string;
  /** The conversion event counted, fixed at the baseline so later readings count the same thing. */
  event?: string | null;
};

/** What an automation that was created did, from its own execution log. */
export type AutomationActivity = {
  automationId: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  /** Runs in the last 30 days. */
  last30Days: number;
};

export type Verdict =
  /** Moved the good way, beyond normal variation. */
  | 'improved'
  /** Moved the bad way, beyond normal variation. */
  | 'worse'
  /** Within normal variation for this much traffic. */
  | 'no_change'
  /** Too few sessions (or entries) on one side to say anything. */
  | 'too_little_data'
  /** There was no "before" to compare with (a new funnel, or the baseline could not be read). */
  | 'no_baseline'
  /** The metric is `none`: only the resource's own activity is reported. */
  | 'not_measurable';

export type ImpactCheckpoint = {
  /** Days after `applied_at` the after-window covers. */
  day: 7 | 14;
  measuredAt: string;
  after: MetricValue | null;
  verdict: Verdict;
  /** after - before, in percentage points. Null without both values. */
  deltaPts: number | null;
  /** Two-proportion z statistic; null when not computed. */
  z: number | null;
  automation: AutomationActivity | null;
};

export type StoredImpact = {
  checkpoints: ImpactCheckpoint[];
  /** One plain sentence for the newest checkpoint. */
  sentence: string | null;
  /** `ai`: worded by the model and checked against the numbers. `rules`: from the template. */
  sentenceSource: 'ai' | 'rules' | null;
};

export type ResourceRef = { resource: string; id: string };

export type Recommendation = {
  id: string;
  websiteId: string;
  source: RecommendationSource;
  sourceRef: string | null;
  dedupeKey: string;
  title: string;
  rationale: string;
  prompt: string;
  target: RecommendationTarget;
  metric: TargetMetric;
  status: RecommendationStatus;
  baseline: MetricValue | null;
  appliedAt: string | null;
  appliedBy: string | null;
  appliedVia: 'proposal' | 'manual' | null;
  resource: ResourceRef | null;
  queryId: string | null;
  impact: StoredImpact | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

/** What a source produces: everything a row needs except its lifecycle. */
export type RecommendationCandidate = {
  source: Exclude<RecommendationSource, 'assistant'>;
  sourceRef: string;
  dedupeKey: string;
  title: string;
  rationale: string;
  prompt: string;
  target: RecommendationTarget;
  metric: TargetMetric;
};

/** The report the UI, the assistant and the InsightsCard read. Built from the stored row, never stored. */
export type ImpactReport = {
  recommendationId: string;
  /**
   * - `not_applied`: still a suggestion.
   * - `too_early`: applied less than 7 days ago; nothing measured yet.
   * - `measuring`: the 7-day reading is in, the 14-day one is not.
   * - `measured`: both readings are in.
   */
  status: 'not_applied' | 'too_early' | 'measuring' | 'measured';
  target: RecommendationTarget;
  metric: TargetMetric;
  appliedAt: string | null;
  baseline: MetricValue | null;
  checkpoints: ImpactCheckpoint[];
  /** The newest checkpoint's verdict, or null before there is one. */
  verdict: Verdict | null;
  /** "/pricing: bounce rate −6 pts after 14 days (52% → 46%)". */
  headline: string;
  sentence: string;
  sentenceSource: 'ai' | 'rules';
  automation: AutomationActivity | null;
  /** Shown with every report: what a before/after comparison cannot tell you. */
  caveats: string[];
  /** When the next reading is due, for a report still in progress. */
  nextCheckAt: string | null;
};

export const BASELINE_DAYS = 14;
export const CHECKPOINT_DAYS = [7, 14] as const;
/** An open suggestion the sources stopped making is expired after this long. */
export const EXPIRE_AFTER_DAYS = 14;
/** A dismissed suggestion may come back once this long has passed and a source makes it again. */
export const DISMISS_QUIET_DAYS = 60;
