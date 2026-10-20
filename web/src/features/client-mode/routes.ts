import type { NavId } from '@/features/sidebar/nav-prefs';
import type { FeatureAccess, FeatureId, SiteFeatures } from './types';

/**
 * Which feature each dashboard page belongs to, for client mode. A client user may open a page
 * only when its feature is `view` or `edit` for that website; a page with no feature here
 * (Developers, docs, billing, team, websites, tracking, integrations, alerts, profile, support…)
 * is the account's and never shown to a client. The gateway enforces the same map
 * (`gateway/lib/client-feature-routes.ts`); this one only keeps the dashboard from offering
 * what would be refused.
 */
const PAGE_FEATURES: Array<[RegExp, FeatureId]> = [
  [/^\/?$/, 'overview'],
  [/^\/events(\/|$)/, 'events'],
  [/^\/paths(\/|$)/, 'paths'],
  [/^\/replays(\/|$)/, 'recordings'],
  [/^\/heatmaps(\/|$)/, 'heatmaps'],
  [/^\/funnels(\/|$)/, 'funnels'],
  [/^\/automations(\/|$)/, 'automations'],
  [/^\/leads(\/|$)/, 'leads'],
  [/^\/revenue(\/|$)/, 'revenue'],
  [/^\/conversions(\/|$)/, 'conversions'],
  [/^\/ai(-reports)?(\/|$)/, 'ai'],
  [/^\/errors(\/|$)/, 'errors'],
  [/^\/goals(\/|$)/, 'goals'],
  [/^\/settings\/goals(\/|$)/, 'goals'],
  [/^\/privacy(\/|$)/, 'privacy'],
  [/^\/settings\/privacy(\/|$)/, 'privacy'],
];

/** The feature of `/websites/<id>/<rest>`; `null` for an account-only page (or another path). */
export function featureForPath(pathname: string, websiteId: string): FeatureId | null {
  const prefix = `/websites/${websiteId}`;
  if (!websiteId || (pathname !== prefix && !pathname.startsWith(`${prefix}/`))) return null;
  const rest = pathname.slice(prefix.length);
  return PAGE_FEATURES.find(([re]) => re.test(rest))?.[1] ?? null;
}

/** Pages that only create things: a client who may only view the feature is sent to its list. */
const EDIT_ONLY: Array<[RegExp, string]> = [
  [/^\/automations\/(new|templates)(\/|$)/, '/automations'],
];

/** For a create-only page, the feature's list page to fall back to; `null` for any other page. */
export function editOnlyFallback(pathname: string, websiteId: string): string | null {
  const prefix = `/websites/${websiteId}`;
  if (!websiteId || !pathname.startsWith(`${prefix}/`)) return null;
  const hit = EDIT_ONLY.find(([re]) => re.test(pathname.slice(prefix.length)));
  return hit ? `${prefix}${hit[1]}` : null;
}

export const canView = (access: FeatureAccess | undefined): boolean => access === 'view' || access === 'edit';
export const canEditAccess = (access: FeatureAccess | undefined): boolean => access === 'edit';

/**
 * Where each feature's page is, in sidebar order: the first one a client may see is where a
 * hidden page sends them. Overview carries `?dashboard=1` so a site whose default is AI mode does
 * not bounce a client without AI back and forth.
 */
const LANDING: Array<[FeatureId, string]> = [
  ['overview', '?dashboard=1'],
  ['events', '/events'],
  ['paths', '/paths'],
  ['recordings', '/replays'],
  ['heatmaps', '/heatmaps'],
  ['funnels', '/funnels'],
  ['automations', '/automations'],
  ['leads', '/leads'],
  ['revenue', '/revenue'],
  ['conversions', '/conversions'],
  ['ai', '/ai-reports'],
  ['errors', '/errors'],
  ['goals', '/settings/goals'],
  ['privacy', '/settings/privacy'],
];

/** The first page of the website a client may open, or `null` when every feature is off. */
export function firstAllowedPath(websiteId: string, features: SiteFeatures | undefined): string | null {
  const hit = LANDING.find(([feature]) => canView(features?.[feature]));
  if (!hit) return null;
  return `/websites/${websiteId}${hit[1]}`;
}

/**
 * The sidebar's items and the feature each one opens. Settings shows when Goals or Privacy is
 * allowed (its only pages for a client); Developers never does.
 */
export const NAV_FEATURES: Record<NavId, FeatureId | 'settings' | null> = {
  overview: 'overview',
  recording: 'recordings',
  heatmaps: 'heatmaps',
  funnels: 'funnels',
  automations: 'automations',
  leads: 'leads',
  revenue: 'revenue',
  conversions: 'conversions',
  // Where form submissions are sent: the account's own connections, never a client's.
  integrations: null,
  'ai-reports': 'ai',
  errors: 'errors',
  developers: null,
  // Embeddable widgets keyed to the account's own site: a developer tool, like Developers.
  'ui-blocks': null,
  settings: 'settings',
};

/** Whether a client sees this sidebar item. */
export function navAllowed(id: NavId, features: SiteFeatures | undefined): boolean {
  const feature = NAV_FEATURES[id];
  if (feature === null) return false;
  if (feature === 'settings') return canView(features?.goals) || canView(features?.privacy);
  return canView(features?.[feature]);
}

/** A client's Settings: Goals when allowed, else Privacy. */
export function clientSettingsHref(websiteId: string, features: SiteFeatures | undefined): string {
  return canView(features?.goals) ? `/websites/${websiteId}/settings/goals` : `/websites/${websiteId}/settings/privacy`;
}
