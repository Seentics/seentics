export type LogLevel    = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type MetricType  = 'gauge' | 'counter' | 'histogram';
export type SpanStatus  = 'ok' | 'error' | 'unset';

export interface SeenticsConfig {
  /** API key (sk_proj_...) */
  apiKey: string;
  /** Project / website ID */
  projectId: string;
  /** Logical service name shown in the dashboard */
  service: string;
  environment?: string;
  /** Base URL of your Seentics instance. Default: https://api.seentics.io */
  baseUrl?: string;
  /** Flush interval in ms. Default: 5000 */
  flushInterval?: number;
  /** Max buffered items before an immediate flush. Default: 100 */
  flushMaxSize?: number;
}

export interface LogEntry {
  timestamp?:   string;
  project_id:   string;
  service:      string;
  level:        LogLevel;
  message:      string;
  trace_id?:    string;
  span_id?:     string;
  attributes?:  Record<string, string>;
  host?:        string;
  environment?: string;
}

export interface ErrorEvent {
  timestamp?:   string;
  project_id:   string;
  service:      string;
  error_type:   string;
  message:      string;
  stack_trace?: string;
  environment?: string;
  release?:     string;
  user_id?:     string;
  attributes?:  Record<string, string>;
}

export interface SpanData {
  timestamp?:      string;
  project_id:      string;
  trace_id:        string;
  span_id:         string;
  parent_span_id?: string;
  service:         string;
  operation:       string;
  start_time:      string;
  end_time:        string;
  duration_ms:     number;
  status:          SpanStatus;
  error_message?:  string;
  attributes?:     Record<string, string>;
}

export interface MetricPoint {
  timestamp?:  string;
  project_id:  string;
  service:     string;
  name:        string;
  type:        MetricType;
  value:       number;
  labels?:     Record<string, string>;
  host?:       string;
}
