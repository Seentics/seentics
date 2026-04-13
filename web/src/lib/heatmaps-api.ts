import api from './api';

export interface HeatmapPageSummary {
  page_path:    string;
  click_count:  number;
  scroll_count: number;
  avg_scroll:   number; // 0-100 percent
  last_seen:    string;
}

export interface HeatmapPoint {
  page_path:        string;
  event_type:       string;
  device_type:      string;
  /** Click: 0–10000 (nx×10000). Scroll row: 0. */
  x_percent:        number;
  /** Click: 0–10000 (ny×10000). Scroll: depth as 0–100 (e.g. 85 → 85% max depth). */
  y_percent:        number;
  intensity:        number;
  target_selector:  string;
  /** CSS viewport width (px) when the sample was captured — used for layout-accurate preview. */
  cap_vw?: number | null;
  /** CSS viewport height (px) when captured. */
  cap_vh?:          number | null;
}

export interface HeatmapData {
  page_path: string;
  points:    HeatmapPoint[];
}

export async function listHeatmapPages(websiteId: string): Promise<HeatmapPageSummary[]> {
  const res = await api.get(`/heatmaps/${websiteId}/pages`);
  return (res.data?.pages ?? []) as HeatmapPageSummary[];
}

/**
 * Canonical path for API queries — must match Go `extractPath` (pathname only, no query/hash).
 * Otherwise `/` vs `/?utm=…` would fetch zero rows while the list still shows `/`.
 */
export function normalizeHeatmapPagePath(path: string): string {
  let p = (path ?? '').trim();
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p) || p.startsWith('//')) {
      const u = new URL(p.startsWith('//') ? `https:${p}` : p);
      p = u.pathname || '/';
    }
  } catch {
    /* plain path */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  const hashIdx = p.indexOf('#');
  if (hashIdx >= 0) p = p.slice(0, hashIdx);
  const qIdx = p.indexOf('?');
  if (qIdx >= 0) p = p.slice(0, qIdx);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

export async function getHeatmapData(
  websiteId: string,
  pagePath:  string,
  eventType: 'click' | 'scroll' = 'click',
): Promise<HeatmapData> {
  const res = await api.get(`/heatmaps/${websiteId}/data`, {
    params: { page_path: normalizeHeatmapPagePath(pagePath), event_type: eventType },
  });
  return res.data as HeatmapData;
}

/** Presigned JPEG from tracker html2canvas capture for heatmap underlay. */
export interface HeatmapPageScreenshot {
  image_url:            string;
  image_url_expires_at: string;
  doc_width:            number;
  doc_height:           number;
}

export async function getHeatmapPageScreenshot(
  websiteId: string,
  pagePath: string,
): Promise<HeatmapPageScreenshot | null> {
  const res = await api.get(`/heatmaps/${websiteId}/layout-snapshot`, {
    params: { page_path: normalizeHeatmapPagePath(pagePath) },
  });
  const layout = (res.data as { layout?: HeatmapPageScreenshot | null }).layout;
  return layout ?? null;
}
export async function deleteHeatmaps(websiteId: string, pagePaths: string[]): Promise<void> {
  await api.delete(`/heatmaps/${websiteId}/bulk-delete`, {
    data: { pagePaths }
  });
}

/** Intensity-weighted mean CSS viewport width from points (matches visitor breakpoints in preview). */
export function weightedHeatmapCaptureViewportWidth(
  points: Pick<HeatmapPoint, 'cap_vw' | 'intensity'>[],
): number | null {
  let sw = 0;
  let iw = 0;
  for (const p of points) {
    const w = p.cap_vw;
    if (typeof w === 'number' && Number.isFinite(w) && w >= 320 && w <= 16_384) {
      const wt = Math.max(1, p.intensity);
      sw += w * wt;
      iw += wt;
    }
  }
  if (iw <= 0) return null;
  return Math.round(sw / iw);
}

/** Intensity-weighted mean CSS viewport height — used when iframe document metrics are unavailable (cross-origin). */
export function weightedHeatmapCaptureViewportHeight(
  points: Pick<HeatmapPoint, 'cap_vh' | 'intensity'>[],
): number | null {
  let sh = 0;
  let iw = 0;
  for (const p of points) {
    const h = p.cap_vh;
    if (typeof h === 'number' && Number.isFinite(h) && h >= 200 && h <= 16_384) {
      const wt = Math.max(1, p.intensity);
      sh += h * wt;
      iw += wt;
    }
  }
  if (iw <= 0) return null;
  return Math.round(sh / iw);
}

/** URL slug segment for `/heatmaps/[slug]` (matches list page navigation). */
export function heatmapPageSlug(pagePath: string): string {
  const p = normalizeHeatmapPagePath(pagePath);
  return encodeURIComponent(p.replace(/\//g, '_'));
}
