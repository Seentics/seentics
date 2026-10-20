import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { isDemo, demoMutationGuard, demoAutomations } from '@/lib/demo';

import { bulkDeleteAutomations, createAutomation, deleteAutomation, toggleAutomation, updateAutomation } from './api';
import type {
  Automation,
  CreateAutomationRequest,
} from './types';

/**
 * Write the server's copy of one automation into its detail cache.
 *
 * Invalidating only the list left `['automation', …]` holding the pre-save row for its
 * five-minute stale time, so the detail page showed the old version and the builder,
 * seeded from it, could save that old version back over the edit.
 */
function syncDetail(queryClient: QueryClient, websiteId: string, automationId: string, updated: Automation) {
    queryClient.setQueryData(['automation', websiteId, automationId], updated);
    queryClient.invalidateQueries({ queryKey: ['automation', websiteId, automationId] });
}


export function useCreateAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, data }: { websiteId: string; data: CreateAutomationRequest }) =>
            createAutomation(websiteId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useUpdateAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId, data }: { websiteId: string; automationId: string; data: Partial<CreateAutomationRequest> }) =>
            updateAutomation(websiteId, automationId, data),
        onSuccess: (updated, variables) => {
            syncDetail(queryClient, variables.websiteId, variables.automationId, updated);
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useDeleteAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            deleteAutomation(websiteId, automationId),
        onSuccess: (_, variables) => {
            queryClient.removeQueries({ queryKey: ['automation', variables.websiteId, variables.automationId] });
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useBulkDeleteAutomations() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationIds }: { websiteId: string; automationIds: string[] }) =>
            bulkDeleteAutomations(websiteId, automationIds),
        onSuccess: (_, variables) => {
            for (const id of variables.automationIds) {
                queryClient.removeQueries({ queryKey: ['automation', variables.websiteId, id] });
            }
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useToggleAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            toggleAutomation(websiteId, automationId),
        onSuccess: (updated, variables) => {
            syncDetail(queryClient, variables.websiteId, variables.automationId, updated);
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}
