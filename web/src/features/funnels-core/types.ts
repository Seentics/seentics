/** Domain types for the funnels-core feature. */

export interface FunnelStep {
    id?: string;
    funnelId?: string;
    name: string;
    order: number;
    stepType: 'page_view' | 'event';
    pagePath?: string;
    eventType?: string;
    matchType?: 'exact' | 'contains' | 'starts_with' | 'regex';
}

export interface StepStats {
    stepOrder: number;
    stepName: string;
    count: number;
    dropoffCount: number;
    dropoffRate: number;
    conversionRate: number;
}

export interface FunnelStats {
    totalEntries: number;
    completions: number;
    conversionRate: number;
    stepBreakdown: StepStats[];
}

export interface Funnel {
    id: string;
    websiteId: string;
    userId: string;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    steps?: FunnelStep[];
    stats?: FunnelStats;
}

export interface CreateFunnelRequest {
    name: string;
    description?: string;
    steps: Omit<FunnelStep, 'id' | 'funnelId'>[];
}

export interface UpdateFunnelRequest {
    name?: string;
    description?: string;
    isActive?: boolean;
    steps?: Omit<FunnelStep, 'id' | 'funnelId'>[];
}

export interface ListFunnelsResponse {
    funnels: Funnel[];
    total: number;
    limit?: number;
    offset?: number;
}
