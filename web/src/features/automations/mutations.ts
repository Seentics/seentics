import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isDemo, demoMutationGuard, demoAutomations } from '@/lib/demo';

import { bulkDeleteAutomations, createAutomation, deleteAutomation, toggleAutomation, updateAutomation } from './api';
import type {
  CreateAutomationRequest,
} from './types';


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
        onSuccess: (_, variables) => {
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
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useToggleAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            toggleAutomation(websiteId, automationId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}
