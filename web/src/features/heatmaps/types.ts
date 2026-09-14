/** Domain types for the heatmaps feature. */

import api from '@/lib/api';

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

/** Heatmap page layout snapshot — HTML DOM snapshot (primary) and/or JPEG fallback. */
export interface HeatmapPageScreenshot {
  image_url?:            string;
  image_url_expires_at?: string;
  html_url?:             string;
  html_url_expires_at?:  string;
  doc_width:             number;
  doc_height:            number;
  /** Bucket this background was captured on — `desktop`, `tablet` or `mobile`. */
  device_type?:          string;
  /** True when the requested bucket had no capture and another one is being shown. */
  device_fallback?:      boolean;
}

export interface PlaywrightScreenshotResult {
  stored: boolean;
  s3_key?: string;
  image_hash?: string;
}
