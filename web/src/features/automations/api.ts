import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { isDemo, demoMutationGuard, demoAutomations } from '@/lib/demo';

import { normalizeAutomationFromApi } from './normalize';
import type {
  Automation,
  AutomationStats,
  AutomationsResponse,
  CreateAutomationRequest,
} from './types';








// API Functions
//
// Exported alongside the hooks that wrap them: these are the data layer, and testing a
// plain async function is simpler than standing up a query client to reach the same
// code. `fetchAutomation` was already exported for the same reason.
//
// The list endpoint returns every automation for the site in one page (the landing page filters
// and searches them client-side), so nothing is sent to page it: `limit`/`offset` used to be
// sent and ignored.
export async function fetchAutomations(websiteId: string): Promise<AutomationsResponse> {
    if (isDemo(websiteId)) {
        return demoAutomations();
    }
    const response = await api.get(`/automations/${websiteId}`);
    const payload = response.data;
    const raw: Record<string, unknown>[] =
        Array.isArray(payload?.data) ? payload.data :
        Array.isArray(payload) ? payload : [];
    const automationsList = raw.map(normalizeAutomationFromApi);
    return { automations: automationsList, total: automationsList.length, limit: automationsList.length, offset: 0 };
}

export async function fetchAutomation(websiteId: string, automationId: string): Promise<Automation | null> {
    if (isDemo(websiteId)) {
        return demoAutomations().automations.find(a => a.id === automationId) || null;
    }
    try {
        const response = await api.get(`/automations/${websiteId}/${automationId}`);
        const payload = response.data as Record<string, unknown>;
        const raw = (payload?.data as Record<string, unknown>) ?? payload;
        return normalizeAutomationFromApi(raw);
    } catch {
        return null;
    }
}

export async function createAutomation(websiteId: string, data: CreateAutomationRequest): Promise<Automation> {
    if (demoMutationGuard(websiteId)) {
        return { id: 'demo-new', websiteId, userId: 'demo', name: data.name, description: '', triggerType: '', triggerConfig: {}, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), actions: [] } as Automation;
    }
    const response = await api.post(`/automations/${websiteId}`, {
        name: data.name,
        description: data.description ?? '',
        definition: data.definition,
        is_active: true,
    });
    const payload = response.data as Record<string, unknown>;
    const raw = (payload?.data as Record<string, unknown>) ?? payload;
    return normalizeAutomationFromApi(raw);
}

export async function updateAutomation(websiteId: string, automationId: string, data: Partial<CreateAutomationRequest>): Promise<Automation> {
    if (demoMutationGuard(websiteId)) {
        return { id: automationId, websiteId, userId: 'demo', name: data.name ?? '', description: '', triggerType: '', triggerConfig: {}, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), actions: [] } as Automation;
    }
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.description !== undefined) body.description = data.description;
    if (data.definition !== undefined) body.definition = data.definition;
    const response = await api.put(`/automations/${websiteId}/${automationId}`, body);
    const payload = response.data as Record<string, unknown>;
    const raw = (payload?.data as Record<string, unknown>) ?? payload;
    return normalizeAutomationFromApi(raw);
}

export async function deleteAutomation(websiteId: string, automationId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/automations/${websiteId}/${automationId}`);
}

export async function bulkDeleteAutomations(websiteId: string, automationIds: string[]): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/automations/${websiteId}/bulk-delete`, {
        data: { ids: automationIds },
    });
}

export async function toggleAutomation(websiteId: string, automationId: string): Promise<Automation> {
    if (demoMutationGuard(websiteId)) {
        const demo = demoAutomations().automations.find(a => a.id === automationId);
        return { ...demo, isActive: !demo?.isActive } as any;
    }
    const response = await api.post(`/automations/${websiteId}/${automationId}/toggle`);
    const payload = response.data as Record<string, unknown>;
    const raw = (payload?.data as Record<string, unknown>) ?? payload;
    return normalizeAutomationFromApi(raw);
}

export async function getAutomationStats(websiteId: string, automationId: string): Promise<AutomationStats> {
    if (isDemo(websiteId)) {
        const demo = demoAutomations().automations.find(a => a.id === automationId);
        return demo?.stats || { totalExecutions: 0, successCount: 0, failureCount: 0, successRate: 0, last30Days: 0 };
    }
    const response = await api.get(`/automations/${websiteId}/${automationId}/stats`);
    const payload = response.data as Record<string, unknown>;
    const d = (payload?.data as Record<string, unknown>) ?? payload;
    return {
        totalExecutions: Number(d.totalExecutions ?? 0),
        successCount:    Number(d.successCount    ?? 0),
        failureCount:    Number(d.failureCount     ?? 0),
        successRate:     Number(d.successRate      ?? 0),
        last30Days:      Number(d.last30Days        ?? 0),
    };
}









export async function getAutomationDailyStats(websiteId: string, automationId: string): Promise<{ day: string; runs: number }[]> {
    if (isDemo(websiteId)) {
        const demo = demoAutomations().automations.find(a => a.id === automationId);
        const total = demo?.stats?.totalExecutions ?? 0;
        return Array.from({ length: 14 }, (_, i) => ({
            day: `D${i + 1}`,
            runs: Math.max(0, Math.floor((total / 14) * (0.6 + Math.random() * 0.8))),
        }));
    }
    const response = await api.get(`/automations/${websiteId}/${automationId}/stats/daily`);
    const payload = response.data as Record<string, unknown>;
    const rows = Array.isArray(payload?.data) ? payload.data as { day: string; runs: number }[] : [];
    return rows;
}
