import api from './api';
import { isEnterprise } from './features';

export interface WebsitePrivacySettings {
  ipAnonymization: 'none' | 'partial' | 'full';
  respectDnt: boolean;
  consentMode: 'cookieless' | 'strict';
  dataRetentionDays: number | null;
}

export interface GDPRRequestItem {
  id: string;
  userId: string;
  userEmail?: string;
  requestType: string;
  status: string;
  processedBy?: string;
  processedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResult {
  events: number;
  sessions: number;
  goals: number;
  funnels: number;
}

class PrivacyAPI {
  // --- Export ---

  // Export all analytics data for the current user (all websites)
  async exportAnalyticsData(userId: string): Promise<any> {
    if (userId === 'demo') return { mock: 'data' };
    try {
      if (isEnterprise) {
        const response = await api.get('/user/gdpr/export');
        return response.data;
      }
      const response = await api.get(`/privacy/export/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      throw error;
    }
  }

  // Export all data for a specific website
  async exportWebsiteData(websiteId: string): Promise<any> {
    if (websiteId === 'demo') return { mock: 'data' };
    try {
      const response = await api.get(`/privacy/export/website/${websiteId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to export website data:', error);
      throw error;
    }
  }

  // --- Import ---

  // Import data into a website from JSON file
  async importWebsiteData(websiteId: string, file: File): Promise<{ success: boolean; message: string; data: ImportResult }> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post(`/privacy/import/${websiteId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to import website data:', error);
      throw error;
    }
  }

  // --- Delete ---

  async deleteAnalyticsData(userId: string): Promise<{ success: boolean; message: string }> {
    if (userId === 'demo') return { success: true, message: 'Demo data deleted' };
    try {
      const response = await api.delete(`/privacy/delete/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete analytics data:', error);
      throw error;
    }
  }

  async deleteWebsiteAnalytics(websiteId: string): Promise<{ success: boolean; message: string }> {
    if (websiteId === 'demo') return { success: true, message: 'Demo data deleted' };
    try {
      const response = await api.delete(`/privacy/delete/website/${websiteId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete website analytics:', error);
      throw error;
    }
  }

  // --- Anonymize ---

  async anonymizeAnalyticsData(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/privacy/anonymize/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to anonymize analytics data:', error);
      throw error;
    }
  }

  // --- Retention ---

  async getDataRetentionPolicies(): Promise<{ success: boolean; data: any[] }> {
    try {
      const response = await api.get('/privacy/retention-policies');
      return response.data;
    } catch (error) {
      console.error('Failed to get data retention policies:', error);
      throw error;
    }
  }

  async runDataRetentionCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/privacy/cleanup');
      return response.data;
    } catch (error) {
      console.error('Failed to run data retention cleanup:', error);
      throw error;
    }
  }

  // --- Enterprise: per-website privacy settings ---

  async getWebsitePrivacy(siteId: string): Promise<{ success: boolean; data: WebsitePrivacySettings }> {
    const response = await api.get(`/user/websites/${siteId}/privacy`);
    return response.data;
  }

  async updateWebsitePrivacy(siteId: string, settings: Partial<WebsitePrivacySettings>): Promise<{ success: boolean; data: WebsitePrivacySettings }> {
    const response = await api.put(`/user/websites/${siteId}/privacy`, settings);
    return response.data;
  }

  // --- Enterprise: GDPR request management ---

  async getGDPRRequests(): Promise<{ success: boolean; data: GDPRRequestItem[] }> {
    const response = await api.get('/user/gdpr/requests');
    return response.data;
  }

  async cancelGDPRRequest(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/user/gdpr/requests/${id}/cancel`);
    return response.data;
  }
}

export const privacyAPI = new PrivacyAPI();
