import type { AuthedRouter } from "../../../platform/http/router";
import type { LaneSpec } from "../../ingest/interfaces";
import type { ModuleLifecycle } from "../../../app/module";
import type { RetentionPurge } from "../../../platform/retention";

/**
 * One error as it arrives from the tracker, after the ingest router has stamped the
 * website and the visitor's user agent onto it.
 *
 * `kind` distinguishes a thrown error from an unhandled rejection, and the fingerprint
 * keeps them apart — they are usually different faults with different fixes.
 */
export type ErrorTrackerEvent = {
  type: "error";
  kind: "error" | "unhandledrejection";
  ts: number;
  url: string;
  sid: string;
  vid?: string;
  message: string;
  source?: string;
  line_no?: number;
  col_no?: number;
  stack?: string;
  /** Stamped by the router from the resolved website. */
  websiteId: string;
  /** Stamped by the router; the group and sample rows derive browser/OS/device from it. */
  clientUa: string;
};

export interface ErrorIngest {
  /**
   * Persist a batch of errors: raise each group's count, then store the samples.
   *
   * Takes the whole batch rather than one event because the group upsert is the
   * expensive half and a batch usually carries several occurrences of the same fault.
   */
  processEvents(batchId: string, events: readonly ErrorTrackerEvent[]): Promise<void>;
}

/** A distinct fault, as the dashboard lists it. */
export type ErrorGroupSummary = {
  id: string;
  fingerprint: string;
  kind: string;
  message: string;
  source_file: string;
  line_no: number | null;
  status: string;
  event_count: number;
  last_page_path: string;
  first_seen: string;
  last_seen: string;
  /**
   * The period the list was asked for, from stored occurrences: how often, how many visitors,
   * where, and the same count for the period before. Present on the list read only.
   */
  window?: ErrorGroupWindowStats;
};

export type ErrorGroupWindowStats = {
  /** Occurrences in the period. */
  count: number;
  /** Occurrences in the period of the same length just before it. */
  prev_count: number;
  /** Distinct sessions affected in the period. */
  sessions: number;
  /** Pages it happened on in the period, most frequent first (at most 3). */
  pages: string[];
};

/** One stored occurrence, including the session that can be replayed. */
export type ErrorSample = {
  id: string;
  message: string;
  stack: string;
  source_file: string;
  line_no: number | null;
  col_no: number | null;
  page_path: string;
  session_id: string | null;
  visitor_id: string | null;
  browser: string;
  os: string;
  device_type: string;
  occurred_at: string;
};

/** A fault with how often it happened inside a window, from its stored occurrences. */
export type ErrorGroupWindowCount = {
  fingerprint: string;
  message: string;
  last_page_path: string;
  first_seen: string;
  last_seen: string;
  /** Occurrences in `error_events` within the window: not the group's lifetime `event_count`. */
  window_count: number;
};

export interface ErrorQueries {
  listGroups(
    websiteId: string,
    q: { days: number; status?: string; search?: string; limit?: number },
  ): Promise<{ groups: ErrorGroupSummary[] }>;
  getGroup(
    websiteId: string,
    fingerprint: string,
    q: { days: number; limit?: number },
  ): Promise<{ group: ErrorGroupSummary | null; samples: ErrorSample[] }>;
  /** Unresolved faults, most frequent within the last `days` first. */
  listGroupsByWindowCount(
    websiteId: string,
    q: { days: number; limit?: number },
  ): Promise<ErrorGroupWindowCount[]>;
}

/** One fault's occurrences in a window, with the same figure for each baseline window. */
export type ErrorSurgeCandidate = {
  fingerprint: string;
  message: string;
  last_page_path: string;
  first_seen: string;
  /** Occurrences in the current window. */
  current: number;
  /** Distinct sessions that hit it in the current window. */
  sessions: number;
  /** Occurrences in each baseline window, in the order given. */
  baseline: number[];
};

/** The counts behind the AI module's hourly error-surge check. */
export interface ErrorAnomalyReads {
  /**
   * The busiest faults of the current window (at most `limit`), plus any named in `include`
   * (the ones already alerting, so they can resolve), each with its baseline counts. Ignored
   * faults are left out. Index range scans on `error_events` (website + time, website +
   * fingerprint + time).
   */
  surgeCandidates(
    websiteId: string,
    current: { start: Date; end: Date },
    baselines: ReadonlyArray<{ start: Date; end: Date }>,
    opts: { limit: number; include?: readonly string[] },
  ): Promise<ErrorSurgeCandidate[]>;
}

export interface ErrorMutations {
  /** `unresolved` | `resolved` | `ignored`. Returns false when the group is not on this site. */
  setStatus(websiteId: string, fingerprint: string, status: string): Promise<boolean>;
}

export type ErrorsModule = ModuleLifecycle & {
  lane: LaneSpec;
  /** Deletes this module's aged rows when the retention sweep asks. */
  retention: RetentionPurge;
  ingest: () => ErrorIngest;
  queries: ErrorQueries;
  mutations: ErrorMutations;
  /** Per-window counts for the AI module's anomaly check. */
  anomalyReads: ErrorAnomalyReads;
  routes: AuthedRouter;
};
