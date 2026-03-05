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

// User Notifications (Bell Icons)
export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  read: boolean;
  createdAt: string;
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

// Deprecated - kept for backwards compatibility
export const toggleAlert = async (websiteId: string, id: string) => {
  // This function is deprecated, update implementation if needed
  return Promise.resolve();
};

// User Notifications (Bell Icons)
export const getUserNotifications = async (): Promise<UserNotification[]> => {
  try {
    const response = await api.get('/user/notifications');
    // Backend returns { success: true, data: [...] }
    const payload = response.data;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
  } catch {
    return [];
  }
};

export const markNotificationRead = async (id: string) => {
  await api.put(`/user/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  await api.put('/user/notifications/read-all');
};
