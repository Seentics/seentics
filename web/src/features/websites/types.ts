/** Domain types for the websites feature. */


import { isDemo, demoMutationGuard, demoWebsite, demoGoals, demoMembers } from '@/lib/demo';

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
  errorsEnabled: boolean;
  heatmapEnabled: boolean;
  /** Whether visitors' browsers capture page backgrounds for heatmaps. Read only on the detail fetch. */
  heatmapLayoutEnabled?: boolean;
  heatmapIncludePatterns?: string;
  heatmapExcludePatterns?: string;
  replayEnabled: boolean;
  replaySamplingRate: number;
  replayIncludePatterns?: string;
  replayExcludePatterns?: string;
  /** Recordings and heatmap snapshots mask all page text: everywhere, or on these pages. */
  maskAllText?: boolean;
  maskTextPatterns?: string | null;
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

export type WebsiteRole = 'owner' | 'admin' | 'viewer' | '';

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
