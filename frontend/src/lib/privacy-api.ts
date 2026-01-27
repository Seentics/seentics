import api from './api';

export interface PrivacySettings {
  analyticsTracking: boolean;
  marketingEmails: boolean;
  personalizedContent: boolean;
  thirdPartySharing: boolean;
  dataRetention: string;
  cookieConsent: {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
  notifications: {
    dataRequests: boolean;
    policyChanges: boolean;
    securityAlerts: boolean;
  };
  gdprConsent: {
    given: boolean;
    givenAt: string;
    version: string;
  };
  ccpaOptOut: {
    optedOut: boolean;
    optedOutAt?: string;
  };
}

export interface PrivacyRequest {
  id: string;
  type: 'export' | 'deletion' | 'correction' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reason?: string;
  details?: string;
  requestedData?: {
    profile: boolean;
    analytics: boolean;
    workflows: boolean;
    subscriptions: boolean;
  };
  processingNotes?: string;
  createdAt: string;
  completedAt?: string;
  estimatedCompletion: string;
  downloadUrl?: string;
  expiresAt?: string;
}

export interface ComplianceStatus {
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  pendingRequests: number;
  lastUpdated: string;
}

class PrivacyAPI {
  // Get user's privacy settings
  async getPrivacySettings(): Promise<{ success: boolean; data: { settings: PrivacySettings } }> {
    try {
      const response = await api.get('/user/privacy/settings');
      return response.data;
    } catch (error) {
      console.error('Failed to get privacy settings:', error);
      throw error;
    }
  }

  // Update user's privacy settings
  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<{ success: boolean; data: { settings: PrivacySettings } }> {
    try {
      const response = await api.put('/user/privacy/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      throw error;
    }
  }

  // Create a privacy request
  async createPrivacyRequest(request: {
    type: 'export' | 'deletion' | 'correction' | 'portability';
    reason?: string;
    details?: string;
    requestedData?: {
      profile: boolean;
      analytics: boolean;
      workflows: boolean;
      subscriptions: boolean;
    };
  }): Promise<{ success: boolean; data: { request: PrivacyRequest } }> {
    try {
      console.log('Creating privacy request:', request);
      const response = await api.post('/user/privacy/requests', request);
      console.log('Privacy request response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to create privacy request:', error);
      console.error('Request data:', request);
      throw error;
    }
  }

  // Get user's privacy requests
  async getPrivacyRequests(filters?: {
    status?: string;
    type?: string;
  }): Promise<{ success: boolean; data: { requests: PrivacyRequest[] } }> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);

      const response = await api.get(`/user/privacy/requests?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get privacy requests:', error);
      throw error;
    }
  }

  // Export user data (JSON response)
  async exportUserData(): Promise<{ success: boolean; data: any }> {
    try {
      const response = await api.get('/user/privacy/export');
      return response.data;
    } catch (error) {
      console.error('Failed to export user data:', error);
      throw error;
    }
  }

  // Download exported data as file
  async downloadExport(): Promise<Blob> {
    try {
      const response = await api.get('/user/privacy/download', {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to download export:', error);
      throw error;
    }
  }

  // Process data deletion
  async processDataDeletion(reason: string, confirmPassword?: string): Promise<{ success: boolean; message: string }> {
    try {
      const payload: any = { reason };
      if (confirmPassword) {
        payload.confirmPassword = confirmPassword;
      }
      const response = await api.post('/user/privacy/delete', payload);
      return response.data;
    } catch (error) {
      console.error('Failed to process data deletion:', error);
      throw error;
    }
  }

  // Get compliance status
  async getComplianceStatus(): Promise<{ success: boolean; data: { complianceStatus: ComplianceStatus } }> {
    try {
      const response = await api.get('/user/privacy/compliance');
      return response.data;
    } catch (error) {
      console.error('Failed to get compliance status:', error);
      throw error;
    }
  }

  // Analytics-specific privacy methods
  async exportAnalyticsData(userId: string): Promise<any> {
    try {
      const response = await api.get(`/privacy/export/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      throw error;
    }
  }

  async deleteAnalyticsData(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/privacy/delete/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete analytics data:', error);
      throw error;
    }
  }

  async deleteWebsiteAnalytics(websiteId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/privacy/delete/website/${websiteId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete website analytics:', error);
      throw error;
    }
  }

  async anonymizeAnalyticsData(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.put(`/privacy/anonymize/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to anonymize analytics data:', error);
      throw error;
    }
  }

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
}

export const privacyAPI = new PrivacyAPI();
