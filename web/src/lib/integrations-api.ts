import api from './api';

export type IntegrationProvider = 'slack' | 'discord' | 'teams';

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  webhookUrl: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationRequest {
  provider: IntegrationProvider;
  webhookUrl: string;
  events: string[];
}

export interface UpdateIntegrationRequest {
  webhookUrl?: string;
  events?: string[];
  active?: boolean;
}

export const INTEGRATION_EVENTS = [
  { value: 'visitor_threshold', label: 'Visitor Threshold', description: 'When visitor count exceeds a threshold' },
  { value: 'goal_completion', label: 'Goal Completion', description: 'When a goal is completed' },
  { value: 'daily_summary', label: 'Daily Summary', description: 'Daily analytics summary' },
  { value: 'realtime_alert', label: 'Realtime Alert', description: 'Real-time traffic alerts' },
] as const;

class IntegrationsAPI {
  async list(): Promise<Integration[]> {
    const response = await api.get('/user/integrations');
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data : [];
  }

  async create(req: CreateIntegrationRequest): Promise<Integration> {
    const response = await api.post('/user/integrations', req);
    return response.data?.data || response.data;
  }

  async update(id: string, req: UpdateIntegrationRequest): Promise<void> {
    await api.put(`/user/integrations/${id}`, req);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/user/integrations/${id}`);
  }

  async test(id: string): Promise<void> {
    await api.post(`/user/integrations/${id}/test`);
  }
}

export const integrationsAPI = new IntegrationsAPI();
