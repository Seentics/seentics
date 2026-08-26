/**
 * The tracker's view of a website.
 *
 * Deliberately not `Website`: the caller is anonymous, it needs the per-feature
 * enable flags and sampling rates rather than the dashboard's domain model, and it
 * reads at tracker volume with its own shorter cache. Wire shape (snake_case) because
 * `buildConfig` hands most of it straight to the browser.
 */
export type WebsiteTrackerRow = {
  /** `websites.id` — the only website identifier. */
  id: string;
  user_id: string;
  url: string;
  is_active: boolean;
  funnel_enabled: boolean;
  heatmap_enabled: boolean;
  heatmap_include_patterns: string | null;
  heatmap_exclude_patterns: string | null;
  heatmap_layout_enabled: boolean;
  replay_enabled: boolean;
  replay_sampling_rate: number;
  replay_include_patterns: string | null;
  replay_exclude_patterns: string | null;
  automation_enabled: boolean;
};

/** A selector-based event goal, as `/tracker/init` sends it. */
export type TrackerGoal = { id: string; name: string; selector: string };

/**
 * Tracker-facing website lookup.
 *
 * Declared by websites because websites owns the table — three modules consume this
 * (ingest, heatmaps' engine, and the internal collectors), so the provider owns the
 * contract. It previously lived in `platform/lib/website-for-tracker.ts`, which meant
 * shared code held raw SQL against `websites` and `goals` plus its own cache of them.
 */
export interface TrackerWebsites {
  /** Resolve by UUID or `websiteId`. `null` when unknown. Caches negatives too. */
  resolve(websiteRef: string): Promise<WebsiteTrackerRow | null>;

  /** Selector-based event goals for `/init`. */
  listGoals(websiteId: string): Promise<TrackerGoal[]>;

  /** The public config blob `/config` returns, built from an already-resolved row. */
  buildConfig(
    website: WebsiteTrackerRow,
    goals: TrackerGoal[],
  ): Promise<Record<string, unknown>>;
}
