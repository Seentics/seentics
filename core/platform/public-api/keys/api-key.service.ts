/**
 * API keys: minting, listing, revoking.
 *
 * A platform concern rather than a module one, because the table is platform-owned and
 * the thing a key grants access to — the raw data API — is a platform surface that fans
 * out across several modules.
 *
 * ─── What a key is ──────────────────────────────────────────────────────────────
 *
 * A key is `snt_<websitePrefix>_<secret>`. Only its bcrypt hash is stored, alongside the
 * first 16 characters as a lookup prefix: without that, verifying a key would mean
 * bcrypt-comparing it against every key in the table, which is both slow and a timing
 * signal. The prefix narrows the search to a handful of rows; bcrypt decides.
 *
 * The plaintext is returned exactly once, from `create`. There is no endpoint that can
 * return it again, which is the point — a key readable from the dashboard is a key
 * readable by anyone who gets a session.
 */

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { apiKeys, db } from "../../../db";
import type { ApiScope } from "./scopes";

export { API_SCOPES, SCOPE_DESCRIPTIONS, type ApiScope } from "./scopes";

/** A key as the dashboard sees it. Never carries the secret. */
export type ApiKeySummary = {
  id: string;
  name: string;
  /** First 16 characters, enough to recognise a key in a log. */
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};

/** What `create` returns: the summary, plus the one and only sight of the secret. */
export type CreatedApiKey = ApiKeySummary & { secret: string };

/** bcrypt rounds. 10 is the usual default; a key is verified on every raw API call. */
const HASH_ROUNDS = 10;

/**
 * Mint a key.
 *
 * The prefix embeds a slice of the website id so a leaked key is traceable to a site
 * without a database lookup, and the random half is 32 bytes of base64url — well past
 * what a brute force could reach through bcrypt and a rate limiter.
 */
function generateSecret(websiteId: string): { secret: string; prefix: string } {
  const site = websiteId.replace(/-/g, '').slice(0, 6);
  const secret = `snt_${site}_${randomBytes(32).toString('base64url')}`;
  return { secret, prefix: secret.slice(0, 16) };
}

function toSummary(row: typeof apiKeys.$inferSelect): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    scopes: row.scopes ?? [],
    created_at: row.createdAt.toISOString(),
    last_used_at: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

/** Every key for a website, newest first. */
export async function listApiKeys(websiteId: string): Promise<ApiKeySummary[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.websiteId, websiteId))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(toSummary);
}

/**
 * Mint a key for a website.
 *
 * `userId` records who created it — a key outlives the session that made it, and a
 * revoked-by-whom audit is only possible if created-by-whom was recorded.
 */
export async function createApiKey(
  websiteId: string,
  userId: string,
  name: string,
  scopes: ApiScope[],
): Promise<CreatedApiKey> {
  const { secret, prefix } = generateSecret(websiteId);
  const keyHash = await bcrypt.hash(secret, HASH_ROUNDS);

  const [row] = await db
    .insert(apiKeys)
    .values({ websiteId, userId, name, keyHash, keyPrefix: prefix, scopes })
    .returning();

  // The only moment the plaintext exists outside the caller's request.
  return { ...toSummary(row!), secret };
}

/**
 * Revoke a key.
 *
 * Scoped to the website as well as the id so a key id from one site cannot be used to
 * delete another's — the route authorizes the *website*, and this is what makes that
 * check sufficient. Returns whether anything was deleted, so the route can 404.
 */
export async function revokeApiKey(websiteId: string, keyId: string): Promise<boolean> {
  const rows = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.websiteId, websiteId)))
    .returning({ id: apiKeys.id });
  return rows.length > 0;
}
