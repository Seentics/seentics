import React, { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SeenticsContext } from '../context';
import { createClient } from '../lib/client';
import { injectStyles } from '../lib/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
});

export interface SeenticsProviderProps {
  /** Agency API key — Bearer token for the /raw/* endpoints */
  apiKey:   string;
  /** Your Seentics gateway URL. Defaults to https://api.seentics.com */
  baseUrl?: string;
  children: React.ReactNode;
}

export function SeenticsProvider({
  apiKey,
  baseUrl = 'https://api.seentics.com',
  children,
}: SeenticsProviderProps) {
  injectStyles();

  const client = useMemo(
    () => createClient({ apiKey, baseUrl }),
    [apiKey, baseUrl],
  );

  return (
    <SeenticsContext.Provider value={{ client, baseUrl }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SeenticsContext.Provider>
  );
}
