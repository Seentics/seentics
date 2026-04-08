import { createContext, useContext } from 'react';
import { SeenticsClient } from './lib/client';

export interface SeenticsContextValue {
  client:  SeenticsClient;
  baseUrl: string;
}

export const SeenticsContext = createContext<SeenticsContextValue | null>(null);

export function useSeentics(): SeenticsContextValue {
  const ctx = useContext(SeenticsContext);
  if (!ctx) throw new Error('[SeenticsComponents] useSeentics must be used inside <SeenticsProvider>');
  return ctx;
}
