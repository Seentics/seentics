'use client';

import { useQuery } from '@tanstack/react-query';
import { useOnCustomHost } from '@/lib/seentics-host';
import { getClientBrand } from './api';
import { BrandEffects } from './ClientMode';

export const CUSTOM_HOST_BRAND_KEY = ['client-auth', 'host-brand'] as const;

/**
 * On an agency's own domain, every page wears the agency's brand (colour, tab title, favicon) from
 * the first paint after hydration, signed in or not: the brand of the agency owning the domain
 * (`GET /client-auth/brand` with no slug, through the same-origin proxy). Nothing on our hosts.
 */
export function CustomHostBrand() {
  const customHost = useOnCustomHost();
  const { data: brand } = useQuery({
    queryKey: CUSTOM_HOST_BRAND_KEY,
    queryFn: () => getClientBrand(null),
    enabled: customHost,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return customHost && brand ? <BrandEffects brand={brand} /> : null;
}
