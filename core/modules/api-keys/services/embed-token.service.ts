/**
 * Embed tokens: what an iframed dashboard authenticates with.
 *
 * A website key is a long-lived secret and must never reach a browser; an embed token is
 * made to. It reads one website's summary and nothing else, and it expires — an hour by
 * default — so the usual flow is that a customer's backend mints one per page view of the
 * page that holds the iframe.
 *
 * Stateless, signed with the same secret as session tokens but a different `typ`, so one
 * can never be presented as the other. There is no revoke: expiry is the bound, which is
 * why the maximum is kept to 30 days.
 */

import * as jose from "jose";
import { env } from "../../../config";
import type { EmbedTokenIssuer, IssuedEmbedToken } from "../interfaces";

export const EMBED_TTL_DEFAULT_SECONDS = 60 * 60;
export const EMBED_TTL_MIN_SECONDS = 5 * 60;
export const EMBED_TTL_MAX_SECONDS = 30 * 24 * 60 * 60;

const TYP = "embed";

function secret(): Uint8Array {
  const s = env().jwtSecret;
  if (!s) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(s);
}

export async function issueEmbedToken(websiteId: string, ttlSeconds = EMBED_TTL_DEFAULT_SECONDS): Promise<IssuedEmbedToken> {
  const ttl = Math.min(EMBED_TTL_MAX_SECONDS, Math.max(EMBED_TTL_MIN_SECONDS, Math.floor(ttlSeconds)));
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const token = await new jose.SignJWT({ typ: TYP, wid: websiteId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  return { token, expiresAt };
}

/** The website the token reads, or `null` for anything else — expired, forged, or a session token. */
export async function verifyEmbedToken(token: string | undefined): Promise<{ websiteId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.typ !== TYP || typeof payload.wid !== "string" || !payload.wid) return null;
    return { websiteId: payload.wid };
  } catch {
    return null;
  }
}

export const embedTokens: EmbedTokenIssuer = { issue: issueEmbedToken, verify: verifyEmbedToken };
