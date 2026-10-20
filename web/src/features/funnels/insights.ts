import { funnelsEn, type FunnelsMessages } from '@/lib/i18n/messages/funnels-en';
import type { Funnel, FunnelAnalyticsItem } from './queries';

export type FunnelGroupId = 'worse' | 'better' | 'leak' | 'low_traffic' | 'paused';

export const FUNNEL_GROUP_META: Array<{ id: FunnelGroupId; label: string; description: string; dot: string }> = [
  { id: 'worse',       label: 'Getting worse', description: 'Converting less than the period before', dot: 'bg-red-500' },
  { id: 'leak',        label: 'Big leak',      description: 'One step loses most of the people who reach it', dot: 'bg-orange-500' },
  { id: 'better',      label: 'Improving',     description: 'Converting more than the period before', dot: 'bg-emerald-500' },
  { id: 'low_traffic', label: 'Too little traffic', description: 'Under 100 entries — too few to judge', dot: 'bg-muted-foreground' },
  { id: 'paused',      label: 'Paused',        description: 'Not tracking right now', dot: 'bg-muted-foreground' },
];

/** The same figures for the period before, from a report over twice the period. */
export type FunnelPrevious = { starts: number; conversions: number };

const MIN_STARTS = 100;
/** A relative change in conversion rate smaller than this is noise, not a trend. */
const MIN_CHANGE = 0.1;
const LEAK_RATE = 60;

const rate = (conv: number, starts: number) => (starts > 0 ? (conv / starts) * 100 : 0);
const pct = (n: number) => `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;

export function previousFrom(current: FunnelAnalyticsItem | undefined, doubled: FunnelAnalyticsItem | undefined): FunnelPrevious | null {
  if (!current || !doubled) return null;
  const starts = (doubled.total_starts ?? 0) - (current.total_starts ?? 0);
  const conversions = (doubled.total_conversions ?? 0) - (current.total_conversions ?? 0);
  return starts > 0 && conversions >= 0 ? { starts, conversions } : null;
}

/** The step people leave most, as "A → B" with the share lost. */
export function biggestLeak(funnel: Funnel, a: FunnelAnalyticsItem, t: FunnelsMessages['line'] = funnelsEn.line): { from: string; to: string; rate: number } | null {
  // Core reports each step's drop-off as the share lost on the way INTO it from the step
  // before (funnel-report-calculation.service.ts), so the first step's is always 0. This
  // read it as the share lost out of each step: it named "first → second" at 0.0% and
  // never saw the last step's loss, and no funnel ever landed in the "Big leak" group.
  const metrics = [...(a.step_metrics ?? [])].sort((x, y) => x.step - y.step);
  const leaks = metrics.slice(1).filter((s, i) => metrics[i]!.count > 0);
  if (!leaks.length) return null;
  const worst = leaks.reduce((x, y) => (y.drop_off_rate > x.drop_off_rate ? y : x));
  const name = (n: number) =>
    (metrics.find((s) => s.step === n) as { name?: string } | undefined)?.name
    ?? funnel.steps?.[n - 1]?.name ?? t.step(n);
  return { from: name(worst.step - 1), to: name(worst.step), rate: worst.drop_off_rate };
}

function trend(a: FunnelAnalyticsItem, prev: FunnelPrevious | null): 'worse' | 'better' | null {
  if (!prev || prev.starts < MIN_STARTS || (a.total_starts ?? 0) < MIN_STARTS) return null;
  const now = rate(a.total_conversions, a.total_starts);
  const before = rate(prev.conversions, prev.starts);
  if (before <= 0) return null;
  const change = (now - before) / before;
  return change <= -MIN_CHANGE ? 'worse' : change >= MIN_CHANGE ? 'better' : null;
}

export function inFunnelGroup(funnel: Funnel, a: FunnelAnalyticsItem | undefined, prev: FunnelPrevious | null, id: FunnelGroupId): boolean {
  if (id === 'paused') return !funnel.is_active;
  if (!a) return false;
  const starts = a.total_starts ?? 0;
  switch (id) {
    case 'low_traffic': return funnel.is_active && starts < MIN_STARTS;
    case 'leak': return starts >= MIN_STARTS && (biggestLeak(funnel, a)?.rate ?? 0) >= LEAK_RATE;
    case 'worse': return trend(a, prev) === 'worse';
    case 'better': return trend(a, prev) === 'better';
  }
}

/** One line on what a funnel is doing in the period, in plain words. */
export function funnelLine(
  funnel: Funnel,
  a: FunnelAnalyticsItem | undefined,
  prev: FunnelPrevious | null,
  /** False where the rate is already shown beside the line, as in the funnels table. */
  withRate = true,
  t: FunnelsMessages['line'] = funnelsEn.line,
): string {
  if (!funnel.is_active) return t.paused;
  if (!a || !a.total_starts) return t.nobody;
  const now = rate(a.total_conversions, a.total_starts);
  const parts = [t.converts(pct(now), a.total_conversions.toLocaleString('en-US'), a.total_starts.toLocaleString('en-US'))];
  if (a.total_starts < MIN_STARTS) return t.tooFew(parts[0]!);
  const leak = biggestLeak(funnel, a, t);
  if (leak) parts.push(t.mostLeave(leak.from, leak.to, pct(leak.rate)));
  const dir = trend(a, prev);
  if (dir && prev) parts.push((dir === 'worse' ? t.down : t.up)(pct(rate(prev.conversions, prev.starts))));
  if (!withRate) {
    const rest = parts.slice(1).join(' · ');
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : t.nothingStandsOut;
  }
  return parts.join(' · ');
}

export type FunnelTone = 'worse' | 'leak' | 'better' | 'steady' | 'quiet';

/** How much a funnel needs attention, for its dot in the list. */
export function funnelTone(funnel: Funnel, a: FunnelAnalyticsItem | undefined, prev: FunnelPrevious | null): FunnelTone {
  if (!funnel.is_active || !a || (a.total_starts ?? 0) < MIN_STARTS) return 'quiet';
  if (inFunnelGroup(funnel, a, prev, 'worse')) return 'worse';
  if (inFunnelGroup(funnel, a, prev, 'leak')) return 'leak';
  if (inFunnelGroup(funnel, a, prev, 'better')) return 'better';
  return 'steady';
}

export const FUNNEL_TONE_DOT: Record<FunnelTone, string> = {
  worse: 'bg-red-500', leak: 'bg-orange-500', better: 'bg-emerald-500', steady: 'bg-sky-500', quiet: 'bg-muted-foreground/40',
};
export const FUNNEL_TONE_RANK: Record<FunnelTone, number> = { worse: 4, leak: 3, better: 2, steady: 1, quiet: 0 };
