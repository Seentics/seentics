import api from './api';

export type Website = {
  id: string;
  name: string;
  url: string;
  userId: string;
  siteId: string; // maps to _id in the response
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  isActive: boolean;
  automationEnabled: boolean;
  funnelEnabled: boolean;
  heatmapEnabled: boolean;
  verificationToken: string;
  settings: {
    allowedOrigins: string[];
    trackingEnabled: boolean;
    dataRetentionDays: number;
    useIpAnonymization: boolean;
    respectDoNotTrack: boolean;
    allowRawDataExport: boolean;
  };
  stats: {
    totalPageviews: number;
    uniqueVisitors: number;
    averageSessionDuration: number;
    bounceRate: number;
  };
};

// Fetches all websites for the current user.
export async function getWebsites(): Promise<Website[]> {
  try {
    const response = await api.get('/user/websites');
    const websites = response?.data?.data || [];
    return websites.map((w: any) => ({
      id: w.id,
      name: w.name,
      url: w.url,
      userId: w.user_id,
      siteId: w.site_id,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      isVerified: w.is_verified,
      isActive: w.is_active,
      automationEnabled: w.automation_enabled ?? true,
      funnelEnabled: w.funnel_enabled ?? true,
      heatmapEnabled: w.heatmap_enabled ?? true,
      verificationToken: w.verification_token,
      settings: w.settings || {
        allowedOrigins: [],
        trackingEnabled: true,
        dataRetentionDays: 365,
        useIpAnonymization: false,
        respectDoNotTrack: false,
        allowRawDataExport: false
      },
      stats: w.stats || {
        totalPageviews: 0,
        uniqueVisitors: 0,
        averageSessionDuration: 0,
        bounceRate: 0
      },
    }));
  } catch (error) {
    console.error('Error fetching websites:', error);
    return [];
  }
}


// Adds a new website.
export async function addWebsite(website: { name: string; url: string }, userId: string): Promise<Website> {
  console.log('Inside add website')
  try {
    const response: any = await api.post('/user/websites', { ...website, userId });
    console.log('Full API response:', response);
    console.log('Response data:', response?.data);

    // Try different possible response structures
    const websiteData = response?.data?.data?.website || response?.data?.website || response?.data?.data || response?.data || response;
    console.log('Parsed website data:', websiteData);

    if (!websiteData || (!websiteData._id && !websiteData.id)) {
      throw new Error('Invalid website data received from server');
    }

    return {
      id: websiteData.id,
      siteId: websiteData.site_id,
      name: websiteData.name,
      url: websiteData.url,
      userId: websiteData.user_id,
      createdAt: websiteData.created_at,
      updatedAt: websiteData.updated_at,
      isVerified: websiteData.is_verified || false,
      isActive: websiteData.is_active || true,
      automationEnabled: websiteData.automation_enabled ?? true,
      funnelEnabled: websiteData.funnel_enabled ?? true,
      heatmapEnabled: websiteData.heatmap_enabled ?? true,
      verificationToken: websiteData.verification_token || '',
      settings: websiteData.settings || {
        allowedOrigins: [],
        trackingEnabled: true,
        dataRetentionDays: 365,
        useIpAnonymization: false,
        respectDoNotTrack: false,
        allowRawDataExport: false
      },
      stats: websiteData.stats || {
        totalPageviews: 0,
        uniqueVisitors: 0,
        averageSessionDuration: 0,
        bounceRate: 0
      }
    };
  } catch (error: any) {
    console.error('Error adding website: ', error);

    // Check for limit reached error
    if (error.response?.status === 403 && error.response?.data?.error === 'LIMIT_REACHED') {
      const errorData = error.response.data.data;
      throw new Error(`Website limit reached! You've used ${errorData.currentUsage}/${errorData.limit} websites on your ${errorData.currentPlan} plan. Please upgrade to add more websites.`);
    }

    // Check for other limit-related errors
    if (error.response?.data?.message?.includes('limit')) {
      throw new Error(error.response.data.message);
    }

    throw error;
  }
}

// Deletes a website by its ID.
export async function deleteWebsite(siteId: string, userId: string): Promise<void> {
  try {
    await api.delete(`/user/websites/${siteId}`, { data: { userId } });
  } catch (error) {
    console.error('Error deleting website:', error);
    throw error;
  }
}

// Gets a single website by its public siteId.
export async function getWebsiteBySiteId(siteId: string): Promise<Website | null> {
  if (!siteId) return null;
  try {
    const response = await api.get(`/user/websites/by-site-id/${siteId}`);
    const w = response.data.data;
    if (!w) return null;
    return {
      id: w.id,
      siteId: w.site_id,
      name: w.name,
      url: w.url,
      userId: w.user_id,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      isVerified: w.is_verified,
      isActive: w.is_active,
      automationEnabled: w.automation_enabled ?? true,
      funnelEnabled: w.funnel_enabled ?? true,
      heatmapEnabled: w.heatmap_enabled ?? true,
      verificationToken: w.verification_token,
      settings: w.settings || {
        allowedOrigins: [],
        trackingEnabled: true,
        dataRetentionDays: 365,
        useIpAnonymization: false,
        respectDoNotTrack: false,
        allowRawDataExport: false
      },
      stats: w.stats || {
        totalPageviews: 0,
        uniqueVisitors: 0,
        averageSessionDuration: 0,
        bounceRate: 0
      }
    };
  } catch (error) {
    console.error('Error fetching website by siteId:', error);
    return null;
  }
}

// Updates an existing website.
export async function updateWebsite(
  websiteId: string,
  data: Partial<Pick<Website, 'name' | 'url' | 'isActive' | 'automationEnabled' | 'funnelEnabled' | 'heatmapEnabled' | 'settings'>>,
  userId: string
): Promise<Website> {
  try {
    const response = await api.put(`/user/websites/${websiteId}`, {
      ...data,
      user_id: userId,
      is_active: data.isActive,
      automation_enabled: data.automationEnabled,
      funnel_enabled: data.funnelEnabled,
      heatmap_enabled: data.heatmapEnabled
    });
    const w = response.data.data;

    return {
      id: w.id,
      siteId: w.site_id,
      name: w.name,
      url: w.url,
      userId: w.user_id,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      isVerified: w.is_verified,
      isActive: w.is_active,
      automationEnabled: w.automation_enabled ?? true,
      funnelEnabled: w.funnel_enabled ?? true,
      heatmapEnabled: w.heatmap_enabled ?? true,
      verificationToken: w.verification_token,
      settings: w.settings || {
        allowedOrigins: [],
        trackingEnabled: true,
        dataRetentionDays: 365,
        useIpAnonymization: false,
        respectDoNotTrack: false,
        allowRawDataExport: false
      },
      stats: w.stats || {
        totalPageviews: 0,
        uniqueVisitors: 0,
        averageSessionDuration: 0,
        bounceRate: 0
      }
    };
  } catch (error) {
    console.error('Error updating website:', error);
    throw error;
  }
}

// --- Goals ---

export interface Goal {
  id: string;
  websiteId: string;
  name: string;
  type: 'event' | 'pageview';
  identifier: string;
  createdAt: string;
  updatedAt: string;
}

export const getGoals = async (websiteId: string): Promise<Goal[]> => {
  const response = await api.get(`/user/websites/${websiteId}/goals`);
  return response.data.data || [];
};

export const addGoal = async (websiteId: string, data: { name: string; type: string; identifier: string; selector?: string }): Promise<Goal> => {
  const response = await api.post(`/user/websites/${websiteId}/goals`, data);
  return response.data;
};

export const deleteGoal = async (websiteId: string, goalId: string): Promise<void> => {
  await api.delete(`/user/websites/${websiteId}/goals/${goalId}`);
};

// --- Team Members ---

export interface WebsiteMember {
  id: string;
  websiteId: string;
  userId: string;
  role: 'owner' | 'admin' | 'viewer';
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
}

export const getMembers = async (websiteId: string): Promise<WebsiteMember[]> => {
  const response = await api.get(`/user/websites/${websiteId}/members`);
  return response.data.data || [];
};

export const addMember = async (websiteId: string, data: { email: string; role: string }): Promise<WebsiteMember> => {
  const response = await api.post(`/user/websites/${websiteId}/members`, data);
  return response.data.data;
};

export const removeMember = async (websiteId: string, userId: string): Promise<void> => {
  await api.delete(`/user/websites/${websiteId}/members/${userId}`);
};
