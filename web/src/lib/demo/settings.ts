/**
 * Demo data for website settings, goals, team members, privacy
 */

export const demoWebsite = () => ({
  id: 'demo',
  name: 'Seentics Production',
  url: 'https://seentics.com',
  userId: 'demo-user',
  siteId: 'production-demo',
  createdAt: new Date(2025, 0, 1).toISOString(),
  updatedAt: new Date().toISOString(),
  isVerified: true,
  isActive: true,
  automationEnabled: true,
  funnelEnabled: true,
  heatmapEnabled: true,
  replayEnabled: true,
  replaySamplingRate: 100,
  verificationToken: '',
  settings: {
    allowedOrigins: ['*'],
    trackingEnabled: true,
    dataRetentionDays: 365,
    useIpAnonymization: true,
    respectDoNotTrack: true,
    allowRawDataExport: true,
  },
  stats: {
    totalPageviews: 421876,
    uniqueVisitors: 89432,
    averageSessionDuration: 312,
    bounceRate: 34.2,
  },
});

export const demoGoals = () => ([
  { id: 'goal-1', websiteId: 'demo', name: 'Signup Completed', type: 'event' as const, identifier: 'signup_complete', createdAt: new Date(2025, 0, 15).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'goal-2', websiteId: 'demo', name: 'Newsletter Subscribe', type: 'event' as const, identifier: 'newsletter_subscribe', createdAt: new Date(2025, 1, 1).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'goal-3', websiteId: 'demo', name: 'Pricing Page Visit', type: 'pageview' as const, identifier: '/pricing', createdAt: new Date(2025, 1, 10).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'goal-4', websiteId: 'demo', name: 'Contact Form Submit', type: 'event' as const, identifier: 'contact_submit', createdAt: new Date(2025, 2, 1).toISOString(), updatedAt: new Date().toISOString() },
]);

export const demoMembers = () => ([
  { id: 'member-1', websiteId: 'demo', userId: 'demo-user', role: 'owner' as const, createdAt: new Date(2025, 0, 1).toISOString(), updatedAt: new Date().toISOString(), userName: 'Demo Admin', userEmail: 'admin@seentics.com' },
  { id: 'member-2', websiteId: 'demo', userId: 'demo-user-2', role: 'admin' as const, createdAt: new Date(2025, 1, 1).toISOString(), updatedAt: new Date().toISOString(), userName: 'Sarah Chen', userEmail: 'sarah@seentics.com' },
  { id: 'member-3', websiteId: 'demo', userId: 'demo-user-3', role: 'viewer' as const, createdAt: new Date(2025, 2, 1).toISOString(), updatedAt: new Date().toISOString(), userName: 'Marcus Johnson', userEmail: 'marcus@seentics.com' },
]);

export const demoPrivacySettings = () => ({
  settings: {
    analyticsTracking: true,
    marketingEmails: false,
    personalizedContent: false,
    thirdPartySharing: false,
    dataRetention: '365',
    cookieConsent: true,
    notifications: true,
    gdprConsent: true,
    ccpaOptOut: false,
  },
  websitePrivacy: {
    ipAnonymization: true,
    cookielessMode: true,
    respectDoNotTrack: true,
    dataRetentionDays: 365,
    consentRequired: false,
    gdprCompliant: true,
    ccpaCompliant: true,
  },
  complianceStatus: {
    gdpr: { compliant: true, score: 95, lastAudit: new Date().toISOString() },
    ccpa: { compliant: true, score: 90, lastAudit: new Date().toISOString() },
    pecr: { compliant: true, score: 88, lastAudit: new Date().toISOString() },
  },
  gdprRequests: [],
});
