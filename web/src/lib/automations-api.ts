import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import { isDemo, demoMutationGuard, demoAutomations } from './demo';
import { isValidId } from './utils';

// Types
export interface AutomationAction {
    id?: string;
    automationId?: string;
    actionType: 'webhook' | 'email' | 'script' | 'banner' | 'modal' | 'notification' | 'redirect' | 'hide_element';
    actionConfig: Record<string, any>;
    orderIndex?: number;
}

export interface AutomationCondition {
    id?: string;
    automationId?: string;
    conditionType: string;
    conditionConfig: Record<string, any>;
}

export interface AutomationStats {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    last30Days: number;
}

export interface Automation {
    id: string;
    websiteId: string;
    userId: string;
    name: string;
    description: string;
    triggerType: string;
    triggerConfig: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    actions: AutomationAction[];
    conditions?: AutomationCondition[];
    stats?: AutomationStats;
    /** Full raw definition as stored in the DB — use this for editing */
    definition?: Record<string, unknown>;
}

export interface CreateAutomationRequest {
    name: string;
    description?: string;
    // New format: pass the full definition directly from AutomationBuilder
    definition?: Record<string, unknown>;
    // Legacy format fields (kept for backwards compat)
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    actions?: AutomationAction[];
    conditions?: AutomationCondition[];
}

export interface AutomationsResponse {
    automations: Automation[];
    total: number;
    limit: number;
    offset: number;
}

// Normalize a raw backend automation row (definition JSONB) into the frontend Automation shape
function normalizeAutomationFromApi(raw: Record<string, unknown>): Automation {
    const definition = (raw.definition ?? {}) as Record<string, unknown>;
    const trigger = (definition.trigger ?? {}) as Record<string, unknown>;
    const rawActions = Array.isArray(definition.actions) ? definition.actions as Record<string, unknown>[] : [];
    const rawConditions = Array.isArray(trigger.conditions) ? trigger.conditions as Record<string, unknown>[] : [];
    const id = String(raw.id ?? '');
    return {
        id,
        websiteId: String(raw.website_id ?? raw.websiteId ?? ''),
        userId: String(raw.user_id ?? raw.userId ?? ''),
        name: String(raw.name ?? ''),
        description: String(raw.description ?? ''),
        triggerType: String(trigger.type ?? trigger.event ?? trigger.triggerType ?? ''),
        triggerConfig: {
            pageUrlMatch: trigger.pageUrlMatch,
            rateLimitSec: trigger.rateLimitSec,
            ...(rawConditions.length ? { conditions: rawConditions } : {}),
        } as Record<string, any>,
        isActive: Boolean(raw.is_active ?? raw.isActive),
        definition: definition as Record<string, unknown>,
        createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
        updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ''),
        actions: rawActions.map((a, i) => ({
            id: String(a.id ?? `action-${i}`),
            automationId: id,
            actionType: String(a.actionType ?? a.type ?? 'webhook') as AutomationAction['actionType'],
            actionConfig: a.configPayload
                ? { payload: a.configPayload }
                : ((a.config ?? {}) as Record<string, any>),
            orderIndex: i,
        })),
        conditions: rawConditions.map((c, i) => ({
            id: String(c.id ?? `cond-${i}`),
            automationId: id,
            conditionType: String(c.op ?? c.conditionType ?? 'eq'),
            conditionConfig: c as Record<string, any>,
        })),
    };
}

// Serialize a CreateAutomationRequest into the backend's definition JSONB shape
function serializeAutomationDefinition(data: CreateAutomationRequest): Record<string, unknown> {
    return {
        trigger: {
            event: data.triggerType,
            ...data.triggerConfig,
            ...(data.conditions?.length ? { conditions: data.conditions.map(c => c.conditionConfig) } : {}),
        },
        actions: (data.actions ?? []).map((a, i) => ({
            id: a.id ?? `action-${i}`,
            type: a.actionType,
            actionType: a.actionType,
            label: a.actionType,
            configPayload: a.actionConfig?.payload ?? '',
            config: a.actionConfig,
            orderIndex: a.orderIndex ?? i,
        })),
    };
}

// API Functions
async function fetchAutomations(websiteId: string, limit: number = 10, offset: number = 0): Promise<AutomationsResponse> {
    if (isDemo(websiteId)) {
        return demoAutomations() as any;
    }
    const response = await api.get(`/automations/${websiteId}`, {
        params: { limit, offset }
    });
    const payload = response.data;
    const raw: Record<string, unknown>[] =
        Array.isArray(payload?.data) ? payload.data :
        Array.isArray(payload) ? payload : [];
    const automationsList = raw.map(normalizeAutomationFromApi);
    return { automations: automationsList, total: automationsList.length, limit, offset };
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

async function createAutomation(websiteId: string, data: CreateAutomationRequest): Promise<Automation> {
    if (demoMutationGuard(websiteId)) {
        return { id: 'demo-new', websiteId, userId: 'demo', name: data.name, description: '', triggerType: '', triggerConfig: {}, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), actions: [] } as Automation;
    }
    const definition = data.definition ?? serializeAutomationDefinition(data as Required<CreateAutomationRequest>);
    const response = await api.post(`/automations/${websiteId}`, {
        name: data.name,
        description: data.description ?? '',
        definition,
        is_active: true,
    });
    const payload = response.data as Record<string, unknown>;
    const raw = (payload?.data as Record<string, unknown>) ?? payload;
    return normalizeAutomationFromApi(raw);
}

async function updateAutomation(websiteId: string, automationId: string, data: Partial<CreateAutomationRequest>): Promise<Automation> {
    if (demoMutationGuard(websiteId)) {
        return { id: automationId, websiteId, userId: 'demo', name: data.name ?? '', description: '', triggerType: '', triggerConfig: {}, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), actions: [] } as Automation;
    }
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.description !== undefined) body.description = data.description;
    if (data.definition !== undefined) {
        body.definition = data.definition;
    } else if (data.triggerType !== undefined || data.actions !== undefined) {
        body.definition = serializeAutomationDefinition({ ...data, actions: data.actions ?? [] } as Required<CreateAutomationRequest>);
    }
    const response = await api.put(`/automations/${websiteId}/${automationId}`, body);
    const payload = response.data as Record<string, unknown>;
    const raw = (payload?.data as Record<string, unknown>) ?? payload;
    return normalizeAutomationFromApi(raw);
}

async function deleteAutomation(websiteId: string, automationId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/automations/${websiteId}/${automationId}`);
}

async function bulkDeleteAutomations(websiteId: string, automationIds: string[]): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/automations/${websiteId}/bulk-delete`, {
        data: { ids: automationIds },
    });
}

async function toggleAutomation(websiteId: string, automationId: string): Promise<Automation> {
    if (demoMutationGuard(websiteId)) {
        const demo = demoAutomations().automations.find(a => a.id === automationId);
        return { ...demo, isActive: !demo?.isActive } as any;
    }
    const response = await api.post(`/automations/${websiteId}/${automationId}/toggle`);
    const payload = response.data as Record<string, unknown>;
    const raw = (payload?.data as Record<string, unknown>) ?? payload;
    return normalizeAutomationFromApi(raw);
}

async function getAutomationStats(websiteId: string, automationId: string): Promise<AutomationStats> {
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

// React Query Hooks
export function useAutomations(websiteId: string, limit: number = 10, offset: number = 0) {
    return useQuery({
        queryKey: ['automations', websiteId, limit, offset],
        queryFn: () => fetchAutomations(websiteId, limit, offset),
        enabled: isValidId(websiteId),
    });
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

export function useAutomationStats(websiteId: string, automationId: string) {
    return useQuery({
        queryKey: ['automation-stats', websiteId, automationId],
        queryFn: () => getAutomationStats(websiteId, automationId),
        enabled: isValidId(websiteId) && !!automationId,
    });
}
