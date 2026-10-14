/**
 * Heatmap insights for one page: the API, its types, and the pure helpers the panel uses.
 * `GET /heatmaps/:websiteId/insights` returns the deterministic analysis and its findings,
 * worded by the AI model when one is configured and from rules otherwise.
 */
import type { AxiosResponse } from 'axios';
import api from '@/lib/api';
import { rangeLabel } from '@/features/ai/ask-link';
import { normalizeHeatmapPagePath } from './api';
import { isDemo } from '@/lib/demo';
import { demoDelay, demoHeatmapInsights } from '@/lib/demo/ai';

export type InsightDevice = 'all' | 'desktop' | 'tablet' | 'mobile';

export interface ScrollStats {
  page_views: number;
  reach: { p25: number; p50: number; p75: number; p100: number };
  median_depth: number;
  avg_depth: number;
  fold_pct: number | null;
  viewport_px: number | null;
  document_px: number | null;
  stayed_above_fold_pct: number | null;
}

export interface ClickTarget {
  selector: string;
  tag: string | null;
  role: string | null;
  interactive: boolean | null;
  pinned: boolean;
  clicks: number;
  share: number;
  depth_pct: number;
  reach_pct: number | null;
  above_fold: boolean | null;
}

export interface ClickStats {
  clicks: number;
  clicks_per_view: number | null;
  top: ClickTarget[];
  top3_share: number;
  bands: Array<{ from_pct: number; to_pct: number; clicks: number; share: number }>;
  above_fold_share: number | null;
  dead_clicks: { clicks: number; share: number; known_share: number; targets: ClickTarget[] };
  ctas: ClickTarget[];
}

export interface DeviceAnalysis {
  device: InsightDevice;
  scroll: ScrollStats | null;
  clicks: ClickStats | null;
}

export interface HeatmapSignal {
  id: string;
  kind: string;
  device: InsightDevice;
  score: number;
  finding: string;
  fix: string;
  facts: string;
}

export interface HeatmapPageAnalysis {
  page_path: string;
  days: number;
  device: InsightDevice;
  sufficient: boolean;
  reason: string | null;
  overall: DeviceAnalysis;
  devices: DeviceAnalysis[];
  signals: HeatmapSignal[];
  limits: string[];
}

export interface InsightFinding {
  signal: string;
  kind: string;
  device: InsightDevice;
  finding: string;
  fix: string;
}

export interface InsightNarration {
  source: 'ai' | 'rules';
  findings: InsightFinding[];
  generated_at: string;
  reason: string | null;
  retry_after_sec: number | null;
}

export interface HeatmapInsights {
  analysis: HeatmapPageAnalysis;
  insights: InsightNarration;
  ai_configured: boolean;
}

export type RefreshInsightsOutcome =
  | { kind: 'refreshed'; data: HeatmapInsights }
  | { kind: 'forbidden' };

const params = (pagePath: string, days: number, device: InsightDevice) => ({
  page_path: normalizeHeatmapPagePath(pagePath),
  days,
  device,
});

export const heatmapInsightsApi = {
  async get(websiteId: string, pagePath: string, days: number, device: InsightDevice): Promise<HeatmapInsights> {
    if (isDemo(websiteId)) return demoHeatmapInsights(pagePath, days, device);
    const res = await api.get(`/heatmaps/${websiteId}/insights`, { params: params(pagePath, days, device) });
    return (res.data as { data: HeatmapInsights }).data;
  },

  /** 403 is an answer (a viewer cannot refresh), so it is let through rather than thrown. */
  async refresh(websiteId: string, pagePath: string, days: number, device: InsightDevice): Promise<RefreshInsightsOutcome> {
    if (isDemo(websiteId)) {
      await demoDelay(900);
      return { kind: 'refreshed', data: demoHeatmapInsights(pagePath, days, device) };
    }
    const res = await api.post(`/heatmaps/${websiteId}/insights/refresh`, {}, {
      params: params(pagePath, days, device),
      validateStatus: (s) => (s >= 200 && s < 300) || s === 403,
    });
    return parseRefreshInsights(res);
  },
};

/** Exported for tests. */
export function parseRefreshInsights(res: Pick<AxiosResponse, 'status' | 'data'>): RefreshInsightsOutcome {
  if (res.status === 403) return { kind: 'forbidden' };
  return { kind: 'refreshed', data: (res.data as { data: HeatmapInsights }).data };
}

/** Device as a sentence reads it. */
export function deviceLabel(device: InsightDevice): string {
  return device === 'all' ? 'All devices' : device.charAt(0).toUpperCase() + device.slice(1);
}

/**
 * The scroll headline: "Half of page views stop by 45% of the page — the fold is at 22%."
 * `null` without scroll data.
 */
export function scrollHeadline(scroll: ScrollStats | null): string | null {
  if (!scroll) return null;
  const fold = scroll.fold_pct === null ? '' : ` — the fold is at ${scroll.fold_pct}%`;
  return `Half of page views stop by ${scroll.median_depth}% of the page${fold}.`;
}

/** The reach rows of the scroll summary: how many page views got at least this far. */
export function reachRows(scroll: ScrollStats | null): Array<{ depth: number; pct: number }> {
  if (!scroll) return [];
  return [
    { depth: 25, pct: scroll.reach.p25 },
    { depth: 50, pct: scroll.reach.p50 },
    { depth: 75, pct: scroll.reach.p75 },
    { depth: 100, pct: scroll.reach.p100 },
  ];
}

/** A clicked element's one-line description: "40% of clicks · 75% down · 30% reach it". */
export function targetSummary(t: ClickTarget): string {
  const parts = [`${t.share}% of clicks`];
  if (t.pinned) parts.push('always on screen');
  else {
    parts.push(`${t.depth_pct}% down`);
    if (t.reach_pct !== null) parts.push(`${t.reach_pct}% reach it`);
  }
  return parts.join(' · ');
}

/** How long until a refresh is allowed, in words. */
export function formatRetry(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const min = Math.ceil(sec / 60);
  if (min <= 1) return 'in a minute';
  if (min < 60) return `in ${min} min`;
  const h = Math.ceil(min / 60);
  return `in ${h} hour${h === 1 ? '' : 's'}`;
}

/** The question the panel's "Ask AI" opens the assistant with: about this page, this range. */
export function askAboutHeatmapPage(pagePath: string, days: number, device: InsightDevice) {
  const path = normalizeHeatmapPagePath(pagePath);
  const on = device === 'all' ? '' : ` on ${device}`;
  return {
    question: `What does the heatmap for ${path} show over the last ${rangeLabel(days)}${on}? Where do people stop scrolling, what do they click that isn't a link, and what should I change on the page?`,
    context: `Heatmap ${path}`.slice(0, 60),
  };
}
