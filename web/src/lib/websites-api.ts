import api from './api';
import { isDemo, demoMutationGuard, demoWebsite, demoGoals, demoMembers } from './demo';

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
  heatmapIncludePatterns?: string;
  heatmapExcludePatterns?: string;
  replayEnabled: boolean;
  replaySamplingRate: number;
  replayIncludePatterns?: string;
  replayExcludePatterns?: string;
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

/** Fetches a website by dashboard UUID (primary public website identifier). */
export async function getWebsiteByAnyId(id: string): Promise<Website | null> {
  if (!id) return null;
  if (isDemo(id)) return demoWebsite() as Website;
  return getWebsite(id);
}

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
      heatmapIncludePatterns: w.heatmap_include_patterns,
      heatmapExcludePatterns: w.heatmap_exclude_patterns,
      replayEnabled: w.replay_enabled ?? true,
      replaySamplingRate: w.replay_sampling_rate ?? 1.0,
      replayIncludePatterns: w.replay_include_patterns,
      replayExcludePatterns: w.replay_exclude_patterns,
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
  try {
    const response: any = await api.post('/user/websites', { ...website, userId });

    // Try different possible response structures
    const websiteData = response?.data?.data?.website || response?.data?.website || response?.data?.data || response?.data || response;

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
      heatmapIncludePatterns: websiteData.heatmap_include_patterns,
      heatmapExcludePatterns: websiteData.heatmap_exclude_patterns,
      replayEnabled: websiteData.replay_enabled ?? true,
      replaySamplingRate: websiteData.replay_sampling_rate ?? 1.0,
      replayIncludePatterns: websiteData.replay_include_patterns,
      replayExcludePatterns: websiteData.replay_exclude_patterns,
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

// Gets a single website by UUID (same id as /websites/[websiteId] routes).
export async function getWebsiteBySiteId(websiteId: string): Promise<Website | null> {
  return getWebsite(websiteId);
}

async function getWebsite(websiteId: string): Promise<Website | null> {
  if (!websiteId) return null;
  try {
    const response = await api.get(`/user/websites/${websiteId}`);
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
      heatmapIncludePatterns: w.heatmap_include_patterns,
      heatmapExcludePatterns: w.heatmap_exclude_patterns,
      replayEnabled: w.replay_enabled ?? true,
      replaySamplingRate: w.replay_sampling_rate ?? 1.0,
      replayIncludePatterns: w.replay_include_patterns,
      replayExcludePatterns: w.replay_exclude_patterns,
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
    console.error('Error fetching website:', error);
    return null;
  }
}

// Updates an existing website.
export async function updateWebsite(
  websiteId: string,
  data: Partial<Pick<Website, 'name' | 'url' | 'isActive' | 'automationEnabled' | 'funnelEnabled' | 'heatmapEnabled' | 'heatmapIncludePatterns' | 'heatmapExcludePatterns' | 'replayEnabled' | 'replaySamplingRate' | 'replayIncludePatterns' | 'replayExcludePatterns' | 'settings'>>,
  userId: string
): Promise<Website> {
  try {
    const response = await api.put(`/user/websites/${websiteId}`, {
      ...data,
      user_id: userId,
      is_active: data.isActive,
      automation_enabled: data.automationEnabled,
      funnel_enabled: data.funnelEnabled,
      heatmap_enabled: data.heatmapEnabled,
      heatmap_include_patterns: data.heatmapIncludePatterns,
      heatmap_exclude_patterns: data.heatmapExcludePatterns,
      replay_enabled: data.replayEnabled,
      replay_sampling_rate: data.replaySamplingRate,
      replay_include_patterns: data.replayIncludePatterns,
      replay_exclude_patterns: data.replayExcludePatterns
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
      heatmapIncludePatterns: w.heatmap_include_patterns,
      heatmapExcludePatterns: w.heatmap_exclude_patterns,
      replayEnabled: w.replay_enabled ?? true,
      replaySamplingRate: w.replay_sampling_rate ?? 1.0,
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
  selector?: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapApiGoal(r: Record<string, unknown>): Goal {
  const typ = r.type === 'pageview' ? 'pageview' : 'event';
  return {
    id: String(r.id ?? ''),
    websiteId: String(r.website_id ?? r.websiteId ?? ''),
    name: String(r.name ?? ''),
    type: typ,
    identifier: String(r.identifier ?? ''),
    selector: (r.selector as string | null | undefined) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? ''),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? ''),
  };
}

export const getGoals = async (websiteId: string): Promise<Goal[]> => {
  if (isDemo(websiteId)) return demoGoals();
  const response = await api.get(`/user/websites/${websiteId}/goals`);
  const raw = (response.data?.data ?? []) as Record<string, unknown>[];
  return raw.map(mapApiGoal);
};

export const addGoal = async (websiteId: string, data: { name: string; type: string; identifier: string; selector?: string }): Promise<Goal> => {
  if (demoMutationGuard(websiteId)) {
    return { id: 'demo-goal', websiteId, name: data.name, type: data.type as any, identifier: data.identifier, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  const response = await api.post(`/user/websites/${websiteId}/goals`, data);
  const raw = (response.data?.data ?? response.data) as Record<string, unknown>;
  return mapApiGoal(raw);
};

export const updateGoal = async (
  websiteId: string,
  goalId: string,
  data: { name: string; type: string; identifier: string; selector?: string },
): Promise<Goal> => {
  if (demoMutationGuard(websiteId)) {
    return {
      id: goalId,
      websiteId,
      name: data.name,
      type: data.type as 'event' | 'pageview',
      identifier: data.identifier,
      selector: data.selector,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const response = await api.patch(`/user/websites/${websiteId}/goals/${goalId}`, data);
  return response.data?.data ?? response.data;
};

export const deleteGoal = async (websiteId: string, goalId: string): Promise<void> => {
  if (demoMutationGuard(websiteId)) return;
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
  if (isDemo(websiteId)) return demoMembers();
  const response = await api.get(`/user/websites/${websiteId}/members`);
  return response.data.data || [];
};

export const addMember = async (websiteId: string, data: { email: string; role: string }): Promise<WebsiteMember> => {
  if (demoMutationGuard(websiteId)) {
    return { id: 'demo-new', websiteId, userId: 'demo', role: data.role as any, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userEmail: data.email };
  }
  const response = await api.post(`/user/websites/${websiteId}/members`, data);
  return response.data.data;
};

export const removeMember = async (websiteId: string, userId: string): Promise<void> => {
  if (demoMutationGuard(websiteId)) return;
  await api.delete(`/user/websites/${websiteId}/members/${userId}`);
};

export const updateMemberRole = async (websiteId: string, userId: string, role: string): Promise<void> => {
  if (demoMutationGuard(websiteId)) return;
  await api.put(`/user/websites/${websiteId}/members/${userId}/role`, { role });
};

// --- Permissions ---

export type WebsiteRole = 'owner' | 'admin' | 'viewer' | '';

export const getMyRole = async (websiteId: string): Promise<WebsiteRole> => {
  if (isDemo(websiteId)) return 'owner'; // demo mode always has full access
  try {
    const response = await api.get(`/user/websites/${websiteId}/my-role`);
    return response.data.role || '';
  } catch {
    return '';
  }
};

// --- Token-based Invitations ---

export interface WebsiteInvitation {
  id: string;
  websiteId: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  websiteName?: string;
}

export const inviteMemberByToken = async (websiteId: string, data: { email: string; role: string }): Promise<WebsiteInvitation> => {
  if (demoMutationGuard(websiteId)) {
    return { id: 'demo-inv', websiteId, email: data.email, role: data.role, token: 'demo-token', invitedBy: 'demo', expiresAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  }
  const response = await api.post(`/user/websites/${websiteId}/invitations`, data);
  return response.data.data;
};

export const listPendingInvitations = async (websiteId: string): Promise<WebsiteInvitation[]> => {
  if (isDemo(websiteId)) return [];
  const response = await api.get(`/user/websites/${websiteId}/invitations`);
  return response.data.data || [];
};

export const revokeInvitation = async (websiteId: string, invitationId: string): Promise<void> => {
  if (demoMutationGuard(websiteId)) return;
  await api.delete(`/user/websites/${websiteId}/invitations/${invitationId}`);
};

export const acceptInvitation = async (token: string): Promise<void> => {
  await api.post(`/user/accept-invite`, { token });
};
