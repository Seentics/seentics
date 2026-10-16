/** Write hooks for Conversions; each one refreshes the whole feature (cards, summary, events). */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversionsApi } from './api';
import { conversionKeys } from './queries';
import type { DestinationInput, DestinationPatch } from './types';

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: conversionKeys.all });
}

export function useConnectDestination(websiteId: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: DestinationInput) => conversionsApi.connect(websiteId, input), onSuccess: invalidate });
}

export function useUpdateDestination(websiteId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DestinationPatch }) => conversionsApi.update(websiteId, id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteDestination(websiteId: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => conversionsApi.remove(websiteId, id), onSuccess: invalidate });
}

export function useTestDestination(websiteId: string) {
  return useMutation({
    mutationFn: ({ id, testEventCode }: { id: string; testEventCode?: string }) => conversionsApi.test(websiteId, id, testEventCode),
  });
}

export function useRetryConversion(websiteId: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (eventId: string) => conversionsApi.retry(websiteId, eventId), onSuccess: invalidate });
}
