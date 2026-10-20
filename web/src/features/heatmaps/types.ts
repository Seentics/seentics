/** Domain types for the heatmaps feature. */



export interface HeatmapPageSummary {
  page_path:    string;
  click_count:  number;
  scroll_count: number;
  avg_scroll:   number; // 0-100 percent
  last_seen:    string;
  /** For the list's one-line read; absent from an older core. See core HeatmapPageSummary. */
  dead_click_pct?:     number | null;
  reach_half_pct?:     number | null;
  mobile_avg_scroll?:  number | null;
  desktop_avg_scroll?: number | null;
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
  page_version?: string;
  target_locator?: Record<string, unknown> | null;
  target_rect?: Record<string, unknown> | null;
  relative_x?: number | null;
  relative_y?: number | null;
  position_mode?: 'normal' | 'fixed' | 'sticky';
  client_x?: number | null;
  client_y?: number | null;
  page_x?: number | null;
  page_y?: number | null;
  scroll_x?: number | null;
  scroll_y?: number | null;
  document_width?: number | null;
  document_height?: number | null;
  device_pixel_ratio?: number | null;
  tracker_version?: string;
  schema_version?: number;
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
  /** The real page captured — `/orders/8213` for `/orders/:id`; empty when unknown. */
  source_path?:          string;
  dom_fingerprint?:      string;
  /** With `html_url`: reads this site's archived stylesheets — see `lib/stylesheet-archive`. */
  stylesheet_token?:     string;
  stylesheet_token_expires_at?: string;
}

/** Core's `CaptureScreenshotResult`, which is camelCase on the wire. */
export interface PlaywrightScreenshotResult {
  success: boolean;
  stored: boolean;
  s3Key?: string;
  imageHash?: string;
  imageWidth?: number;
  imageHeight?: number;
  sizeBytes?: number;
  message?: string;
}
