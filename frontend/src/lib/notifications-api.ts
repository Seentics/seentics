import api from './api';

export interface NotificationChannel {
  id: string;
  website_id: string;
  type: 'email' | 'slack' | 'webhook';
  config: any;
  created_at: string;
}

export interface NotificationAlert {
  id: string;
  website_id: string;
  type: string;
  condition: string;
  threshold: number;
  interval: string;
  is_active: boolean;
  channels: string[];
  created_at: string;
  updated_at: string;
}

export const listChannels = async (websiteId: string): Promise<NotificationChannel[]> => {
  const response = await api.get(`/websites/${websiteId}/notifications/channels`);
  return response.data.data;
};

export const createChannel = async (websiteId: string, data: Partial<NotificationChannel>) => {
  const response = await api.post(`/websites/${websiteId}/notifications/channels`, data);
  return response.data.data;
};

export const deleteChannel = async (websiteId: string, id: string) => {
  const response = await api.delete(`/websites/${websiteId}/notifications/channels/${id}`);
  return response.data;
};

export const listAlerts = async (websiteId: string): Promise<NotificationAlert[]> => {
  const response = await api.get(`/websites/${websiteId}/notifications/alerts`);
  return response.data.data;
};

export const createAlert = async (websiteId: string, data: Partial<NotificationAlert>) => {
  const response = await api.post(`/websites/${websiteId}/notifications/alerts`, data);
  return response.data.data;
};

export const deleteAlert = async (websiteId: string, id: string) => {
  const response = await api.delete(`/websites/${websiteId}/notifications/alerts/${id}`);
  return response.data;
};

export const toggleAlert = async (websiteId: string, id: string) => {
  const response = await api.post(`/websites/${websiteId}/notifications/alerts/${id}/toggle`);
  return response.data;
};
