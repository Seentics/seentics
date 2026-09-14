/** Domain types for the automations feature. */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { isDemo, demoMutationGuard, demoAutomations } from '@/lib/demo';


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
    /** The full definition, exactly as `AutomationBuilder` produces it. */
    definition: Record<string, unknown>;
}

export interface AutomationsResponse {
    automations: Automation[];
    total: number;
    limit: number;
    offset: number;
}
