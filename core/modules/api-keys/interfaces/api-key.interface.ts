import type { EmbedSection } from './embed-sections';

/**
 * What an account key may do. `websites:*` governs the management API (`read` lists and
 * fetches clients and websites; `write` creates, changes and deletes them and manages embed
 * links). The other three govern the public data API for the account's own websites, one
 * per kind of data it exposes — the granularity people reason about, not one per endpoint.
 */
export const ACCOUNT_SCOPES = ['websites:read', 'websites:write', 'analytics:read', 'replays:read', 'heatmaps:read'] as const;

export type AccountScope = (typeof ACCOUNT_SCOPES)[number];

export const ACCOUNT_SCOPE_DESCRIPTIONS: Record<AccountScope, string> = {
  'websites:read': 'List and fetch clients, websites and tracking snippets',
  'websites:write': 'Create, update and delete clients and websites; manage embed links',
  'analytics:read': 'Read traffic, pages, sources, events, goals and exports of your websites',
  'replays:read': 'Read session replay listings and metadata of your websites',
  'heatmaps:read': 'Read heatmap pages and interaction points of your websites',
};

/** The scopes the public data API checks (`requireScope`); the rest are management-API only. */
export const API_SCOPES = ['analytics:read', 'replays:read', 'heatmaps:read'] as const satisfies readonly AccountScope[];

export type ApiScope = (typeof API_SCOPES)[number];

/** Authenticated identity attached to a raw-API request. */
export type VerifiedApiKeyContext = {
  websiteId: string;
  /** The account key's id. */
  apiKeyId: string;
  /** The account key's data scopes. Empty means no access to the data API, never unrestricted. */
  scopes: ApiScope[];
};

/** Verification capability used by the machine-facing HTTP adapter. */
export interface ApiKeyVerifier {
  /** `null` unless `rawKey` is a live account key whose owner owns `websiteId`. */
  verify(rawKey: string | undefined, websiteId: string): Promise<VerifiedApiKeyContext | null>;
}

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

/** What an embed link shows: one website, or every website of one client. */
export type EmbedTarget = { websiteId: string; clientId?: undefined } | { clientId: string; websiteId?: undefined };

export type EmbedLinkRecord = {
  id: string;
  ownerId: string;
  scope: "website" | "client";
  /** The website's or the client's id, by `scope`. */
  targetId: string;
  /** What the link exposes; read from the row on every verification. */
  sections: EmbedSection[];
  createdAt: Date;
};

/** A link's JSON shape, shared by the dashboard and the management API. */
export type EmbedLinkView = {
  id: string;
  scope: "website" | "client";
  target_id: string;
  target_name: string;
  token: string;
  embed_url: string;
  sections: EmbedSection[];
  created_at: string;
};

/** What a presented embed token stands for, once its link is confirmed live. */
export type EmbedClaim = EmbedLinkRecord;

/**
 * Permanent, revocable embed links. The token is signed from the link's id and never
 * stored, so `tokenFor` re-derives the same string every time. Creating does not check
 * access: the caller has already proven it may share the target.
 */
export interface EmbedLinks {
  /** The target's live link, made if there is none. `created` is false for an existing one. */
  getOrCreate(ownerId: string, target: EmbedTarget, sections?: EmbedSection[]): Promise<{ link: EmbedLinkRecord; created: boolean }>;
  findById(linkId: string): Promise<EmbedLinkRecord | null>;
  findLive(target: EmbedTarget): Promise<EmbedLinkRecord | null>;
  /** The owner's live links, newest first. */
  listLive(ownerId: string): Promise<EmbedLinkRecord[]>;
  /** Replace a live link's sections (effective at once); `null` when unknown or revoked. */
  setSections(linkId: string, sections: EmbedSection[]): Promise<EmbedLinkRecord | null>;
  /** `false` when the link is unknown or already revoked. */
  revoke(linkId: string): Promise<boolean>;
  tokenFor(link: EmbedLinkRecord): Promise<string>;
  /** The link as the dashboard and the management API return it. */
  present(link: EmbedLinkRecord, targetName: string): Promise<EmbedLinkView>;
  /** `null` for anything but a signed token of a live link: forged, revoked and unknown alike. */
  verify(token: string | undefined): Promise<EmbedClaim | null>;
}
