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

/** Authenticated identity attached to a raw-API request. */
export type VerifiedApiKeyContext = {
  websiteId: string;
  apiKeyId: string;
  scopes: ApiScope[];
};

/** Verification capability used by the machine-facing HTTP adapter. */
export interface ApiKeyVerifier {
  verify(rawKey: string | undefined, websiteId: string): Promise<VerifiedApiKeyContext | null>;
}

/**
 * What an account key may do in the management API. `read` lists and fetches clients
 * and websites; `write` creates, changes and deletes them and mints website keys.
 */
export const ACCOUNT_SCOPES = ['websites:read', 'websites:write'] as const;

export type AccountScope = (typeof ACCOUNT_SCOPES)[number];

export const ACCOUNT_SCOPE_DESCRIPTIONS: Record<AccountScope, string> = {
  'websites:read': 'List and fetch clients, websites and tracking snippets',
  'websites:write': 'Create, update and delete clients and websites; mint website API keys',
};

/** The account a management-API request acts for. */
export type VerifiedAccountKey = {
  userId: string;
  apiKeyId: string;
  scopes: AccountScope[];
};

export interface AccountKeyVerifier {
  /** `null` for anything that is not a live account key — wrong shape, unknown, revoked. */
  verify(rawKey: string | undefined): Promise<VerifiedAccountKey | null>;
}

export type IssuedEmbedToken = { token: string; expiresAt: Date };

/**
 * Short-lived, read-only tokens for an iframed dashboard of one website. Issuing does not
 * check access: the caller has already proven it may share the website.
 */
export interface EmbedTokenIssuer {
  issue(websiteId: string, ttlSeconds?: number): Promise<IssuedEmbedToken>;
  /** `null` for anything that is not a live embed token. */
  verify(token: string | undefined): Promise<{ websiteId: string } | null>;
}

/** Minting website keys from the management API, where the caller has already proven ownership. */
export interface WebsiteKeyIssuer {
  create(websiteId: string, userId: string, name: string, scopes: ApiScope[]): Promise<Record<string, unknown>>;
}
