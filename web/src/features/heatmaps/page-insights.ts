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
export function heatmapLine(p: HeatmapPageFacts): string {
  const f = flags(p);
  if (!f.enough) return 'Not enough visits yet to judge';
  const parts: string[] = [];
  if (f.dead) parts.push(`${p.dead_click_pct}% of clicks hit things that do nothing`);
  if (f.low) parts.push(`only ${p.reach_half_pct}% scroll past halfway`);
  if (f.gap) parts.push(`mobile scrolls ${p.mobile_avg_scroll}% vs desktop ${p.desktop_avg_scroll}%`);
  if (!parts.length) {
    return p.reach_half_pct != null
      ? `Healthy — ${p.reach_half_pct}% scroll past halfway${p.dead_click_pct != null ? `, ${p.dead_click_pct}% dead clicks` : ''}`
      : 'Nothing stands out';
  }
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}
