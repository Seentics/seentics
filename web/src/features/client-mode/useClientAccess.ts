'use client';

import { useQuery } from '@tanstack/react-query';
import { getClientMe } from './api';
import { canEditAccess, canView } from './routes';
import { useIsClientSession } from './session';
import type { ClientMe, ClientWebsite, FeatureAccess, FeatureId, SiteFeatures } from './types';

export const CLIENT_ME_KEY = ['client-me'] as const;

export interface ClientAccess {
  /** Signed in as an agency's client user. Everything else here is meaningful only then. */
  isClient: boolean;
  /** A client whose `/client/me` has not answered yet: offer nothing until it has. */
  isLoading: boolean;
  me: ClientMe | null;
  websites: ClientWebsite[];
  /** The website's entry, or `null` when it is not one of the client's. */
  site: ClientWebsite | null;
  /** The website's features (empty while loading or for a site that is not theirs). */
  features: SiteFeatures;
  /** `edit` for an account; for a client, what the agency allowed (`off` until known). */
  access: (feature: FeatureId) => FeatureAccess;
  canSee: (feature: FeatureId) => boolean;
  canEdit: (feature: FeatureId) => boolean;
}

/**
 * Client mode's one source: `/client/me`, asked only when the stored session is a client user's.
 * For an account every feature reads as `edit`, so callers need no branch of their own.
 */
export function useClientAccess(websiteId?: string | null): ClientAccess {
  const isClient = useIsClientSession();
  const query = useQuery({
    queryKey: CLIENT_ME_KEY,
    queryFn: getClientMe,
    enabled: isClient,
    staleTime: 60_000,
    retry: 1,
  });
  const me = isClient ? query.data ?? null : null;
  const websites = me?.websites ?? [];
  const site = websiteId ? websites.find(w => w.id === websiteId) ?? null : null;
  const features: SiteFeatures = site?.features ?? {};
  const access = (feature: FeatureId): FeatureAccess => (isClient ? features[feature] ?? 'off' : 'edit');
  return {
    isClient,
    isLoading: isClient && query.isLoading,
    me,
    websites,
    site,
    features,
    access,
    canSee: feature => canView(access(feature)),
    canEdit: feature => canEditAccess(access(feature)),
  };
}
