/** The daily insight, as `GET /ai/insights/:website_id` returns it. */

export type InsightStatus = 'ready' | 'insufficient_data' | 'failed';
export type InsightSource = 'ai' | 'rules';

export interface InsightEvidence {
  kind: string;
  label: string;
  /** Suffix under `/websites/:id/` — `''` for the overview itself. */
  path: string;
}

export interface InsightLine {
  kind: 'finding' | 'action';
  text: string;
  evidence: InsightEvidence;
  /** An action carries the question to ask the assistant about it. */
  action: { title: string; prompt: string } | null;
}

export interface DailyInsight {
  date: string;
  status: InsightStatus;
  source: InsightSource;
  reason: string | null;
  createdAt: string;
  lines: InsightLine[];
}

/** What a refresh came back with: a new insight, or why there is not one yet. */
export type RefreshOutcome =
  | { kind: 'refreshed'; data: DailyInsight | null }
  /** Asked too soon. `retryAfterSec` is how long until it can be asked again. */
  | { kind: 'cooldown'; data: DailyInsight | null; retryAfterSec: number }
  /** This member's role cannot refresh. */
  | { kind: 'forbidden' };
