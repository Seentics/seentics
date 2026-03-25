import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  project_id: string;
  service: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  trace_id?: string;
  span_id?: string;
  host?: string;
  environment?: string;
  attributes?: Record<string, string>;
}

export interface LogsResponse {
  logs: LogEntry[];
  count: number;
}

export interface ErrorGroup {
  fingerprint: string;
  project_id: string;
  service: string;
  error_type: string;
  message: string;
  status: 'open' | 'resolved' | 'ignored';
  first_seen: string;
  last_seen: string;
  count: number;
}

export interface ErrorEvent {
  timestamp: string;
  project_id: string;
  service: string;
  error_type: string;
  message: string;
  stack_trace?: string;
  fingerprint: string;
  environment?: string;
  user_id?: string;
}

export interface TraceListItem {
  trace_id: string;
  root_service: string;
  root_operation: string;
  start_time: string;
  duration_ms: number;
  status: 'ok' | 'error';
  span_count: number;
}

export interface Span {
  timestamp: string;
  project_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  service: string;
  operation: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'ok' | 'error' | 'unset';
  error_message?: string;
  attributes?: Record<string, string>;
}

export interface MetricBucket {
  bucket: string;
  name: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

// ── Logs ─────────────────────────────────────────────────────────────────────

interface LogQueryParams {
  service?: string;
  level?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function useLogs(projectId: string, params: LogQueryParams = {}) {
  return useQuery<LogsResponse>({
    queryKey: ['obs-logs', projectId, params],
    queryFn: async () => {
      const p = new URLSearchParams({ project_id: projectId });
      if (params.service) p.set('service', params.service);
      if (params.level) p.set('level', params.level);
      if (params.search) p.set('search', params.search);
      if (params.from) p.set('from', params.from);
      if (params.to) p.set('to', params.to);
      if (params.limit) p.set('limit', String(params.limit));
      if (params.offset) p.set('offset', String(params.offset));
      const res = await api.get(`/observability/logs?${p}`);
      return res.data;
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

// ── Errors ───────────────────────────────────────────────────────────────────

export function useErrorGroups(projectId: string, service?: string, status?: string, limit = 50) {
  return useQuery<{ groups: ErrorGroup[]; count: number }>({
    queryKey: ['obs-error-groups', projectId, service, status],
    queryFn: async () => {
      const p = new URLSearchParams({ project_id: projectId, limit: String(limit) });
      if (service) p.set('service', service);
      if (status) p.set('status', status);
      const res = await api.get(`/observability/errors/groups?${p}`);
      return res.data;
    },
    enabled: !!projectId,
    refetchInterval: 15000,
  });
}

export function useErrorEvents(fingerprint: string, projectId: string, limit = 20) {
  return useQuery<{ events: ErrorEvent[]; count: number }>({
    queryKey: ['obs-error-events', fingerprint, projectId],
    queryFn: async () => {
      const p = new URLSearchParams({ project_id: projectId, limit: String(limit) });
      const res = await api.get(`/observability/errors/groups/${fingerprint}/events?${p}`);
      return res.data;
    },
    enabled: !!fingerprint && !!projectId,
  });
}

export function useUpdateErrorStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fingerprint, projectId, status }: { fingerprint: string; projectId: string; status: string }) =>
      api.patch(`/observability/errors/groups/${fingerprint}/status`, { project_id: projectId, status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obs-error-groups'] }),
  });
}

// ── Traces ───────────────────────────────────────────────────────────────────

export function useTraces(projectId: string, service?: string, from?: string, to?: string, limit = 50) {
  return useQuery<{ traces: TraceListItem[]; count: number }>({
    queryKey: ['obs-traces', projectId, service, from, to],
    queryFn: async () => {
      const p = new URLSearchParams({ project_id: projectId, limit: String(limit) });
      if (service) p.set('service', service);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const res = await api.get(`/observability/traces?${p}`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useTrace(projectId: string, traceId: string) {
  return useQuery<{ trace_id: string; spans: Span[]; span_count: number }>({
    queryKey: ['obs-trace', projectId, traceId],
    queryFn: async () => {
      const res = await api.get(`/observability/traces/${traceId}?project_id=${projectId}`);
      return res.data;
    },
    enabled: !!projectId && !!traceId,
  });
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export function useMetrics(
  projectId: string,
  service?: string,
  name?: string,
  from?: string,
  to?: string,
  granularity: 'minute' | 'hour' | 'day' = 'hour',
) {
  return useQuery<{ metrics: MetricBucket[]; count: number }>({
    queryKey: ['obs-metrics', projectId, service, name, from, to, granularity],
    queryFn: async () => {
      const p = new URLSearchParams({ project_id: projectId, granularity });
      if (service) p.set('service', service);
      if (name) p.set('name', name);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const res = await api.get(`/observability/metrics?${p}`);
      return res.data;
    },
    enabled: !!projectId,
    refetchInterval: 30000,
  });
}
