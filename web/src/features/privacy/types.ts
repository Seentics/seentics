/** Domain types for the privacy feature. */

import api from '@/lib/api';
import { isEnterprise } from '@/lib/features';

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
