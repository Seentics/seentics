import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';

export type ErrorStatus = 'unresolved' | 'resolved' | 'ignored';

export interface ErrorGroup {
  id:              string;
  fingerprint:     string;
  kind:            string;
  message:         string;
  source_file:     string;
  line_no:         number | null;
  status:          ErrorStatus;
  event_count:     number;
  last_page_path:  string;
  first_seen:      string;
  last_seen:       string;
}

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

const isValidId = (id: string) => !!id && id !== 'demo';

export const errorKeys = {
  groups: (websiteId: string, days: number, status: string, search: string) =>
    ['error-groups', websiteId, days, status, search] as const,
  group: (websiteId: string, fingerprint: string, days: number) =>
    ['error-group', websiteId, fingerprint, days] as const,
};

export async function getErrorGroups(
  websiteId: string,
  opts: { days: number; status?: string; search?: string },
): Promise<ErrorGroup[]> {
  const params = new URLSearchParams({ days: String(opts.days) });
  if (opts.status) params.set('status', opts.status);
  if (opts.search) params.set('search', opts.search);
  const res = await api.get(`/errors/${websiteId}/groups?${params.toString()}`);
  return (res.data?.groups ?? []) as ErrorGroup[];
}

export async function getErrorGroup(
  websiteId: string,
  fingerprint: string,
  days: number,
): Promise<{ group: ErrorGroup | null; samples: ErrorSample[] }> {
  const res = await api.get(
    `/errors/${websiteId}/groups/${fingerprint}?days=${days}`,
  );
  return { group: res.data?.group ?? null, samples: res.data?.samples ?? [] };
}

/**
 * Errors are not live-updating data. A fault that appeared five seconds ago is not more
 * actionable than one from five minutes ago, and this dashboard is read while someone
 * works through a list — so no refetch interval, and a stale window long enough that
 * moving between a group and the list does not re-query.
 */
export function useErrorGroups(
  websiteId: string,
  opts: { days: number; status?: string; search?: string },
) {
  return useQuery({
    queryKey: errorKeys.groups(websiteId, opts.days, opts.status ?? '', opts.search ?? ''),
    queryFn:  () => getErrorGroups(websiteId, opts),
    enabled:  isValidId(websiteId),
    staleTime: 60_000,
  });
}

export function useErrorGroup(websiteId: string, fingerprint: string | null, days: number) {
  return useQuery({
    queryKey: errorKeys.group(websiteId, fingerprint ?? '', days),
    queryFn:  () => getErrorGroup(websiteId, fingerprint!, days),
    enabled:  isValidId(websiteId) && !!fingerprint,
    staleTime: 60_000,
  });
}

export function useSetErrorStatus(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { fingerprint: string; status: ErrorStatus }) => {
      await api.patch(`/errors/${websiteId}/groups/${vars.fingerprint}`, {
        status: vars.status,
      });
    },
    // Both lists and the open group can show the status, and resolving from the detail
    // panel has to move the row in the list behind it.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['error-groups', websiteId] });
      void qc.invalidateQueries({ queryKey: ['error-group', websiteId] });
    },
  });
}

/** `TypeError: x is not a function` → `TypeError`, for the badge. */
export function errorTypeOf(message: string): string {
  const m = /^([A-Z][A-Za-z]*(?:Error|Exception))\b/.exec(message.trim());
  return m?.[1] ?? 'Error';
}

/** Compact relative time — the list is scanned, not read. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
