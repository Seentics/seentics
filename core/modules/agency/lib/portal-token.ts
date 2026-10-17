/**
 * Portal tokens: 32 random bytes, base64url, behind a fixed prefix.
 *
 * Only the SHA-256 is stored. A token has 256 bits of entropy, so a fast hash is the right
 * one — there is nothing to brute-force that a slow hash would protect — and it lets the
 * lookup be one indexed equality on the hash.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PORTAL_TOKEN_PREFIX } from "../interfaces";

const TOKEN_BYTES = 32;
/** base64url of 32 bytes, unpadded. */
const BODY = /^[A-Za-z0-9_-]{43}$/;

export function generatePortalToken(): string {
  return PORTAL_TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Shape only: rejects junk before it costs a hash and a query. */
export function isPortalTokenShape(token: string | undefined): token is string {
  return typeof token === "string" && token.startsWith(PORTAL_TOKEN_PREFIX) && BODY.test(token.slice(PORTAL_TOKEN_PREFIX.length));
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time equality of two hex digests. */
export function sameDigest(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
