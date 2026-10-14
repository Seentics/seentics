import type { HeatmapInsightDevice, HeatmapInsightFinding } from '../../heatmaps/interfaces';

/** One page's stored wording, for one device and window. */
export type StoredHeatmapInsight = {
  websiteId: string;
  pagePath: string;
  device: HeatmapInsightDevice;
  days: number;
  source: 'ai' | 'rules';
  findings: HeatmapInsightFinding[];
  /** The signal ids it was worded for, sorted and joined: a different set is reworded. */
  signalKey: string;
  reason: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** ISO 8601. */
  createdAt: string;
};

export type HeatmapInsightKey = Pick<StoredHeatmapInsight, 'websiteId' | 'pagePath' | 'device' | 'days'>;

/** Where heatmap wording is kept. A port so the service is tested without a database. */
export interface HeatmapInsightRepository {
  get(key: HeatmapInsightKey): Promise<StoredHeatmapInsight | null>;
  save(insight: StoredHeatmapInsight & { signals: unknown[] }): Promise<void>;
  /** How many of the site's pages were worded since `since` — the daily cap's count. */
  countSince(websiteId: string, since: Date): Promise<number>;
}

export const isFinding = (v: unknown): v is HeatmapInsightFinding =>
  !!v && typeof v === 'object'
  && typeof (v as HeatmapInsightFinding).finding === 'string'
  && typeof (v as HeatmapInsightFinding).fix === 'string'
  && typeof (v as HeatmapInsightFinding).signal === 'string';
