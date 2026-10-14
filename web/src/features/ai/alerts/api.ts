/** Endpoint functions for anomaly alerts. No React, no hooks. */
import api from '@/lib/api';
import type { AlertSettings, AlertSettingsResponse, AlertsResponse } from './types';
import { parseAlertSettings, parseAlertsResponse } from './format';

export const alertsApi = {
  async list(websiteId: string, status: 'open' | 'all' = 'all'): Promise<AlertsResponse> {
    const res = await api.get(`/ai/alerts/${websiteId}`, { params: { status } });
    return parseAlertsResponse(res.data?.data);
  },

  async settings(websiteId: string): Promise<AlertSettingsResponse> {
    const res = await api.get(`/ai/alerts/${websiteId}/settings`);
    return parseAlertSettings(res.data?.data);
  },

  async updateSettings(websiteId: string, patch: Partial<AlertSettings>): Promise<AlertSettingsResponse> {
    const res = await api.put(`/ai/alerts/${websiteId}/settings`, patch);
    return parseAlertSettings(res.data?.data);
  },
};
