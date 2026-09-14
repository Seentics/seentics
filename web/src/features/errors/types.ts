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
