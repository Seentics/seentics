/** Write hooks for the integrations feature, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from './api';
import { integrationKeys } from './queries';
import type { ConnectInput, UpdateInput } from './types';

/** Any change can alter both the cards and the log behind them. */
function useRefresh(websiteId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: integrationKeys.list(websiteId) });
    void qc.invalidateQueries({ queryKey: integrationKeys.deliveries(websiteId) });
  };
}

export function useConnectIntegration(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (vars: { provider: string; input: ConnectInput }) => integrationsApi.connect(websiteId, vars.provider, vars.input),
    onSuccess: refresh,
  });
}

export function useUpdateIntegration(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (vars: { provider: string; input: UpdateInput }) => integrationsApi.update(websiteId, vars.provider, vars.input),
    onSuccess: refresh,
  });
}

export function useDisconnectIntegration(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (provider: string) => integrationsApi.disconnect(websiteId, provider),
    onSuccess: refresh,
  });
}

export function useTestIntegration(websiteId: string) {
  const refresh = useRefresh(websiteId);
  return useMutation({
    mutationFn: (provider: string) => integrationsApi.sendTest(websiteId, provider),
    // The send is recorded by the server only for real leads; a test shows in the card, not the log,
    // but a failing connection may change state, so refresh anyway.
    onSettled: refresh,
  });
}
