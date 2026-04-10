/**
 * Dashboard funnel API (snake_case models, list batch stats, analytics mapping).
 * Single source for funnel REST used by analytics routes — keep in sync with Core /websites/:id/funnels/*.
 */
import api from './api';
import { isDemo, demoMutationGuard, demoFunnels } from './demo';

/** Core GET .../stats JSON shape (camelCase). */
interface FunnelStatsPayload {
  totalEntries?: number;
  completions?: number;
  conversionRate?: number;
  stepBreakdown?: Array<{
    stepOrder: number;
    count: number;
    dropoffCount?: number;
    dropoffRate?: number;
  }>;
}

// --- Dashboard types (analytics UI / FunnelBuilder) ---------------------------------

export interface DashboardFunnelStep {
  id: string;
  name: string;
  type: 'page' | 'event' | 'custom';
  condition: {
    page?: string;
    event?: string;
    custom?: string;
  };
  order: number;
}

export interface FunnelListSummary {
  total_starts: number;
  total_conversions: number;
  conversion_rate: number;
}

export interface DashboardFunnel {
  id: string;
  name: string;
  description?: string;
  website_id: string;
  user_id?: string;
  steps: DashboardFunnelStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  list_summary?: FunnelListSummary;
}

export interface FunnelAnalyticsItem {
  funnel_id: string;
  website_id: string;
  date: string;
  total_starts: number;
  total_conversions: number;
  conversion_rate: number;
  avg_value: number;
  total_value: number;
  step_metrics?: Array<{
    step: number;
    count: number;
    drop_off: number;
    drop_off_rate: number;
  }>;
  avg_time_to_convert?: number;
  avg_time_to_abandon?: number;
  drop_off_rate?: number;
  abandonment_rate?: number;
}

export interface FunnelAnalyticsResponse {
  status: string;
  analytics: FunnelAnalyticsItem[];
  count: number;
}

function normalizeDashboardStep(raw: Record<string, unknown>): DashboardFunnelStep {
  const st = String(raw.stepType ?? raw.step_type ?? 'page_view').toLowerCase();
  const type: DashboardFunnelStep['type'] =
    st === 'event' ? 'event' : st === 'custom' ? 'custom' : 'page';
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    order: Number(raw.order ?? 0),
    type,
    condition: {
      page: (raw.pagePath ?? raw.page_path) as string | undefined,
      event: (raw.eventType ?? raw.event_type) as string | undefined,
    },
  };
}

export function normalizeDashboardFunnelFromApi(raw: Record<string, unknown>): DashboardFunnel {
  const stats = raw.stats as Record<string, unknown> | undefined;
  const list_summary: FunnelListSummary | undefined =
    stats &&
    typeof stats === 'object' &&
    (typeof stats.totalEntries === 'number' || typeof stats.completions === 'number')
      ? {
          total_starts: Number(stats.totalEntries ?? stats.total_entries ?? 0),
          total_conversions: Number(stats.completions ?? 0),
          conversion_rate: Number(stats.conversionRate ?? stats.conversion_rate ?? 0),
        }
      : undefined;

  const rawSteps = raw.steps;
  const steps = Array.isArray(rawSteps)
    ? (rawSteps as Record<string, unknown>[]).map(normalizeDashboardStep)
    : [];

  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: (raw.description as string) || undefined,
    website_id: String(raw.website_id ?? raw.websiteId ?? ''),
    user_id: (raw.user_id ?? raw.userId) as string | undefined,
    steps,
    is_active: Boolean(raw.is_active ?? raw.isActive),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
    updated_at: String(raw.updated_at ?? raw.updatedAt ?? ''),
    list_summary,
  };
}

function dashboardStepsToCore(steps: DashboardFunnelStep[]) {
  return steps.map((s) => {
    const matchType = 'contains';
    if (s.type === 'page') {
      return {
        id: s.id || undefined,
        name: s.name,
        order: s.order,
        stepType: 'page_view',
        pagePath: s.condition.page || '/',
        matchType,
      };
    }
    if (s.type === 'event') {
      return {
        id: s.id || undefined,
        name: s.name,
        order: s.order,
        stepType: 'event',
        eventType: s.condition.event || 'event',
        matchType,
      };
    }
    return {
      id: s.id || undefined,
      name: s.name,
      order: s.order,
      stepType: 'event',
      eventType: s.condition.custom || 'custom',
      matchType,
    };
  });
}

export function funnelStatsToAnalyticsResponse(
  funnelId: string,
  websiteId: string,
  s: FunnelStatsPayload,
): FunnelAnalyticsResponse {
  const totalStarts = Number(s.totalEntries ?? 0);
  const totalConv = Number(s.completions ?? 0);
  const convRate = Number(s.conversionRate ?? 0);
  const drop_off_rate = totalStarts > 0 ? ((totalStarts - totalConv) / totalStarts) * 100 : 0;
  const step_metrics = Array.isArray(s.stepBreakdown)
    ? s.stepBreakdown.map(sb => ({
        step: sb.stepOrder,
        count: sb.count,
        drop_off: Number(sb.dropoffCount ?? 0),
        drop_off_rate: Number(sb.dropoffRate ?? 0),
      }))
    : [];
  return {
    status: 'success',
    analytics: [{
      funnel_id: funnelId,
      website_id: websiteId,
      date: new Date().toISOString().split('T')[0],
      total_starts: totalStarts,
      total_conversions: totalConv,
      conversion_rate: convRate,
      avg_value: 0,
      total_value: 0,
      drop_off_rate,
      abandonment_rate: drop_off_rate,
      step_metrics,
    }],
    count: 1,
  };
}

function emptyFunnelAnalyticsResponse(funnelId: string, websiteId: string, status: 'success' | 'error'): FunnelAnalyticsResponse {
  return {
    status,
    analytics: [{
      funnel_id: funnelId,
      website_id: websiteId,
      date: new Date().toISOString().split('T')[0],
      total_starts: 0,
      total_conversions: 0,
      conversion_rate: 0,
      avg_value: 0,
      total_value: 0,
      drop_off_rate: 100,
      abandonment_rate: 100,
    }],
    count: 0,
  };
}

// --- API ---------------------------------------------------------------------------

export async function fetchDashboardFunnelList(websiteId: string): Promise<DashboardFunnel[]> {
  if (isDemo(websiteId)) {
    return demoFunnels().funnels as DashboardFunnel[];
  }
  const response = await api.get(`/websites/${websiteId}/funnels`, {
    params: { limit: 0, offset: 0 },
  });
  const payload = response.data;
  const list =
    payload?.funnels ?? (Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []);
  if (!Array.isArray(list)) return [];
  return list.map((item: Record<string, unknown>) => normalizeDashboardFunnelFromApi(item));
}

export async function createDashboardFunnel(
  websiteId: string,
  funnelData: Omit<DashboardFunnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>,
): Promise<DashboardFunnel> {
  if (demoMutationGuard(websiteId)) {
    return {
      id: 'demo-new',
      website_id: websiteId,
      ...funnelData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as DashboardFunnel;
  }
  try {
    const response = await api.post(`/websites/${websiteId}/funnels`, {
      name: funnelData.name,
      description: funnelData.description ?? '',
      steps: dashboardStepsToCore(funnelData.steps),
    });
    const raw = response.data as Record<string, unknown>;
    return normalizeDashboardFunnelFromApi(raw?.id ? raw : (raw?.funnel as Record<string, unknown>) ?? raw);
  } catch (error: any) {
    console.error('Error creating funnel:', error);
    if (error.response?.status === 403 && error.response?.data?.error === 'Funnel limit reached') {
      throw new Error(`Funnel limit reached! You've reached your plan's funnel limit. Please upgrade to create more funnels.`);
    }
    if (error.response?.data?.message?.includes('limit')) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export async function getDashboardFunnel(websiteId: string, funnelId: string): Promise<DashboardFunnel> {
  if (isDemo(websiteId)) {
    const f = demoFunnels().funnels.find((x: { id: string }) => x.id === funnelId);
    if (!f) throw new Error('Funnel not found');
    return f as DashboardFunnel;
  }
  const response = await api.get(`/websites/${websiteId}/funnels/${funnelId}`);
  const raw = response.data as Record<string, unknown>;
  return normalizeDashboardFunnelFromApi(raw?.id ? raw : (raw?.funnel as Record<string, unknown>) ?? raw);
}

export async function updateDashboardFunnel(
  websiteId: string,
  funnelId: string,
  funnelData: Partial<DashboardFunnel>,
): Promise<DashboardFunnel> {
  if (demoMutationGuard(websiteId)) {
    return { id: funnelId, website_id: websiteId, ...funnelData } as DashboardFunnel;
  }
  const body: Record<string, unknown> = {};
  if (funnelData.name !== undefined) body.name = funnelData.name;
  if (funnelData.description !== undefined) body.description = funnelData.description;
  if (funnelData.is_active !== undefined) body.isActive = funnelData.is_active;
  if (funnelData.steps !== undefined) body.steps = dashboardStepsToCore(funnelData.steps);
  const response = await api.put(`/websites/${websiteId}/funnels/${funnelId}`, body);
  const raw = response.data as Record<string, unknown>;
  return normalizeDashboardFunnelFromApi(raw?.id ? raw : (raw?.funnel as Record<string, unknown>) ?? raw);
}

export async function deleteDashboardFunnel(websiteId: string, funnelId: string): Promise<void> {
  if (demoMutationGuard(websiteId)) return;
  await api.delete(`/websites/${websiteId}/funnels/${funnelId}`);
}

export async function bulkDeleteDashboardFunnels(websiteId: string, funnelIds: string[]): Promise<void> {
  if (demoMutationGuard(websiteId)) return;
  await api.delete(`/websites/${websiteId}/funnels/bulk-delete`, {
    data: { funnelIds },
  });
}

export async function getDashboardFunnelAnalytics(
  funnelId: string,
  dateRange: number = 7,
  websiteId?: string,
): Promise<FunnelAnalyticsResponse> {
  const days = Math.min(366, Math.max(1, Math.round(Number(dateRange) || 7)));
  if (funnelId.startsWith('demo-')) {
    const { demoFunnelAnalytics } = await import('./demo');
    return demoFunnelAnalytics(funnelId);
  }
  if (websiteId && !isDemo(websiteId)) {
    try {
      const response = await api.get(`/websites/${websiteId}/funnels/${funnelId}/stats`, {
        params: { days },
      });
      const s = response.data as FunnelStatsPayload;
      return funnelStatsToAnalyticsResponse(funnelId, websiteId, s);
    } catch (error) {
      console.warn(`Failed to fetch funnel stats for ${funnelId}:`, error);
      return emptyFunnelAnalyticsResponse(funnelId, websiteId, 'error');
    }
  }
  try {
    const response = await api.get(`/funnels/${funnelId}/analytics`, {
      params: { days },
    });
    if (response.data && typeof response.data === 'object') {
      if ('data' in response.data) return response.data.data as FunnelAnalyticsResponse;
      return response.data as FunnelAnalyticsResponse;
    }
    return emptyFunnelAnalyticsResponse(funnelId, websiteId ?? '', 'success');
  } catch (error) {
    console.warn(`Failed to fetch funnel analytics for ${funnelId}:`, error);
    return emptyFunnelAnalyticsResponse(funnelId, websiteId ?? '', 'error');
  }
}
