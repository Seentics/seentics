/** Endpoint functions for recommendations. No React, no hooks. */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoRecommendations } from '@/lib/demo/ai';
import type { Recommendation, RecommendationStatus } from './types';

export const recommendationsApi = {
  async list(websiteId: string, statuses?: RecommendationStatus[]): Promise<Recommendation[]> {
    if (isDemo(websiteId)) {
      const all = demoRecommendations();
      return statuses?.length ? all.filter((r) => statuses.includes(r.status)) : all;
    }
    const res = await api.get(`/ai/recommendations/${websiteId}`, {
      params: statuses?.length ? { status: statuses.join(',') } : undefined,
    });
    return (res.data?.data ?? []) as Recommendation[];
  },

  async dismiss(websiteId: string, id: string): Promise<Recommendation> {
    if (demoMutationGuard(websiteId)) throw new Error('Demo mode: changes are not saved.');
    const res = await api.post(`/ai/recommendations/${websiteId}/${id}/dismiss`, {});
    return res.data.data as Recommendation;
  },

  /** "I did this myself": applied with nothing created, and measured like any other. */
  async markDone(websiteId: string, id: string): Promise<Recommendation> {
    if (demoMutationGuard(websiteId)) throw new Error('Demo mode: changes are not saved.');
    const res = await api.post(`/ai/recommendations/${websiteId}/${id}/done`, {});
    return res.data.data as Recommendation;
  },
};
