/**
 * Portal links: issuing them, and turning one back into what it may read.
 *
 * A token is checked against four things on every use, none of them cached, so each takes
 * effect on the next request: the token row (unrevoked, unexpired — and for a client
 * user's token, that user unrevoked), the owner's account (active), and the client (still
 * the owner's, and in service). What it may then read is the client's websites, through
 * the embed API's client-scope rule — this service only says which client.
 */

import type { ClientDirectory, ClientFeature } from "../../websites/interfaces";
import type { EmbedSection } from "../../api-keys/interfaces";
import { log } from "../../../platform/observability/logger";
import {
  AgencyOperationError,
  PORTAL_LINK_TTL_DAYS,
  type AgencyBranding,
  type ClientUserRepository,
  type IssuedPortalLink,
  type PortalClaim,
  type PortalLinks,
  type PortalSession,
  type PortalTokenRepository,
} from "../interfaces";
import { generatePortalToken, hashPortalToken, isPortalTokenShape, sameDigest } from "../lib/portal-token";

const DAY_MS = 86_400_000;

/** Which embed sections a client's feature switches open. Funnels and the rest have none yet. */
const SECTION_FOR_FEATURE: [ClientFeature, EmbedSection][] = [
  ["analytics", "analytics"],
  ["replays", "recordings"],
  ["heatmaps", "heatmaps"],
];

export function sectionsForFeatures(features: Partial<Record<ClientFeature, boolean>>): EmbedSection[] {
  return SECTION_FOR_FEATURE.filter(([f]) => features[f] !== false).map(([, s]) => s);
}

export type PortalAccessDeps = {
  tokens: PortalTokenRepository;
  clients: Pick<ClientDirectory, "getClient">;
  branding: AgencyBranding;
  /** For the name and email a client user's portal greets them with. */
  clientUsers: Pick<ClientUserRepository, "findById">;
  /** Whether the owner's account may still act; a disabled account's links stop with it. */
  accountActive: (userId: string) => Promise<boolean>;
  now?: () => Date;
};

export class PortalAccessService implements PortalLinks {
  constructor(private readonly deps: PortalAccessDeps) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  /** Make a token and store its hash. The caller has already proven it may. */
  async issue(ownerId: string, clientId: string, clientUserId: string | null, ttlDays: number): Promise<IssuedPortalLink> {
    const token = generatePortalToken();
    const record = await this.deps.tokens.insert({
      ownerId,
      clientId,
      clientUserId,
      tokenHash: hashPortalToken(token),
      expiresAt: new Date(this.now().getTime() + ttlDays * DAY_MS),
    });
    log.info({ category: "agency", msg: "portal_link_issued", user_id: ownerId, client_id: clientId, token_id: record.id });
    return { token, record };
  }

  revokeForClientUser(ownerId: string, clientUserId: string): Promise<number> {
    return this.deps.tokens.revokeForClientUser(ownerId, clientUserId);
  }

  async issueClientLink(ownerId: string, clientId: string): Promise<IssuedPortalLink> {
    if (!(await this.deps.clients.getClient(ownerId, clientId))) throw new AgencyOperationError("client_not_found");
    // "Generating one replaces any previous link."
    await this.deps.tokens.revokeClientLinks(ownerId, clientId);
    return this.issue(ownerId, clientId, null, PORTAL_LINK_TTL_DAYS);
  }

  async revokeClientLinks(ownerId: string, clientId: string): Promise<boolean> {
    if (!(await this.deps.clients.getClient(ownerId, clientId))) return false;
    await this.deps.tokens.revokeClientLinks(ownerId, clientId);
    return true;
  }

  /** The claim and the client it was checked against, so `open` need not load it twice. */
  private async resolve(token: string | undefined) {
    if (!isPortalTokenShape(token)) return null;
    const hash = hashPortalToken(token);
    const record = await this.deps.tokens.findLiveByHash(hash);
    // The lookup matched on the hash already; this re-check is constant-time so the answer
    // never depends on how much of a guess was right, whatever the index did.
    if (!record || !sameDigest(record.tokenHash, hash)) return null;
    if (record.expiresAt.getTime() <= this.now().getTime()) return null;
    if (!(await this.deps.accountActive(record.ownerId))) return null;
    const client = await this.deps.clients.getClient(record.ownerId, record.clientId);
    if (!client || client.status !== "active") return null;

    const claim: PortalClaim = {
      tokenId: record.id,
      ownerId: record.ownerId,
      clientId: record.clientId,
      clientUserId: record.clientUserId,
      sections: sectionsForFeatures(client.featuresEnabled),
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
    return { claim, client };
  }

  async verify(token: string | undefined): Promise<PortalClaim | null> {
    return (await this.resolve(token))?.claim ?? null;
  }

  async open(token: string | undefined): Promise<PortalSession | null> {
    const resolved = await this.resolve(token);
    if (!resolved) return null;
    const { claim, client } = resolved;
    // Best effort: a failed stamp must not turn a good link away.
    await this.deps.tokens.markUsed(claim.tokenId, claim.clientUserId).catch((err) =>
      log.warn({ category: "agency", msg: "portal_mark_used_failed", token_id: claim.tokenId, err: String(err) }),
    );
    return {
      claim,
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        status: client.status,
        featuresEnabled: client.featuresEnabled,
      },
      // Only sites still the owner's: `getClient` lists the client's, which are the owner's.
      websites: client.websites
        .filter((w) => w.ownerId === claim.ownerId && w.clientId === claim.clientId)
        .map((w) => ({ id: w.id, name: w.name, url: w.url })),
      brand: await this.deps.branding.brandFor(claim.ownerId),
      clientUser: await this.clientUserOf(claim),
    };
  }

  private async clientUserOf(claim: PortalClaim): Promise<PortalSession["clientUser"]> {
    if (!claim.clientUserId) return null;
    const user = await this.deps.clientUsers.findById(claim.ownerId, claim.clientUserId);
    return user ? { name: user.name, email: user.email } : null;
  }
}
