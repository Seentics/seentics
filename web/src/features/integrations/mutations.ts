/** Write hooks for the integrations feature, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionKeys } from '@/features/leads/queries';
import { integrationsApi } from './api';
import { integrationKeys } from './queries';
import type { CreateInput, UpdateInput } from './types';

/** Any change can alter both the cards and the log behind them. */
function useRefresh(websiteId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: integrationKeys.overview(websiteId) });
    void qc.invalidateQueries({ queryKey: integrationKeys.deliveries(websiteId) });
  };
}

export function useCreateDestination(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (input: CreateInput) => integrationsApi.create(websiteId, input),
    onSuccess: refresh,
  });
}

export function useUpdateDestination(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (vars: { connectionId: string; input: UpdateInput }) => integrationsApi.update(websiteId, vars.connectionId, vars.input),
    onSuccess: refresh,
  });
}

export function useRemoveDestination(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (connectionId: string) => integrationsApi.remove(websiteId, connectionId),
    onSuccess: refresh,
  });
}

export function useTestDestination(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (connectionId: string) => integrationsApi.sendTest(websiteId, connectionId),
    // A failing connection may change state, so refresh whatever the outcome.
    onSettled: refresh,
  });
}

export function useRetryDelivery(websiteId: string) {
  const qc = useQueryClient();
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (deliveryId: string) => integrationsApi.retryDelivery(websiteId, deliveryId),
    onSuccess: () => {
      refresh();
      // A form's submissions list shows the same deliveries, so it must pick up the retry too.
      void qc.invalidateQueries({ queryKey: submissionKeys.all });
    },
  });
}
