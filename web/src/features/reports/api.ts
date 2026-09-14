import api from '@/lib/api';
import type {
  CreateReportRequest,
  ScheduledReport,
} from './types';





class ReportsAPI {
  async list(): Promise<ScheduledReport[]> {
    const response = await api.get('/user/reports');
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(this.mapReport) : [];
  }

  async create(req: CreateReportRequest): Promise<ScheduledReport> {
    const response = await api.post('/user/reports', req);
    const raw = response.data?.data || response.data;
    return this.mapReport(raw);
  }

  async update(id: string, req: Partial<CreateReportRequest> & { enabled?: boolean }): Promise<void> {
    await api.put(`/user/reports/${id}`, req);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/user/reports/${id}`);
  }

  private mapReport(raw: any): ScheduledReport {
    return {
      id: raw.id,
      userId: raw.userId || raw.user_id || '',
      websiteId: raw.websiteId || raw.website_id || '',
      name: raw.name,
      frequency: raw.frequency || 'weekly',
      dayOfWeek: raw.dayOfWeek ?? raw.day_of_week ?? 1,
      dayOfMonth: raw.dayOfMonth ?? raw.day_of_month ?? 1,
      hourUtc: raw.hourUtc ?? raw.hour_utc ?? 9,
      recipients: raw.recipients || [],
      sections: raw.sections || ['overview', 'pages', 'sources', 'devices'],
      enabled: raw.enabled ?? true,
      lastSent: raw.lastSent || raw.last_sent || undefined,
      nextSend: raw.nextSend || raw.next_send || undefined,
      createdAt: raw.createdAt || raw.created_at || '',
      updatedAt: raw.updatedAt || raw.updated_at || '',
    };
  }
}

export const reportsAPI = new ReportsAPI();
