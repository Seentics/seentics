import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demoMeter } from '@/lib/demo';
import { fetchMeter, saveSpendCap } from './api';
import type { MeterState } from './types';

export const billingKeys = { meter: ['billing', 'meter'] as const };

/** The current period's metered usage; the demo site shows a fixture. */
export function useMeter(options: { demo: boolean; enabled: boolean }) {
  return useQuery({
    queryKey: [...billingKeys.meter, options.demo],
    queryFn: async (): Promise<MeterState | null> => (options.demo ? demoMeter() : fetchMeter()),
    enabled: options.enabled,
    // Measured on request; a minute is fresh enough for a bill that is reported hourly.
    staleTime: 60_000,
  });
}

export function useSaveSpendCap() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveSpendCap,
    onSuccess: (state) => client.setQueryData([...billingKeys.meter, false], state),
  });
}
