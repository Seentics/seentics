/**
 * Pure helpers for the recommendations panel and the insight card's impact line, so what each
 * shows and links to is testable without rendering a dashboard.
 */
import { aiEn, type AiMessages } from '@/lib/i18n/messages/ai-en';
import { buildAskAiHref } from '../ask-link';
import type { ImpactReport, Recommendation, RecommendationSource, Verdict } from './types';

/** What the panel asks for: everything except what was put away or went stale. */
export const VISIBLE_STATUSES = ['open', 'applied', 'measuring', 'measured'] as const;

export interface GroupedRecommendations {
  open: Recommendation[];
  measuring: Recommendation[];
  measured: Recommendation[];
}

/** Open suggestions, changes being measured, and finished results, each newest first. */
export function groupRecommendations(list: Recommendation[]): GroupedRecommendations {
  const byNewest = (a: Recommendation, b: Recommendation) =>
    (b.appliedAt ?? b.updatedAt).localeCompare(a.appliedAt ?? a.updatedAt);
  return {
    open: list.filter((r) => r.status === 'open').sort(byNewest),
    measuring: list.filter((r) => r.status === 'applied' || r.status === 'measuring').sort(byNewest),
    measured: list.filter((r) => r.status === 'measured').sort(byNewest),
  };
}

/**
 * "Do it": the assistant, with the recommendation's prompt typed in and its id carried along, so
 * confirming the draft it leads to marks this recommendation applied.
 */
export function doItHref(websiteId: string, rec: Pick<Recommendation, 'id' | 'prompt' | 'title'>): string | null {
  if (!rec.prompt.trim()) return null;
  return buildAskAiHref(websiteId, rec.prompt, rec.title, rec.id);
}

export type ImpactTone = 'good' | 'bad' | 'neutral';

export function impactTone(verdict: Verdict | null): ImpactTone {
  if (verdict === 'improved') return 'good';
  if (verdict === 'worse') return 'bad';
  return 'neutral';
}

const pct = (v: number) => `${v < 10 ? Math.round(v * 10) / 10 : Math.round(v)}%`;

/** "52% → 46%" and "−6 pts" for the newest reading, or null without both figures. */
export function beforeAfter(
  report: ImpactReport, pts: (text: string) => string = aiEn.recommendations.pts,
): { before: string; after: string; delta: string } | null {
  const latest = report.checkpoints[report.checkpoints.length - 1];
  const b = report.baseline?.value;
  const a = latest?.after?.value;
  if (b == null || a == null || latest?.deltaPts == null) return null;
  const d = latest.deltaPts;
  const abs = Math.abs(d);
  const text = abs < 10 && !Number.isInteger(abs) ? abs.toFixed(1) : String(Math.round(abs));
  return { before: pct(b), after: pct(a), delta: pts(`${d < 0 ? '−' : '+'}${text}`) };
}

/** "Measuring · first reading Oct 8": what an applied recommendation is waiting for. */
export function measuringLabel(
  report: ImpactReport,
  t: AiMessages['recommendations']['measuringLabel'] = aiEn.recommendations.measuringLabel,
  dateLocale?: string,
): string {
  if (!report.nextCheckAt) return t.pending;
  const d = new Date(report.nextCheckAt);
  if (Number.isNaN(d.getTime())) return t.pending;
  const when = d.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
  return report.checkpoints.length === 0 ? t.first(when) : t.final(when);
}

/** English; components use `useT().ai.recommendations.source`. */
export const SOURCE_LABEL: Record<RecommendationSource, string> = aiEn.recommendations.source;

/**
 * The one result worth a line on the insight card: the newest reading that says something (a move
 * either way, or a clear "no change"), not one that is still too early or had too little traffic.
 */
export function impactHighlight(list: Recommendation[]): Recommendation | null {
  const worth = list.filter((r) =>
    (r.status === 'measured' || r.status === 'measuring')
    && (r.report.verdict === 'improved' || r.report.verdict === 'worse' || r.report.verdict === 'no_change'));
  worth.sort((a, b) => {
    const at = (r: Recommendation) => r.report.checkpoints[r.report.checkpoints.length - 1]?.measuredAt ?? '';
    return at(b).localeCompare(at(a));
  });
  return worth[0] ?? null;
}
