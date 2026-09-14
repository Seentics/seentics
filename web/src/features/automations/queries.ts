import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { isDemo, demoMutationGuard, demoAutomations } from '@/lib/demo';
import { isValidId } from '@/lib/utils';
import { fetchAutomation, fetchAutomations } from './api';
import { getAutomationStats, getAutomationDailyStats } from './api';

// React Query Hooks
export function useAutomations(websiteId: string, limit: number = 10, offset: number = 0) {
    return useQuery({
        queryKey: ['automations', websiteId, limit, offset],
        queryFn: () => fetchAutomations(websiteId, limit, offset),
        enabled: isValidId(websiteId),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useFetchAutomation(websiteId: string, automationId: string) {
    return useQuery({
        queryKey: ['automation', websiteId, automationId],
        queryFn: () => fetchAutomation(websiteId, automationId),
        enabled: isValidId(websiteId) && !!automationId,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useAutomationStats(websiteId: string, automationId: string) {
    return useQuery({
        queryKey: ['automation-stats', websiteId, automationId],
        queryFn: () => getAutomationStats(websiteId, automationId),
        enabled: isValidId(websiteId) && !!automationId,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAutomationDailyStats(websiteId: string, automationId: string) {
    return useQuery({
        queryKey: ['automation-daily-stats', websiteId, automationId],
        queryFn: () => getAutomationDailyStats(websiteId, automationId),
        enabled: isValidId(websiteId) && !!automationId,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}
