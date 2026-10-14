/** Read and write hooks for anomaly alerts. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiKeys } from '../queries';
import { alertsApi } from './api';
import type { AlertSettings } from './types';

export const alertKeys = {
  list: (websiteId: string) => [...aiKeys.all, 'alerts', websiteId] as const,
  settings: (websiteId: string) => [...aiKeys.all, 'alert-settings', websiteId] as const,
};

// 'demo' included: alertsApi answers it from fixtures.
const real = (websiteId: string) => !!websiteId;

export function useAlerts(websiteId: string, enabled = true) {
  return useQuery({
    queryKey: alertKeys.list(websiteId),
    queryFn: () => alertsApi.list(websiteId),
    enabled: enabled && real(websiteId),
    // Detection runs hourly; five minutes is plenty to see a new one soon after.
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAlertSettings(websiteId: string) {
  return useQuery({
    queryKey: alertKeys.settings(websiteId),
    queryFn: () => alertsApi.settings(websiteId),
    enabled: real(websiteId),
    retry: 1,
  });
}

export function useUpdateAlertSettings(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AlertSettings>) => alertsApi.updateSettings(websiteId, patch),
    onSuccess: (data) => {
      qc.setQueryData(alertKeys.settings(websiteId), data);
      void qc.invalidateQueries({ queryKey: alertKeys.list(websiteId) });
    },
  });
}
