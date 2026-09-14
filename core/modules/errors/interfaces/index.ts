import type { AuthedRouter } from "../../../platform/http/router";
import type { LaneSpec } from "../../ingest/interfaces";
import type { ModuleLifecycle } from "../../../app/module";

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
}

export interface ErrorMutations {
  /** `unresolved` | `resolved` | `ignored`. Returns false when the group is not on this site. */
  setStatus(websiteId: string, fingerprint: string, status: string): Promise<boolean>;
}

export type ErrorsModule = ModuleLifecycle & {
  lane: LaneSpec;
  ingest: () => ErrorIngest;
  queries: ErrorQueries;
  mutations: ErrorMutations;
  routes: AuthedRouter;
};
