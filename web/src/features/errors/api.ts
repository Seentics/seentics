/**
 * Endpoint functions for the errors feature. No React, no hooks — just transport.
 *
 * Keeping these callable outside React is what lets a query, a prefetch, a test and a
 * script share one definition of the endpoint. Raw URLs live here and nowhere else.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoErrorGroup, demoErrorGroups } from '@/lib/demo/errors';
import { ERROR_GROUPS_LIMIT, type ErrorGroupDetail, type ErrorGroupFilters, type ErrorGroupList, type ErrorStatus } from './types';

export const errorsApi = {
  /**
   * The most recently seen faults, up to the server's ceiling. It used to send no limit and
   * take the server's default of 100 silently, so the count sort and the tab counts were
   * over whichever 100 had been seen last.
   */
  async listGroups(websiteId: string, filters: ErrorGroupFilters): Promise<ErrorGroupList> {
    if (isDemo(websiteId)) {
      const groups = demoErrorGroups(filters);
      const every = filters.status ? demoErrorGroups({ ...filters, status: '' }) : groups;
      const statusCounts: Partial<Record<ErrorStatus, number>> = {};
      for (const g of every) statusCounts[g.status as ErrorStatus] = (statusCounts[g.status as ErrorStatus] ?? 0) + 1;
      return { groups, total: groups.length, statusCounts };
    }
    const params = new URLSearchParams({ days: String(filters.days), limit: String(ERROR_GROUPS_LIMIT) });
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const res = await api.get(`/errors/${websiteId}/groups?${params.toString()}`);
    const groups = (res.data?.groups ?? []) as ErrorGroupList['groups'];
    return {
      groups,
      total: typeof res.data?.total === 'number' ? res.data.total : groups.length,
      statusCounts: res.data?.status_counts,
    };
  },

  /** A fault and its samples; `group` is null when the site has no such fault (a 404). */
  async getGroup(websiteId: string, fingerprint: string, days: number): Promise<ErrorGroupDetail> {
    if (isDemo(websiteId)) return demoErrorGroup(fingerprint);
    try {
      const res = await api.get(`/errors/${websiteId}/groups/${fingerprint}?days=${days}`);
      return { group: res.data?.group ?? null, samples: res.data?.samples ?? [] };
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return { group: null, samples: [] };
      throw error;
    }
  },

  async setStatus(websiteId: string, fingerprint: string, status: ErrorStatus): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.patch(`/errors/${websiteId}/groups/${fingerprint}`, { status });
  },
};
