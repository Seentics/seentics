import { heatmapsEn, type HeatmapsMessages } from '@/lib/i18n/messages/heatmaps-en';

/** The figures a page row carries for its one-line read; see core HeatmapPageSummary. */
export type HeatmapPageFacts = {
  views: number;
  dead_click_pct?: number | null;
  reach_half_pct?: number | null;
  mobile_avg_scroll?: number | null;
  desktop_avg_scroll?: number | null;
};

export type HeatmapGroupId = 'dead_clicks' | 'low_scroll' | 'mobile_gap' | 'healthy' | 'too_little';

export const HEATMAP_GROUP_META: Array<{ id: HeatmapGroupId; label: string; description: string; dot: string }> = [
  { id: 'dead_clicks', label: 'Dead clicks',          description: 'Visitors click things that do nothing',     dot: 'bg-red-500' },
  { id: 'low_scroll',  label: 'Most leave early',     description: 'Under half of visitors scroll past halfway', dot: 'bg-orange-500' },
  { id: 'mobile_gap',  label: 'Worse on mobile',      description: 'Mobile visitors scroll much less than desktop', dot: 'bg-amber-400' },
  { id: 'healthy',     label: 'Healthy',              description: 'Nothing stands out',                          dot: 'bg-emerald-500' },
  { id: 'too_little',  label: 'Not enough data',      description: 'Under 100 views — too few to judge',          dot: 'bg-muted-foreground' },
];

const MIN_VIEWS = 100;
const DEAD = 20;
const LOW_REACH = 50;
const GAP = 20;

const flags = (p: HeatmapPageFacts) => {
  const enough = p.views >= MIN_VIEWS;
  const dead = enough && (p.dead_click_pct ?? 0) >= DEAD;
  const low = enough && p.reach_half_pct != null && p.reach_half_pct < LOW_REACH;
  const gap = enough && p.mobile_avg_scroll != null && p.desktop_avg_scroll != null
    && p.desktop_avg_scroll - p.mobile_avg_scroll >= GAP;
  return { enough, dead, low, gap };
};

export function inHeatmapGroup(p: HeatmapPageFacts, id: HeatmapGroupId): boolean {
  const f = flags(p);
  switch (id) {
    case 'too_little': return !f.enough;
    case 'dead_clicks': return f.dead;
    case 'low_scroll': return f.low;
    case 'mobile_gap': return f.gap;
    case 'healthy': return f.enough && !f.dead && !f.low && !f.gap;
  }
}

/** One line on what visitors do on a page, in plain words, from its counted clicks and scrolls. */
export function heatmapLine(p: HeatmapPageFacts, t: HeatmapsMessages['line'] = heatmapsEn.line): string {
  const f = flags(p);
  if (!f.enough) return t.notEnough;
  const parts: string[] = [];
  if (f.dead) parts.push(t.dead(p.dead_click_pct ?? 0));
  if (f.low) parts.push(t.low(p.reach_half_pct ?? 0));
  if (f.gap) parts.push(t.gap(p.mobile_avg_scroll ?? 0, p.desktop_avg_scroll ?? 0));
  if (!parts.length) {
    return p.reach_half_pct != null
      ? t.healthy(p.reach_half_pct, p.dead_click_pct ?? null)
      : t.nothing;
  }
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export type HeatmapTone = 'problem' | 'healthy' | 'unknown';

/** Whether a page needs attention, for its dot in the list. */
export function heatmapTone(p: HeatmapPageFacts): HeatmapTone {
  const f = flags(p);
  if (!f.enough) return 'unknown';
  return f.dead || f.low || f.gap ? 'problem' : 'healthy';
}

export const HEATMAP_TONE_DOT: Record<HeatmapTone, string> = {
  problem: 'bg-orange-500',
  healthy: 'bg-emerald-500',
  unknown: 'bg-muted-foreground/40',
};

export const HEATMAP_TONE_RANK: Record<HeatmapTone, number> = { problem: 2, healthy: 1, unknown: 0 };


const STATUS_ORDER: HeatmapGroupId[] = ['dead_clicks', 'low_scroll', 'mobile_gap', 'too_little'];

/** A page's one status for its label: the most pressing group it is in. */
export function pageStatus(p: HeatmapPageFacts): HeatmapGroupId {
  return STATUS_ORDER.find((id) => inHeatmapGroup(p, id)) ?? 'healthy';
}

/**
 * Every group a page is in, most pressing first: a page can have dead clicks and be worse on
 * mobile. "Not enough data" stands alone, since the others mean little without it; none is Healthy.
 */
export function pageSignals(p: HeatmapPageFacts): HeatmapGroupId[] {
  const hits = STATUS_ORDER.filter((id) => inHeatmapGroup(p, id));
  if (hits.includes('too_little')) return ['too_little'];
  return hits.length > 0 ? hits : ['healthy'];
}

/** A readable name for a page from its path: `/` is Home, `/blog/why-real-time` is "Why real time". */
export function pageName(path: string, home: string = heatmapsEn.rows.home): string {
  const last = path.split('?')[0].split('/').filter(Boolean).pop();
  if (!last) return home;
  if (last === ':id') return path;
  const words = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}
