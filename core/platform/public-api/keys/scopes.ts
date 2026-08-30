/**
 * What an API key may do.
 *
 * Its own module because four things need this vocabulary — the catalogue, the create
 * schema, the scope-checking middleware, and the service that mints keys — and only the
 * last of those touches the database. Leaving it beside the service meant importing a
 * database connection to find out what a scope is called.
 *
 * Coarse on purpose. A scope per endpoint would be unusable in a form and would need
 * revisiting every time an endpoint is added; these three map onto the three kinds of
 * data the public API exposes, which is the granularity people reason about.
 */

export const API_SCOPES = ['analytics:read', 'replays:read', 'heatmaps:read'] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  'analytics:read': 'Traffic, pages, sources, events, goals and exports',
  'replays:read': 'Session replay listings and metadata',
  'heatmaps:read': 'Heatmap pages and interaction points',
};
