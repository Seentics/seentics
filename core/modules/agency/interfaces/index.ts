/**
 * Public contracts for the agency module: an agency's white label, and its clients'
 * read-only portal.
 *
 * Its own module because it owns its own data (`agency_white_label`, `agency_client_users`,
 * `agency_portal_tokens`) and vocabulary. Clients themselves stay in the websites module —
 * a client is a way of grouping websites — and reach this module only through
 * `ClientDirectory`.
 *
 * A portal link reads exactly what a client-scope embed link reads, through the same embed
 * API (`app/http/embed/routes.ts`): `PortalAccess.verify` turns a portal token into the
 * same kind of claim, so there is one read path and one scoping rule, not two.
 */

import type { AuthedRouter, PublicRouter } from "../../../platform/http/router";
import type { EmbedSection } from "../../api-keys/interfaces";

// ─── White label ─────────────────────────────────────────────────────────────

export const DEFAULT_PRIMARY_COLOR = "#6366f1";

export type WhiteLabelSettings = {
  ownerId: string;
  brandName: string;
  /** `""` or an https URL. */
  logoUrl: string;
  /** `#rrggbb`, lower case. */
  primaryColor: string;
  supportEmail: string;
  footerText: string;
  hideSeentics: boolean;
  /** `null` while the owner has never saved settings (the defaults are showing). */
  updatedAt: Date | null;
};

/** Absent leaves a field alone. Text fields clear with `""`. */
export type WhiteLabelPatch = Partial<Omit<WhiteLabelSettings, "ownerId" | "updatedAt">>;

/** Persistence for white-label settings: one row per owner. */
export interface WhiteLabelRepository {
  find(ownerId: string): Promise<WhiteLabelSettings | null>;
  /** Insert or replace the owner's whole row. */
  upsert(settings: WhiteLabelSettings): Promise<WhiteLabelSettings>;
}

/** The brand as a client sees it — what the portal and embed responses carry. */
export type BrandView = {
  brand_name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  footer_text: string;
  hide_seentics: boolean;
};

/**
 * The read the embed API needs: an owner's brand, defaults when unset. Its own interface
 * because the embed API must not be able to change anyone's settings.
 */
export interface AgencyBranding {
  brandFor(ownerId: string): Promise<BrandView>;
}

export interface WhiteLabel extends AgencyBranding {
  /** The owner's settings, or the defaults when never saved. */
  get(ownerId: string): Promise<WhiteLabelSettings>;
  update(ownerId: string, patch: WhiteLabelPatch): Promise<WhiteLabelSettings>;
}

// ─── Client users and portal links ───────────────────────────────────────────

/**
 * Portal tokens carry this prefix, so the embed API can tell one from an embed link's
 * signed token (a JWT, which never starts with it) without trying both.
 */
export const PORTAL_TOKEN_PREFIX = "scp_";

/** The dashboard's anonymous "Generate link": its screen promises seven days. */
export const PORTAL_LINK_TTL_DAYS = 7;
/** A client user's link; "resend" issues a fresh one. */
export const CLIENT_USER_LINK_TTL_DAYS = 30;

export const CLIENT_USER_STATUSES = ["invited", "active", "revoked"] as const;
export type ClientUserStatus = (typeof CLIENT_USER_STATUSES)[number];

export type ClientUser = {
  id: string;
  ownerId: string;
  clientId: string;
  email: string;
  name: string;
  status: ClientUserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date | null;
  /** When the user's newest live link expires; `null` when there is none. */
  linkExpiresAt: Date | null;
};

/** Persistence for client users. Every method is scoped to the owner. */
export interface ClientUserRepository {
  list(ownerId: string, filter: { clientId?: string }): Promise<ClientUser[]>;
  findById(ownerId: string, id: string): Promise<ClientUser | null>;
  /** `null` when the client already has a user with that email. */
  insert(ownerId: string, input: { clientId: string; email: string; name: string }): Promise<ClientUser | null>;
  /** `false` when the user is unknown to this owner. */
  setStatus(ownerId: string, id: string, status: ClientUserStatus): Promise<boolean>;
  delete(ownerId: string, id: string): Promise<boolean>;
}

export type PortalTokenRecord = {
  id: string;
  ownerId: string;
  clientId: string;
  clientUserId: string | null;
  /** SHA-256 of the token, hex. */
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

/** Persistence for portal tokens: hashes only, never a token. */
export interface PortalTokenRepository {
  insert(row: Omit<PortalTokenRecord, "id" | "createdAt">): Promise<PortalTokenRecord>;
  /**
   * The token with this hash while it is unrevoked and unexpired and, for a client user's
   * token, while that user is not revoked; else `null`.
   */
  findLiveByHash(tokenHash: string): Promise<PortalTokenRecord | null>;
  /** Revoke a client user's live tokens. Returns how many. */
  revokeForClientUser(ownerId: string, clientUserId: string): Promise<number>;
  /** Revoke a client's live anonymous links (not its users'). Returns how many. */
  revokeClientLinks(ownerId: string, clientId: string): Promise<number>;
  /** Stamp the token's last use; a client user's first use makes it `active`. */
  markUsed(tokenId: string, clientUserId: string | null): Promise<void>;
}

/** A link just made. `token` exists only here: it is not stored and cannot be shown again. */
export type IssuedPortalLink = { token: string; record: PortalTokenRecord };

/** Why an agency operation was refused. Controllers map each to a status. */
export type AgencyFailure = "client_not_found" | "client_user_not_found" | "client_user_exists" | "client_user_revoked";

export class AgencyOperationError extends Error {
  constructor(readonly reason: AgencyFailure) {
    super(reason);
  }
}

/** Client users, on behalf of one owner. A user the owner does not have reads as not found. */
export interface ClientUsers {
  list(ownerId: string, filter: { clientId?: string }): Promise<ClientUser[]>;
  get(ownerId: string, id: string): Promise<ClientUser | null>;
  /** Create the user and its first link. The client must be the owner's. */
  invite(ownerId: string, input: { clientId: string; email: string; name: string }): Promise<{ clientUser: ClientUser; link: IssuedPortalLink }>;
  /** A fresh link; every earlier one stops working. Refused for a revoked user. */
  resend(ownerId: string, id: string): Promise<{ clientUser: ClientUser; link: IssuedPortalLink }>;
  /** Mark revoked and kill its links, at once. */
  revoke(ownerId: string, id: string): Promise<ClientUser>;
  /** Delete the user; its links go with it. */
  remove(ownerId: string, id: string): Promise<boolean>;
}

/**
 * A verified portal token: which owner's which client it may read, and what. Only ever
 * client scope — a portal never names a single website of its own.
 */
export type PortalClaim = {
  tokenId: string;
  ownerId: string;
  clientId: string;
  clientUserId: string | null;
  /** From the client's feature switches; the embed API gates each read on these. */
  sections: EmbedSection[];
  expiresAt: Date;
  createdAt: Date;
};

/** The port the embed API takes to accept portal tokens next to embed links' tokens. */
export interface PortalAccess {
  /**
   * `null` for anything but a live token whose owner is active and whose client is still
   * the owner's and in service: malformed, unknown, expired, revoked alike.
   */
  verify(token: string | undefined): Promise<PortalClaim | null>;
}

/** What opening a portal link shows: the client, its websites, and the agency's brand. */
export type PortalSession = {
  claim: PortalClaim;
  client: {
    id: string;
    name: string;
    company: string;
    status: string;
    featuresEnabled: Record<string, boolean>;
  };
  websites: { id: string; name: string; url: string }[];
  brand: BrandView;
  clientUser: { name: string; email: string } | null;
};

export interface PortalLinks extends PortalAccess {
  /** A new anonymous link for the whole client; any earlier anonymous link stops working. */
  issueClientLink(ownerId: string, clientId: string): Promise<IssuedPortalLink>;
  /** Stop the client's anonymous links. `false` when the client is not the owner's. */
  revokeClientLinks(ownerId: string, clientId: string): Promise<boolean>;
  /** Verify and load what the portal page shows, and record the visit. */
  open(token: string | undefined): Promise<PortalSession | null>;
}

// ─── The module ──────────────────────────────────────────────────────────────

export interface AgencyModule {
  whiteLabel: WhiteLabel;
  portal: PortalLinks;
  clientUsers: ClientUsers;
  /**
   * `/user/agency/white-label`, `/user/agency/client-users` and
   * `/user/agency/clients/:clientId/portal-token`, behind the session. Mount at `/user/agency`.
   */
  dashboardRoutes: AuthedRouter;
  /** `POST /validate`, public: the portal link is the credential. Mount at `/agency/portal`. */
  portalRoutes: PublicRouter;
}
