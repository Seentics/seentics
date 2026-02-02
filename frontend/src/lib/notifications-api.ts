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
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
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

// User Notifications (Bell Icons)
export const getUserNotifications = async (): Promise<UserNotification[]> => {
  try {
    const response = await api.get('/user/notifications');
    return response.data;
  } catch (error) {
    // If not logged in or error, return demo notifications
    return [
      {
        id: '1',
        user_id: 'demo',
        type: 'alert',
        title: 'Traffic Spike',
        message: 'Your website "Seentics Demo" is receiving 300% more traffic than usual.',
        link: '/websites/demo/pulse',
        is_read: false,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        user_id: 'demo',
        type: 'automation',
        title: 'Workflow Executed',
        message: 'The "Welcome Email" automation was triggered for a new signup.',
        link: '/websites/demo/automations',
        is_read: true,
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  }
};

export const markNotificationRead = async (id: string) => {
  await api.put(`/user/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  await api.put('/user/notifications/read-all');
};
