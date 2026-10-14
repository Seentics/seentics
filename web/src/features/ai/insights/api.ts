/** Endpoint functions for the daily insight. No React, no hooks. */
import type { AxiosResponse } from 'axios';
import api from '@/lib/api';
import type { DailyInsight, RefreshOutcome } from './types';

export const insightsApi = {
  async today(websiteId: string): Promise<DailyInsight | null> {
    const res = await api.get(`/ai/insights/${websiteId}`);
    return (res.data?.data ?? null) as DailyInsight | null;
  },

  /**
   * Ask for a fresh insight.
   *
   * 429 and 403 are answers here rather than failures, so they are let through
   * `validateStatus`: the client's error interceptor turns any response carrying a
   * message into a bare `Error`, which would lose both the status and `Retry-After`.
   * A 503 (the model failed) is still thrown.
   */
  async refresh(websiteId: string): Promise<RefreshOutcome> {
    const res = await api.post(`/ai/insights/${websiteId}/refresh`, {}, {
      validateStatus: (s) => (s >= 200 && s < 300) || s === 429 || s === 403,
    });
    return parseRefreshResponse(res);
  },
};

/** Exported for tests. */
export function parseRefreshResponse(
  res: Pick<AxiosResponse, 'status' | 'data' | 'headers'>,
): RefreshOutcome {
  if (res.status === 403) return { kind: 'forbidden' };
  const body = (res.data ?? {}) as {
    data?: DailyInsight | null; refreshed?: boolean; retryAfterSec?: number;
  };
  const data = body.data ?? null;
  const headerValue = Number((res.headers as Record<string, unknown> | undefined)?.['retry-after']);
  const retryAfterSec = Number(body.retryAfterSec) > 0
    ? Number(body.retryAfterSec)
    : Number.isFinite(headerValue) && headerValue > 0 ? headerValue : 0;

  if (res.status === 429 || (body.refreshed === false && retryAfterSec > 0)) {
    // A 429 with no figure still means "not now"; a minute is a guess the button can live with.
    return { kind: 'cooldown', data, retryAfterSec: retryAfterSec || 60 };
  }
  return { kind: 'refreshed', data };
}
