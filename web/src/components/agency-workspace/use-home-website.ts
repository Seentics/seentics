'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWebsites } from '@/features/websites/api';
import { rememberedWebsite } from '@/lib/last-website';

/**
 * A website to send "back to the dashboard" and account links (billing, API keys) to: the one
 * opened last, else the account's first. `null` while unknown or when the account has none.
 */
export function useHomeWebsite(): string | null {
  const [remembered, setRemembered] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setRemembered(rememberedWebsite());
    setChecked(true);
  }, []);
  const { data } = useQuery({
    queryKey: ['agency', 'home-website'],
    queryFn: async () => (await getWebsites())[0]?.id ?? null,
    enabled: checked && !remembered,
    staleTime: 5 * 60_000,
  });
  return remembered ?? data ?? null;
}

export const dashboardHref = (websiteId: string | null) => (websiteId ? `/websites/${websiteId}` : '/websites');
