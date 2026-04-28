/**
 * Demo Mode - Central utility & re-exports
 *
 * When websiteId === 'demo', ALL data comes from these static generators.
 * Zero API calls are made. Mutations show a toast and return no-op results.
 */

import { toast } from 'sonner';

// Single source of truth
export const DEMO_WEBSITE_ID = 'demo';
export const isDemo = (websiteId: string) => websiteId === DEMO_WEBSITE_ID;

/**
 * Guard for mutation hooks. Call at the top of any mutationFn.
 * Returns true if demo mode (mutation should be skipped).
 */
export function demoMutationGuard(websiteId: string): boolean {
  if (!isDemo(websiteId)) return false;
  toast.info('Demo Mode', {
    description: 'Changes are not saved in demo mode. Sign up to get started!',
  });
  return true;
}

// Re-export all demo data generators
export { demoAnalyticsData, demoRealtimeData, demoCustomEvents, demoGeolocation } from './analytics';
export { demoAutomations } from './automations';
export { demoFunnels, demoFunnelAnalytics, demoFunnelStats } from './funnels';
export { demoReplays } from './replays';
export { demoHeatmapPages, demoHeatmapPoints } from './heatmaps';
export { demoWebsite, demoGoals, demoMembers, demoPrivacySettings } from './settings';
export { demoBilling, demoSubscription } from './billing';
export { demoPathAnalysis } from './paths';
export { demoSupportTickets } from './support';
export { demoRevenueDashboard } from './revenue';
