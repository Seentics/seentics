import { count as num, formatDelta, twoProportionZ } from '../../../platform/heuristics';
import {
  BASELINE_DAYS,
  CHECKPOINT_DAYS,
  LOWER_IS_BETTER,
  type AutomationActivity,
  type ImpactCheckpoint,
  type ImpactReport,
  type MetricName,
  type MetricValue,
  type Recommendation,
  type Verdict,
} from './types';

/**
 * Before and after, judged in code.
 *
 * Two guards keep a report from over-claiming. A volume floor: below it a rate is mostly noise, so
 * the report says "too little data" instead of quoting a swing. And a two-proportion z-test: a
 * difference inside normal variation for that much traffic reads as "no clear change", however
 * large the points look. Neither guard can separate the change from seasonality or a campaign that
 * started the same week, and every report says so.
 */

const DAY_MS = 86_400_000;

/** Sessions (or funnel entries) each window needs before a rate is compared at all. */
export const MIN_VOLUME: Record<MetricName, number> = {
  bounce_rate: 100,
  conversion_rate: 100,
  funnel_conversion: 30,
  none: 0,
};

/** |z| at or above this is reported as a real move (about 95% two-sided). */
export const Z_SIGNIFICANT = 1.96;

/** A reading may be taken this long after its window closes, so late events have arrived. */
export const SETTLE_MS = 2 * 60 * 60 * 1000;

export const SEASONALITY_CAVEAT =
  "A before/after comparison can't separate your change from seasonality, campaigns or anything else that changed in the same weeks.";

export const METRIC_LABEL: Record<MetricName, string> = {
  bounce_rate: 'bounce rate',
  conversion_rate: 'conversion rate',
  funnel_conversion: 'funnel conversion',
  none: '',
};

/** The 14 days before the change. */
export function baselineWindow(appliedAt: Date): { from: Date; to: Date } {
  return { from: new Date(appliedAt.getTime() - BASELINE_DAYS * DAY_MS), to: appliedAt };
}

/** The `day` days from the change. */
export function afterWindow(appliedAt: Date, day: number): { from: Date; to: Date } {
  return { from: appliedAt, to: new Date(appliedAt.getTime() + day * DAY_MS) };
}

/** A percentage from counts, or null with nothing to divide by. */
export function rate(numerator: number, volume: number): number | null {
  return volume > 0 ? Math.round((numerator / volume) * 1000) / 10 : null;
}

/** Checkpoints that are due and not yet taken, earliest first. */
export function dueCheckpoints(rec: Pick<Recommendation, 'appliedAt' | 'impact'>, now: Date): Array<7 | 14> {
  if (!rec.appliedAt) return [];
  const applied = new Date(rec.appliedAt).getTime();
  const taken = new Set((rec.impact?.checkpoints ?? []).map((c) => c.day));
  return CHECKPOINT_DAYS.filter((d) => !taken.has(d) && now.getTime() >= applied + d * DAY_MS + SETTLE_MS);
}

/** Compare two readings of one metric. */
export function judge(
  metric: MetricName,
  before: MetricValue | null,
  after: MetricValue | null,
): { verdict: Verdict; deltaPts: number | null; z: number | null } {
  if (metric === 'none') return { verdict: 'not_measurable', deltaPts: null, z: null };
  if (!before || before.value === null || before.volume <= 0) return { verdict: 'no_baseline', deltaPts: null, z: null };
  if (!after || after.value === null) return { verdict: 'too_little_data', deltaPts: null, z: null };

  const deltaPts = Math.round((after.value - before.value) * 10) / 10;
  const min = MIN_VOLUME[metric];
  if (before.volume < min || after.volume < min) return { verdict: 'too_little_data', deltaPts, z: null };

  const z = twoProportionZ(before.numerator, before.volume, after.numerator, after.volume);
  if (z === null || Math.abs(z) < Z_SIGNIFICANT) return { verdict: 'no_change', deltaPts, z };
  const wentDown = z < 0;
  return { verdict: wentDown === LOWER_IS_BETTER[metric] ? 'improved' : 'worse', deltaPts, z };
}

/** (p2 - p1) / pooled standard error. Null when the pooled rate is 0 or 1 (no variance to test). */

const pct = (v: number) => `${v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString()}%`;

/** How the target reads at the start of a headline. */
export function subjectOf(rec: Pick<Recommendation, 'target' | 'resource'>): string {
  const t = rec.target;
  switch (t.kind) {
    case 'page':
      return `Your change on ${t.ref ?? t.label}`;
    case 'funnel':
      return t.label ? `The ${t.label} funnel` : 'Your funnel';
    case 'channel':
      return `Your change for ${t.label} traffic`;
    default:
      return t.device ? `Your change for ${t.label}` : 'Your change';
  }
}

function automationLine(a: AutomationActivity | null, day: number): string | null {
  if (!a) return null;
  if (a.totalExecutions === 0) return 'the automation has not run yet (it was created inactive, so enable it on the Automations page)';
  return `the automation ran ${num(a.totalExecutions)} times in its first ${day} days (${num(a.successCount)} actions succeeded)`;
}

/** The one-line headline for a checkpoint. Every number in it comes from the stored readings. */
export function headlineFor(
  rec: Pick<Recommendation, 'target' | 'resource' | 'metric'>,
  baseline: MetricValue | null,
  c: ImpactCheckpoint,
): string {
  const subject = subjectOf(rec);
  const label = METRIC_LABEL[rec.metric.name];
  const b = baseline?.value;
  const a = c.after?.value;
  const auto = automationLine(c.automation, c.day);
  switch (c.verdict) {
    case 'improved':
    case 'worse':
      return `${subject}: ${label} ${formatDelta(c.deltaPts ?? 0)} after ${c.day} days (${pct(b ?? 0)} → ${pct(a ?? 0)})`;
    case 'no_change':
      return `${subject}: no clear change in ${label} after ${c.day} days (${pct(b ?? 0)} → ${pct(a ?? 0)}, within normal variation)`;
    case 'too_little_data': {
      const vol = Math.min(baseline?.volume ?? 0, c.after?.volume ?? 0);
      const unit = rec.metric.name === 'funnel_conversion' ? 'funnel entr' : 'session';
      const plural = rec.metric.name === 'funnel_conversion' ? (vol === 1 ? 'y' : 'ies') : (vol === 1 ? '' : 's');
      return `${subject}: too little traffic to tell after ${c.day} days (${num(vol)} ${unit}${plural} in the smaller window)`;
    }
    case 'no_baseline':
      if (rec.metric.name === 'funnel_conversion' && c.after && c.after.value !== null) {
        return `${subject}: ${pct(c.after.value)} of ${num(c.after.volume)} entries completed in the first ${c.day} days, with no earlier figure to compare with`;
      }
      return `${subject}: no "before" figure to compare with${auto ? `; ${auto}` : ''}`;
    case 'not_measurable':
    default:
      return auto ? `${subject}: ${auto}` : `${subject}: applied, with no before-and-after figure to measure`;
  }
}

/** The rule-worded sentence: the headline, and what the verdict does and does not mean. */
export function ruleSentence(headline: string, verdict: Verdict): string {
  switch (verdict) {
    case 'improved':
      return `${headline}. That is beyond normal variation for this much traffic.`;
    case 'worse':
      return `${headline}. That moved the wrong way beyond normal variation, so it is worth a look.`;
    case 'no_change':
    case 'too_little_data':
      return `${headline}.`;
    default:
      return `${headline}.`;
  }
}

/** Build the report for one stored row. Pure: `now` decides "too early". */
export function buildReport(rec: Recommendation, now: Date): ImpactReport {
  const caveats = [SEASONALITY_CAVEAT];
  if (rec.appliedVia === 'manual') caveats.push('Marked as done by hand, so the day the change went live may differ from the day it was marked.');
  const checkpoints = [...(rec.impact?.checkpoints ?? [])].sort((a, b) => a.day - b.day);
  const latest = checkpoints[checkpoints.length - 1] ?? null;
  if (latest?.day === 7) caveats.push('The first reading covers one week after the change against the two weeks before it.');
  const automation = latest?.automation ?? null;

  const base = {
    recommendationId: rec.id,
    target: rec.target,
    metric: rec.metric,
    appliedAt: rec.appliedAt,
    baseline: rec.baseline,
    checkpoints,
    automation,
    caveats,
  };

  if (!rec.appliedAt || !['applied', 'measuring', 'measured'].includes(rec.status)) {
    return { ...base, status: 'not_applied', verdict: null, headline: rec.title, sentence: rec.rationale || rec.title, sentenceSource: 'rules', nextCheckAt: null };
  }

  const applied = new Date(rec.appliedAt).getTime();
  if (!latest) {
    const next = new Date(applied + CHECKPOINT_DAYS[0] * DAY_MS);
    const headline = `${subjectOf(rec)}: measuring, first reading after ${CHECKPOINT_DAYS[0]} days`;
    return {
      ...base, status: 'too_early', verdict: null, headline,
      sentence: `Too early to tell: the first reading is taken ${CHECKPOINT_DAYS[0]} days after the change.`,
      sentenceSource: 'rules', nextCheckAt: next.toISOString(),
    };
  }

  const headline = headlineFor(rec, rec.baseline, latest);
  const done = checkpoints.some((c) => c.day === 14);
  const stored = rec.impact?.sentence;
  return {
    ...base,
    status: done ? 'measured' : 'measuring',
    verdict: latest.verdict,
    headline,
    sentence: stored || ruleSentence(headline, latest.verdict),
    sentenceSource: stored ? (rec.impact?.sentenceSource ?? 'rules') : 'rules',
    nextCheckAt: done ? null : new Date(applied + 14 * DAY_MS).toISOString(),
  };
}

/** Whether a report is worth showing as a one-liner on the dashboard. */
export const isNewsworthy = (r: ImpactReport): boolean =>
  r.verdict === 'improved' || r.verdict === 'worse' || r.verdict === 'no_change';

export { formatDelta, twoProportionZ };
