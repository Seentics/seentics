/** Domain types for the errors feature. Shared by the API layer, the hooks and the components. */

export type ErrorStatus = 'unresolved' | 'resolved' | 'ignored';

/** A distinct fault, as the list shows it. */
export interface ErrorGroup {
  id:             string;
  fingerprint:    string;
  kind:           string;
  message:        string;
  source_file:    string;
  line_no:        number | null;
  status:         ErrorStatus;
  event_count:    number;
  last_page_path: string;
  first_seen:     string;
  last_seen:      string;
  /** The listed period, from stored occurrences; absent from an older core. */
  window?: {
    count:      number;
    prev_count: number;
    sessions:   number;
    pages:      string[];
  };
}

/** One stored occurrence of a fault. */
export interface ErrorSample {
  id:          string;
  message:     string;
  stack:       string;
  source_file: string;
  line_no:     number | null;
  col_no:      number | null;
  page_path:   string;
  /** The replay link. Null when the visitor was not being recorded. */
  session_id:  string | null;
  visitor_id:  string | null;
  browser:     string;
  os:          string;
  device_type: string;
  occurred_at: string;
}

/**
 * One page of faults and how many there are in all. The list stops at
 * {@link ERROR_GROUPS_LIMIT}; `total` and `statusCounts` are the server's uncapped counts for
 * the same window and search, so a capped list can say so and its tabs read true.
 */
export interface ErrorGroupList {
  groups: ErrorGroup[];
  /** Every fault matching the filters, of which `groups` is the most recently seen. */
  total: number;
  /** Per status, for the same window and search. */
  statusCounts?: Partial<Record<ErrorStatus, number>>;
}

/** Most faults one list request returns — the server's own ceiling. */
export const ERROR_GROUPS_LIMIT = 200;

export interface ErrorGroupFilters {
  days:    number;
  /** Empty means every status. */
  status?: string;
  search?: string;
}

export interface ErrorGroupDetail {
  group:   ErrorGroup | null;
  samples: ErrorSample[];
}
