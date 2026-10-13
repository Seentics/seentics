/**
 * Daily dashboard insights: what the code found, in the shapes it passes around.
 *
 * The pipeline is `snapshot -> signals -> brief -> model -> validated lines`. Code finds the
 * numbers and decides what is notable; the model only words it. Nothing in this file is raw
 * visitor data: a snapshot is counts per segment, and a path or an error message is masked
 * before it is stored or sent anywhere (privacy.ts).
 */

/** A figure for the window being looked at, and for the window before it. */
export type Pair = { cur: number; prev: number };

export type InsightSnapshot = {
  websiteId: string;
  /** Length of each window, in days: this one, and the one before it. */
  days: number;
  traffic: {
    visitors: Pair;
    pageviews: Pair;
    sessions: Pair;
    /** Percent of sessions with one pageview, 0-100. */
    bounceRate: Pair;
    avgSessionSec: Pair;
  };
  devices: Array<{ name: string; sessions: Pair; bounceRate: Pair; conversions: Pair }>;
  channels: Array<{ name: string; visitors: Pair; sessions: Pair; pagesPerSession: Pair; bounceRate: Pair }>;
  pages: Array<{ path: string; views: Pair }>;
  /** The site's main conversion event, when it has one the code recognises. */
  conversion: { event: string; count: Pair } | null;
  errors: Array<{ message: string; page: string; count: number; isNew: boolean }>;
};

/** Where a line's evidence lives on the dashboard: a path suffix under `/websites/:id/`. */
export type EvidenceKind = 'traffic' | 'bounce' | 'conversion' | 'device' | 'channel' | 'page' | 'error';

export const EVIDENCE_PATH: Record<EvidenceKind, string> = {
  traffic: '',
  bounce: 'paths',
  conversion: 'funnels',
  device: '',
  channel: '',
  page: 'paths',
  error: 'errors',
};

export type Evidence = { kind: EvidenceKind; label: string };

/** A suggestion the owner can act on: what to ask the assistant to draft. */
export type ActionHint = { title: string; prompt: string };

export type Signal = {
  id: string;
  kind: EvidenceKind;
  /** How much it matters: size of the change, weighted by how much traffic stands behind it. */
  score: number;
  /** One plain sentence stating it, from the numbers alone. Used when no model is available. */
  text: string;
  /** The same fact in the brief's compact form. */
  brief: string;
  evidence: Evidence;
  action?: ActionHint;
};

export type InsightLine = {
  kind: 'finding' | 'action';
  text: string;
  evidence: Evidence;
  action?: ActionHint;
};

export type InsightStatus = 'ready' | 'insufficient_data' | 'failed';

export type StoredInsight = {
  websiteId: string;
  /** UTC calendar day the insight is for. */
  insightDate: string;
  status: InsightStatus;
  /** `ai`: worded by the model. `rules`: worded from templates, because no model was available or it failed. */
  source: 'ai' | 'rules';
  lines: InsightLine[];
  /** Why there is nothing to show, for `insufficient_data` and `failed`. */
  reason: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
};
