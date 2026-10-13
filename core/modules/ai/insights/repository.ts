import type { InsightLine, StoredInsight } from './types';

/** Where insights are kept. A port so the service is tested without a database. */
export interface InsightRepository {
  get(websiteId: string, insightDate: string): Promise<StoredInsight | null>;
  /** The newest insight for the site, whatever day it is for. */
  latest(websiteId: string): Promise<StoredInsight | null>;
  save(insight: StoredInsight & { signals: unknown[] }): Promise<void>;
  /** Deletes insights created before `cutoff`. Returns how many. */
  purgeBefore(cutoff: Date): Promise<number>;
}

export const isLine = (v: unknown): v is InsightLine => !!v && typeof v === 'object' && typeof (v as InsightLine).text === 'string';
