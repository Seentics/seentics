/** Endpoint functions for anomaly alerts. No React, no hooks. */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoAlerts } from '@/lib/demo/ai';
import type { AlertSettings, AlertSettingsResponse, AlertsResponse } from './types';
import { parseAlertSettings, parseAlertsResponse } from './format';

export const alertsApi = {
  async list(websiteId: string, status: 'open' | 'all' = 'all'): Promise<AlertsResponse> {
    if (isDemo(websiteId)) {
      const demo = demoAlerts();
      return status === 'open' ? { ...demo, alerts: demo.alerts.filter((a) => a.status === 'open') } : demo;
    }
    const res = await api.get(`/ai/alerts/${websiteId}`, { params: { status } });
    return parseAlertsResponse(res.data?.data);
  },

  async settings(websiteId: string): Promise<AlertSettingsResponse> {
    if (isDemo(websiteId)) return { ...demoAlerts().settings, canManage: false };
    const res = await api.get(`/ai/alerts/${websiteId}/settings`);
    return parseAlertSettings(res.data?.data);
  },

  async updateSettings(websiteId: string, patch: Partial<AlertSettings>): Promise<AlertSettingsResponse> {
    if (demoMutationGuard(websiteId)) return { ...demoAlerts().settings, canManage: false };
    const res = await api.put(`/ai/alerts/${websiteId}/settings`, patch);
    return parseAlertSettings(res.data?.data);
  },
};
