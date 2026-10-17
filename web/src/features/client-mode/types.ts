import type { FeatureAccess, FeatureId } from '@/features/agency/types';

/**
 * Client mode: an agency's client user signed in to the real dashboard by email link. The shapes
 * here are the gateway's `/client-auth/*` and `/client/me` answers, snake_case as on the wire.
 */

export type { FeatureAccess, FeatureId };

/** What a client may do on each page of one website; a page left out is `off`. */
export type SiteFeatures = Partial<Record<FeatureId, FeatureAccess>>;

/** The agency's look, as `GET /client-auth/brand` and `/client/me` answer it. */
export interface ClientBrand {
  slug: string;
  brand_name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  footer_text: string;
  hide_seentics: boolean;
}

export interface ClientWebsite {
  id: string;
  name: string;
  url: string;
  client_id: string;
  client_name: string;
  features: SiteFeatures;
}

export interface ClientMe {
  user: { id: string; email: string; name: string };
  agency: { owner_id: string; slug: string | null };
  brand: ClientBrand | null;
  websites: ClientWebsite[];
}
