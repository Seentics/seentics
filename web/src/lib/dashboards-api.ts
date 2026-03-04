import api from './api';

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  category: 'overview' | 'behavior' | 'acquisition' | 'performance';
  enabled: boolean;
  position: number;
  width: number;
  height: number;
}

export interface CustomDashboardData {
  id: string;
  userId: string;
  websiteId: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  layout: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardRequest {
  websiteId: string;
  name: string;
  description?: string;
  widgets?: WidgetConfig[];
  layout?: string;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  widgets?: WidgetConfig[];
  layout?: string;
  isDefault?: boolean;
}

export const AVAILABLE_WIDGETS: Omit<WidgetConfig, 'position'>[] = [
  { id: 'pageviews', type: 'metric', title: 'Page Views', category: 'overview', enabled: true, width: 1, height: 1 },
  { id: 'visitors', type: 'metric', title: 'Unique Visitors', category: 'overview', enabled: true, width: 1, height: 1 },
  { id: 'sessions', type: 'metric', title: 'Sessions', category: 'overview', enabled: true, width: 1, height: 1 },
  { id: 'bounce-rate', type: 'metric', title: 'Bounce Rate', category: 'overview', enabled: true, width: 1, height: 1 },
  { id: 'avg-duration', type: 'metric', title: 'Avg. Session Duration', category: 'overview', enabled: false, width: 1, height: 1 },
  { id: 'timeseries', type: 'chart', title: 'Traffic Over Time', category: 'overview', enabled: true, width: 4, height: 2 },
  { id: 'top-pages', type: 'table', title: 'Top Pages', category: 'behavior', enabled: true, width: 2, height: 2 },
  { id: 'entry-pages', type: 'table', title: 'Entry Pages', category: 'behavior', enabled: false, width: 2, height: 2 },
  { id: 'exit-pages', type: 'table', title: 'Exit Pages', category: 'behavior', enabled: false, width: 2, height: 2 },
  { id: 'events', type: 'table', title: 'Custom Events', category: 'behavior', enabled: false, width: 2, height: 2 },
  { id: 'referrers', type: 'table', title: 'Top Referrers', category: 'acquisition', enabled: true, width: 2, height: 2 },
  { id: 'sources', type: 'chart', title: 'Traffic Sources', category: 'acquisition', enabled: true, width: 2, height: 2 },
  { id: 'utm-campaigns', type: 'table', title: 'UTM Campaigns', category: 'acquisition', enabled: false, width: 2, height: 2 },
  { id: 'countries', type: 'chart', title: 'Countries', category: 'acquisition', enabled: false, width: 2, height: 2 },
  { id: 'browsers', type: 'chart', title: 'Browsers', category: 'performance', enabled: false, width: 2, height: 1 },
  { id: 'devices', type: 'chart', title: 'Devices', category: 'performance', enabled: true, width: 2, height: 1 },
  { id: 'os', type: 'chart', title: 'Operating Systems', category: 'performance', enabled: false, width: 2, height: 1 },
];

class DashboardsAPI {
  async list(websiteId: string): Promise<CustomDashboardData[]> {
    const response = await api.get(`/user/dashboards?website_id=${websiteId}`);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data : [];
  }

  async get(id: string): Promise<CustomDashboardData> {
    const response = await api.get(`/user/dashboards/${id}`);
    return response.data?.data || response.data;
  }

  async create(req: CreateDashboardRequest): Promise<CustomDashboardData> {
    const response = await api.post('/user/dashboards', req);
    return response.data?.data || response.data;
  }

  async update(id: string, req: UpdateDashboardRequest): Promise<void> {
    await api.put(`/user/dashboards/${id}`, req);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/user/dashboards/${id}`);
  }
}

export const dashboardsAPI = new DashboardsAPI();
