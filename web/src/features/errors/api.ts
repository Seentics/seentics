/**
 * Endpoint functions for the errors feature. No React, no hooks — just transport.
 *
 * Keeping these callable outside React is what lets a query, a prefetch, a test and a
 * script share one definition of the endpoint. Raw URLs live here and nowhere else.
 */
import api from '@/lib/api';
import type { ErrorGroup, ErrorGroupDetail, ErrorGroupFilters, ErrorStatus } from './types';

export const errorsApi = {
  async listGroups(websiteId: string, filters: ErrorGroupFilters): Promise<ErrorGroup[]> {
    const params = new URLSearchParams({ days: String(filters.days) });
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const res = await api.get(`/errors/${websiteId}/groups?${params.toString()}`);
    return (res.data?.groups ?? []) as ErrorGroup[];
  },

  async getGroup(websiteId: string, fingerprint: string, days: number): Promise<ErrorGroupDetail> {
    const res = await api.get(`/errors/${websiteId}/groups/${fingerprint}?days=${days}`);
    return { group: res.data?.group ?? null, samples: res.data?.samples ?? [] };
  },

  async setStatus(websiteId: string, fingerprint: string, status: ErrorStatus): Promise<void> {
    await api.patch(`/errors/${websiteId}/groups/${fingerprint}`, { status });
  },
};
