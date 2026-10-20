/** A stored automation row, flattened for the list and detail views. */

import type { Automation, AutomationAction, AutomationStats } from './types';

/**
 * The graph's nodes in the order a run meets them: breadth-first from `entry` along the
 * edges, then anything unreachable in stored order (a graph mid-edit can have strays).
 * Stored order is the order nodes were added, which is not the order they run in once a
 * node has been inserted between two others.
 */
function nodesInRunOrder(graph: Record<string, unknown>): Record<string, unknown>[] {
    const nodes = Array.isArray(graph.nodes) ? (graph.nodes as Record<string, unknown>[]) : [];
    const edges = Array.isArray(graph.edges) ? (graph.edges as Record<string, unknown>[]) : [];
    const byId = new Map(nodes.map(n => [String(n.id), n]));
    const seen = new Set<string>();
    const ordered: Record<string, unknown>[] = [];
    const queue = typeof graph.entry === 'string' ? [graph.entry] : [];
    while (queue.length) {
        const id = queue.shift()!;
        const node = byId.get(id);
        if (!node || seen.has(id)) continue;
        seen.add(id);
        ordered.push(node);
        for (const e of edges) if (e.from === id) queue.push(String(e.to));
    }
    for (const n of nodes) if (!seen.has(String(n.id))) ordered.push(n);
    return ordered;
}

/**
 * Flatten a backend row into the shape the list and detail views render.
 *
 * The definition is carried through untouched — it is what the builder edits — and the
 * flattened `triggerType`/`actions` alongside it are a read-only projection for the
 * summary rows, derived from `definition.graph` rather than stored separately. (It used to
 * read a `definition.steps` chain that core no longer stores, so every automation showed
 * no actions.)
 */
export function normalizeAutomationFromApi(raw: Record<string, unknown>): Automation {
    const definition = (raw.definition ?? {}) as Record<string, unknown>;
    const triggers = Array.isArray(definition.triggers)
        ? (definition.triggers as Record<string, unknown>[])
        : [];
    const nodes = nodesInRunOrder((definition.graph ?? {}) as Record<string, unknown>);
    const actionSteps = nodes.filter(n => n.kind === 'action');
    const conditionSteps = nodes.filter(n => n.kind === 'if');
    const id = String(raw.id ?? '');
    return {
        id,
        websiteId: String(raw.website_id ?? raw.websiteId ?? ''),
        userId: String(raw.user_id ?? raw.userId ?? ''),
        name: String(raw.name ?? ''),
        description: String(raw.description ?? ''),
        // The first trigger stands in for the row's badge; the rest are visible in the
        // builder. An automation with none is mid-edit rather than broken.
        triggerType: String(triggers[0]?.type ?? ''),
        triggerConfig: (triggers[0] ?? {}) as Record<string, any>,
        isActive: Boolean(raw.is_active ?? raw.isActive),
        definition: definition as Record<string, unknown>,
        createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
        updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ''),
        actions: actionSteps.map((s, i) => {
            const action = (s.action ?? {}) as Record<string, unknown>;
            const { type, ...config } = action;
            return {
                id: String(s.id ?? `action-${i}`),
                automationId: id,
                actionType: String(type ?? 'webhook') as AutomationAction['actionType'],
                actionConfig: config as Record<string, any>,
                orderIndex: i,
            };
        }),
        conditions: conditionSteps.map((s, i) => ({
            id: String(s.id ?? `cond-${i}`),
            automationId: id,
            conditionType: String(((s.group ?? {}) as Record<string, unknown>).operator ?? 'AND'),
            conditionConfig: (s.group ?? {}) as Record<string, any>,
        })),
        stats: raw.stats ? {
            totalExecutions: Number((raw.stats as AutomationStats).totalExecutions ?? 0),
            successCount:    Number((raw.stats as AutomationStats).successCount    ?? 0),
            failureCount:    Number((raw.stats as AutomationStats).failureCount    ?? 0),
            successRate:     Number((raw.stats as AutomationStats).successRate     ?? 0),
            last30Days:      Number((raw.stats as AutomationStats).last30Days      ?? 0),
        } : undefined,
    };
}
