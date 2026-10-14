/**
 * Heatmap insights: what one page's clicks and scroll depths say, worked out by code.
 *
 * The analysis is deterministic and owned here, because only this module knows what a
 * `heatmap_points` row means. Wording it in plain English is a model's job and belongs to
 * whoever owns the model (the AI module), which receives the analysis through
 * `HeatmapInsightNarrator` — a port this module declares and the composition root fills.
 *
 * What the data supports, and so what is computed:
 * - scroll depth per page view (one summary per view, its deepest point as % of page height),
 *   the viewport and document height at the time, so the fold;
 * - clicks per element (a stable selector, the element's tag and ARIA role, whether it is
 *   pinned), at a position normalised to the document height;
 * - the device bucket (desktop / tablet / mobile) of every row.
 *
 * What it does not support (see `HEATMAP_INSIGHT_LIMITS`): rage clicks, attention or dwell
 * time, unique visitors, mouse movement, and what happened after a click.
 *
 * Read models are wire shape (snake_case), like the rest of this module's contracts.
 */

export type HeatmapInsightDevice = "all" | "desktop" | "tablet" | "mobile";

/** How far page views got down the page. Every percentage is 0–100. */
export type HeatmapScrollStats = {
  /** Scroll summaries counted: one per page view, so page views — not visitors. */
  page_views: number;
  /** Share of page views whose deepest point reached at least 25 / 50 / 75 / 100% of the page. */
  reach: { p25: number; p50: number; p75: number; p100: number };
  /** Where the median page view stopped, as % of page height. */
  median_depth: number;
  /** Mean of the deepest point, as % of page height. */
  avg_depth: number;
  /**
   * How much of the page shows without scrolling, as % of page height: the median of
   * viewport height / document height. `null` when the rows predate viewport capture.
   */
  fold_pct: number | null;
  /** Median viewport and document height in CSS px, when recorded. */
  viewport_px: number | null;
  document_px: number | null;
  /** Share of page views that never went meaningfully below the first screen. `null` without a fold. */
  stayed_above_fold_pct: number | null;
};

/** One clicked element. */
export type HeatmapClickTarget = {
  /** The tracker's stable selector (`button#buy`, `a.nav-link`, `[data-seentics-id="cta"]`). */
  selector: string;
  /** Lower-case tag name, when known. */
  tag: string | null;
  /** ARIA role, when the element has one. */
  role: string | null;
  /**
   * Whether the element is a link, button, form control or carries an interactive role.
   * `null` when the row holds too little to say (clicks from before element capture).
   */
  interactive: boolean | null;
  /** Fixed or sticky — always on screen, so scroll reach does not apply. */
  pinned: boolean;
  clicks: number;
  /** % of the page's clicks (for this device). */
  share: number;
  /** Where on the page most of its clicks land, as % of page height. */
  depth_pct: number;
  /** % of page views that scrolled at least that far. `null` without scroll data or when pinned. */
  reach_pct: number | null;
  /** Whether it sits inside the first screen. `null` without a fold. */
  above_fold: boolean | null;
};

export type HeatmapClickStats = {
  clicks: number;
  /** Clicks per page view. `null` without scroll summaries to count views by. */
  clicks_per_view: number | null;
  /** Most-clicked elements, busiest first (at most 8). */
  top: HeatmapClickTarget[];
  /** % of clicks on the three busiest elements. */
  top3_share: number;
  /** Clicks by tenth of the page height, top first: 10 bands. */
  bands: Array<{ from_pct: number; to_pct: number; clicks: number; share: number }>;
  /** % of clicks inside the first screen. `null` without a fold. */
  above_fold_share: number | null;
  /**
   * Clicks on elements that are not links, buttons, form controls or interactive roles —
   * candidates only: a script can make any element clickable, and that is not visible here.
   */
  dead_clicks: {
    clicks: number;
    /** % of the clicks whose element type is known. */
    share: number;
    /** % of all clicks whose element type is known at all. */
    known_share: number;
    targets: HeatmapClickTarget[];
  };
  /** The busiest links and buttons, with how many page views scroll far enough to see them. */
  ctas: HeatmapClickTarget[];
};

export type HeatmapDeviceAnalysis = {
  device: HeatmapInsightDevice;
  scroll: HeatmapScrollStats | null;
  clicks: HeatmapClickStats | null;
};

export type HeatmapSignalKind =
  | "scroll_depth"
  | "fold"
  | "click_concentration"
  | "dead_clicks"
  | "cta_reach"
  | "device_gap"
  | "low_engagement";

/**
 * Something notable, found by rules and stated from the numbers alone.
 *
 * `finding` and `fix` are complete sentences, shown as they are when no model words them.
 * `facts` is the same thing in compact form for a model's brief: every figure a model may
 * quote about this signal is in it.
 */
export type HeatmapSignal = {
  id: string;
  kind: HeatmapSignalKind;
  device: HeatmapInsightDevice;
  /** Higher is more worth saying. Signals are returned sorted by it. */
  score: number;
  finding: string;
  fix: string;
  facts: string;
};

export type HeatmapPageAnalysis = {
  page_path: string;
  days: number;
  /** The device the caller asked for; `all` merges every bucket. */
  device: HeatmapInsightDevice;
  /** Whether there is enough data for any finding. */
  sufficient: boolean;
  /** Why not, when `sufficient` is false. */
  reason: string | null;
  overall: HeatmapDeviceAnalysis;
  /** Per bucket, only those with enough data. Empty when one device was asked for. */
  devices: HeatmapDeviceAnalysis[];
  signals: HeatmapSignal[];
  /** What this data cannot tell, said plainly. */
  limits: string[];
};

/** The deterministic analysis, for the dashboard route and the assistant. */
export interface HeatmapPageAnalysisReads {
  /**
   * Analyse one page over the last `days` days (default 30).
   *
   * @param websiteId `websites.id`, already access-checked by the caller.
   */
  analyzePage(
    websiteId: string,
    pagePath: string,
    opts?: { days?: number; device?: HeatmapInsightDevice },
  ): Promise<HeatmapPageAnalysis>;
}

/** One finding as the owner reads it. */
export type HeatmapInsightFinding = {
  /** The signal it is about — and so the device and kind it came from. */
  signal: string;
  kind: HeatmapSignalKind;
  device: HeatmapInsightDevice;
  finding: string;
  fix: string;
};

export type HeatmapInsightNarration = {
  /** `ai`: worded by the model and checked against the numbers. `rules`: worded from templates. */
  source: "ai" | "rules";
  findings: HeatmapInsightFinding[];
  /** ISO 8601. When this wording was produced. */
  generated_at: string;
  /** Why the wording is from templates when a model is configured, or why there is none. */
  reason: string | null;
  /** Seconds until a refresh may call the model again; `null` when it may now. */
  retry_after_sec: number | null;
};

/**
 * Words an analysis for the owner. Implemented outside this module (by whoever holds a
 * model) and handed in at composition.
 */
export interface HeatmapInsightNarrator {
  /** Whether a model is configured. When false, `narrate` is never called. */
  readonly configured: boolean;
  /**
   * Stored wording for this page, device and window if it is fresh; otherwise new wording
   * (one model call), stored. `refresh` asks for new wording now, subject to a cooldown.
   */
  narrate(
    websiteId: string,
    analysis: HeatmapPageAnalysis,
    opts?: { refresh?: boolean },
  ): Promise<HeatmapInsightNarration>;
}
