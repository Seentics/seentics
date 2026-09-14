import api from '@/lib/api';
import type {
  AlertEvent,
  AlertRule,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
} from './types';







class AlertsAPI {
  async listRules(): Promise<AlertRule[]> {
    const response = await api.get('/user/alerts/rules');
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(this.mapRule) : [];
  }

  async createRule(req: CreateAlertRuleRequest): Promise<AlertRule> {
    const response = await api.post('/user/alerts/rules', req);
    const raw = response.data?.data || response.data;
    return this.mapRule(raw);
  }

  async updateRule(id: string, req: UpdateAlertRuleRequest): Promise<void> {
    await api.put(`/user/alerts/rules/${id}`, req);
  }

  async deleteRule(id: string): Promise<void> {
    await api.delete(`/user/alerts/rules/${id}`);
  }

  async toggleRule(id: string, enabled: boolean): Promise<void> {
    await api.put(`/user/alerts/rules/${id}/toggle`, { enabled });
  }

  async listEvents(limit = 50): Promise<AlertEvent[]> {
    const response = await api.get(`/user/alerts/events?limit=${limit}`);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(this.mapEvent) : [];
  }

  private mapRule(raw: any): AlertRule {
    return {
      id: raw.id,
      userId: raw.userId || raw.user_id || '',
      websiteId: raw.websiteId || raw.website_id || undefined,
      name: raw.name,
      conditionType: raw.conditionType || raw.condition_type,
      threshold: raw.threshold,
      timeWindow: raw.timeWindow || raw.time_window || '1h',
      channels: raw.channels || ['in_app'],
      enabled: raw.enabled ?? true,
      cooldownMinutes: raw.cooldownMinutes || raw.cooldown_minutes || 60,
      lastTriggered: raw.lastTriggered || raw.last_triggered || undefined,
      createdAt: raw.createdAt || raw.created_at || '',
      updatedAt: raw.updatedAt || raw.updated_at || '',
    };
  }

  private mapEvent(raw: any): AlertEvent {
    return {
      id: raw.id,
      ruleId: raw.ruleId || raw.rule_id || '',
      userId: raw.userId || raw.user_id || '',
      triggeredValue: raw.triggeredValue || raw.triggered_value || 0,
      message: raw.message || '',
      channels: raw.channels || [],
      createdAt: raw.createdAt || raw.created_at || '',
    };
  }
}

export const alertsAPI = new AlertsAPI();
