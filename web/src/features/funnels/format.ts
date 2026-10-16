/**
 * Pure labelling and formatting for funnel steps.
 *
 * `conditionLabel` turns a step's condition into the text shown beside it, and returns
 * null when there is nothing to say — which the caller renders as no label at all rather
 * than an empty one.
 */

export function conditionLabel(step: { type?: string; condition?: { page?: string; event?: string; custom?: string } }): string | null {
  const c = step.condition;
  if (!c) return null;
  return c.page || c.event || c.custom || null;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export type StepRow = {
  id: string;
  name: string;
  type: string;
  condition: string | null;
  count: number;
  /** Share of everyone who entered the funnel. */
  entryRate: number;
  /** Share of the previous step that continued — undefined on the first step. */
  stepRate?: number;
  dropOff: number;
  dropOffRate: number;
};

/**
 * A funnel's steps joined to their counts, in order. Each step's loss is worked out from
 * the counts (the step before minus this one), not read from `drop_off`: the API reports
 * that as the loss *into* a step while the demo data reports the loss *out of* it, and
 * the counts mean the same thing in both.
 */
export function buildStepRows(
  steps: Array<{ id?: string; name: string; type?: string; condition?: { page?: string; event?: string; custom?: string } }>,
  metrics: Array<{ step: number; count: number }>,
  totalStarts: number,
): StepRow[] {
  return steps.map((step, i) => {
    const count = metrics.find((m) => m.step === i + 1)?.count ?? 0;
    const prev = i === 0 ? null : (metrics.find((m) => m.step === i)?.count ?? 0);
    const lost = prev == null ? 0 : Math.max(prev - count, 0);
    return {
      id: step.id || `step-${i}`,
      name: step.name,
      type: step.type ?? 'page',
      condition: conditionLabel(step),
      count,
      entryRate: totalStarts > 0 ? (count / totalStarts) * 100 : 0,
      stepRate: prev == null ? undefined : prev > 0 ? (count / prev) * 100 : 0,
      dropOff: lost,
      dropOffRate: prev == null || prev <= 0 ? 0 : (lost / prev) * 100,
    };
  });
}

/**
 * The transition that loses the largest share of the people who reached it. By share,
 * not head count: the first transition always loses the most people simply because the
 * most people are there.
 */
export function worstTransition(rows: StepRow[]): { from: StepRow; to: StepRow } | null {
  const candidates = rows.slice(1).filter((r) => r.dropOff > 0);
  if (!candidates.length) return null;
  const to = candidates.reduce((a, b) => (b.dropOffRate > a.dropOffRate ? b : a));
  const from = rows[rows.indexOf(to) - 1];
  return from ? { from, to } : null;
}
