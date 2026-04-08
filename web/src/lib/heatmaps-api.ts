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
  /** Click: 0–10000 (ny×10000). Scroll: depth×100 (e.g. 2500 → 25% page depth). */
  y_percent:        number;
  intensity:        number;
  target_selector:  string;
}

export interface HeatmapData {
  page_path: string;
  points:    HeatmapPoint[];
}

export async function listHeatmapPages(websiteId: string): Promise<HeatmapPageSummary[]> {
  const res = await api.get(`/heatmaps/${websiteId}/pages`);
  return (res.data?.pages ?? []) as HeatmapPageSummary[];
}

export async function getHeatmapData(
  websiteId: string,
  pagePath:  string,
  eventType: 'click' | 'scroll' = 'click',
): Promise<HeatmapData> {
  const res = await api.get(`/heatmaps/${websiteId}/data`, {
    params: { page_path: pagePath, event_type: eventType },
  });
  return res.data as HeatmapData;
}
export async function deleteHeatmaps(websiteId: string, pagePaths: string[]): Promise<void> {
  await api.delete(`/heatmaps/${websiteId}/bulk-delete`, {
    data: { pagePaths }
  });
}

/** URL slug segment for `/heatmaps/[slug]` (matches list page navigation). */
export function heatmapPageSlug(pagePath: string): string {
  return encodeURIComponent(pagePath.replace(/\//g, '_'));
}
