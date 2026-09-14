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
