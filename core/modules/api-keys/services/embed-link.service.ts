/**
 * Embed links: what an iframed dashboard authenticates with.
 *
 * A website key is a secret that must never reach a browser; an embed link is made to. It
 * reads one website's summary (or lists and reads one client's websites) and nothing else.
 *
 * The link is a row in `embed_links`. Its token is signed from the row — same secret as
 * session tokens, but `typ: "embed"` so neither can stand in for the other — and carries
 * no expiry and no randomness, so the same row always yields the same token and the
 * dashboard can show it whenever the owner opens the page. Nothing of it is stored.
 * Revoking sets `revoked_at`; a token is good only while its row exists and is unrevoked.
 */

import * as jose from "jose";
import { env } from "../../../config";
import { log } from "../../../platform/observability/logger";
import { postgresEmbedLinkRepository, type EmbedLinkRepository } from "./embed-link.repository";
import { DEFAULT_EMBED_SECTIONS, normalizeSections, type EmbedSection } from "../interfaces/embed-sections";
import type { EmbedClaim, EmbedLinkRecord, EmbedLinks, EmbedLinkView, EmbedTarget } from "../interfaces";

const TYP = "embed";

function secret(): Uint8Array {
  const s = env().jwtSecret;
  if (!s) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(s);
}

// ─── Verification cache ─────────────────────────────────────────────────────
// Whether a link is live is asked on every iframe load; the answer is kept briefly under
// the link id. A revoke on this instance clears it at once; another instance's cache
// catches up within the TTL.
const ANSWER_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 5_000;
const answers = new Map<string, { value: EmbedLinkRecord | null; expiresAt: number }>();

export function forgetEmbedLink(linkId?: string): void {
  if (linkId) answers.delete(linkId);
  else answers.clear();
}

export function createEmbedLinkService(repo: EmbedLinkRepository): EmbedLinks {
  async function liveLink(linkId: string): Promise<EmbedLinkRecord | null> {
    const hit = answers.get(linkId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await repo.findLiveById(linkId);
    if (answers.size >= CACHE_MAX_ENTRIES) answers.delete(answers.keys().next().value!);
    answers.set(linkId, { value, expiresAt: Date.now() + ANSWER_TTL_MS });
    return value;
  }

  async function getOrCreate(ownerId: string, target: EmbedTarget, sections: EmbedSection[] = DEFAULT_EMBED_SECTIONS) {
    const existing = await repo.findLive(target);
    if (existing) return { link: existing, created: false };

    // Two callers racing for the same target: the partial unique index lets one insert win,
    // and the loser reads the winner's row.
    const inserted = await repo.insert(ownerId, target, normalizeSections(sections));
    if (!inserted) {
      const raced = await repo.findLive(target);
      if (!raced) throw new Error("embed link could not be created");
      return { link: raced, created: false };
    }
    log.info({ category: "embed", msg: "embed_link_created", user_id: ownerId, link_id: inserted.id });
    return { link: inserted, created: true };
  }

  async function setSections(linkId: string, sections: EmbedSection[]) {
    const updated = await repo.setSections(linkId, normalizeSections(sections));
    // Permissions are read from the row; drop the cached copy so the change applies at once.
    forgetEmbedLink(linkId);
    if (updated) log.info({ category: "embed", msg: "embed_link_sections_changed", user_id: updated.ownerId, link_id: linkId, sections: updated.sections });
    return updated;
  }

  async function revoke(linkId: string): Promise<boolean> {
    const revoked = await repo.markRevoked(linkId);
    forgetEmbedLink(linkId);
    if (revoked) log.info({ category: "embed", msg: "embed_link_revoked", user_id: revoked.ownerId, link_id: linkId });
    return revoked !== null;
  }

  /** No `iat` and no `exp`: the same link always signs to the same token. */
  async function tokenFor(link: EmbedLinkRecord): Promise<string> {
    const claims = link.scope === "website" ? { wid: link.targetId } : { cid: link.targetId };
    return new jose.SignJWT({ typ: TYP, lid: link.id, ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret());
  }

  async function present(link: EmbedLinkRecord, targetName: string): Promise<EmbedLinkView> {
    const token = await tokenFor(link);
    const url = `${env().frontendUrl}/embed/${link.targetId}?token=${token}${link.scope === "client" ? "&client=1" : ""}`;
    return {
      id: link.id,
      scope: link.scope,
      target_id: link.targetId,
      target_name: targetName,
      token,
      embed_url: url,
      sections: link.sections,
      created_at: link.createdAt.toISOString(),
    };
  }

  async function verify(token: string | undefined): Promise<EmbedClaim | null> {
    if (!token) return null;
    try {
      const { payload } = await jose.jwtVerify(token, secret(), { algorithms: ["HS256"] });
      if (payload.typ !== TYP || typeof payload.lid !== "string" || !payload.lid) return null;
      const link = await liveLink(payload.lid);
      if (!link) return null;
      // The row is the truth; the token must name the target the row has.
      const named = link.scope === "website" ? payload.wid : payload.cid;
      return named === link.targetId ? link : null;
    } catch {
      return null;
    }
  }

  return {
    getOrCreate,
    findById: (id) => repo.findLiveById(id),
    findLive: (target) => repo.findLive(target),
    listLive: (ownerId) => repo.listLive(ownerId),
    revoke,
    setSections,
    tokenFor,
    present,
    verify,
  };
}

export const embedLinkService = createEmbedLinkService(postgresEmbedLinkRepository);
