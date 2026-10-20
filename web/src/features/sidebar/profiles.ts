/**
 * The sidebar's order for each kind of business (a website's `profile`). Not every site needs every
 * page: a Facebook seller lives in Conversions, a store in Conversions and Revenue, a service
 * business in Leads. The pages a profile names come first, in that order; the rest go under "More". Nothing is
 * gated: every page still opens, and a person's own hidden pages (nav-prefs.ts) still apply.
 */
import type { WebsiteProfile } from '@/features/websites/types';
import type { NavId } from './nav-prefs';

export const PROFILE_NAV: Record<WebsiteProfile, readonly NavId[]> = {
  fcommerce: ['overview', 'conversions', 'recording', 'heatmaps', 'funnels'],
  store: ['overview', 'conversions', 'revenue', 'funnels', 'recording', 'heatmaps'],
  leads: ['overview', 'leads', 'automations', 'integrations', 'conversions', 'recording'],
  other: ['overview', 'funnels', 'recording', 'heatmaps', 'errors', 'ai-reports'],
};

/**
 * Splits the sidebar's items into the profile's pages, in its order, and the rest, in their usual
 * order. With no profile everything is primary, as before profiles existed.
 */
export function arrangeNav<T extends { id: NavId }>(items: readonly T[], profile: WebsiteProfile | null): { primary: T[]; more: T[] } {
  if (!profile) return { primary: [...items], more: [] };
  const order = PROFILE_NAV[profile];
  const byId = new Map(items.map((item) => [item.id, item]));
  const primary = order.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  const more = items.filter((item) => !order.includes(item.id));
  return { primary, more };
}
