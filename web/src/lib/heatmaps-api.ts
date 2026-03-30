import api from './api';

export interface HeatmapPageSummary {
  page_path:   string;
  click_count: number;
  last_seen:   string;
}

export interface HeatmapPoint {
  page_path:        string;
  event_type:       string;
  device_type:      string;
  x_percent:        number;  // 0-100
  y_percent:        number;  // 0-100
  intensity:        number;
  target_selector:  string;
}

export interface HeatmapData {
  page_path: string;
  points:    HeatmapPoint[];
}

export async function listHeatmapPages(websiteId: string): Promise<HeatmapPageSummary[]> {
  const res = await api.get(`/api/v1/heatmaps/${websiteId}/pages`);
  return (res.data?.pages ?? []) as HeatmapPageSummary[];
}

export async function getHeatmapData(
  websiteId: string,
  pagePath:  string,
  eventType: 'click' | 'scroll' = 'click',
): Promise<HeatmapData> {
  const res = await api.get(`/api/v1/heatmaps/${websiteId}/data`, {
    params: { page_path: pagePath, event_type: eventType },
  });
  return res.data as HeatmapData;
}
