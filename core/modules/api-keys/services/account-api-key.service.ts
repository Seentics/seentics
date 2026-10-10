/**
 * Account API keys: the management API's credentials.
 *
 * An account key acts for the account that minted it — creating clients and websites from
 * a signup handler, and reading its websites' data through the public data API, where no
 * dashboard session exists. Storage rules: bcrypt hash plus a 16-character lookup
 * prefix, and the plaintext returned exactly once.
 *
 * A key is `snt_acct_<secret>`. The fixed prefix is how the gateway and Core tell it apart
 * from other credentials without a lookup.
 */

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { accountApiKeys, db } from "../../../db";
import { log } from "../../../platform/observability/logger";
import type { AccountScope, VerifiedAccountKey } from "../interfaces";

export const ACCOUNT_KEY_PREFIX = "snt_acct_";

export type AccountApiKeySummary = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used: string | null;
};

export type CreatedAccountApiKey = AccountApiKeySummary & { key: string };

const HASH_ROUNDS = 10;

function toSummary(row: typeof accountApiKeys.$inferSelect): AccountApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.keyPrefix,
    scopes: row.scopes ?? [],
    created_at: row.createdAt.toISOString(),
    last_used: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export async function listAccountApiKeys(userId: string): Promise<AccountApiKeySummary[]> {
  const rows = await db
    .select()
    .from(accountApiKeys)
    .where(eq(accountApiKeys.userId, userId))
    .orderBy(desc(accountApiKeys.createdAt));
  return rows.map(toSummary);
}

export async function createAccountApiKey(
  userId: string,
  name: string,
  scopes: AccountScope[],
): Promise<CreatedAccountApiKey> {
  const secret = `${ACCOUNT_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const prefix = secret.slice(0, 16);
  const keyHash = await bcrypt.hash(secret, HASH_ROUNDS);

  const [row] = await db
    .insert(accountApiKeys)
    .values({ userId, name, keyHash, keyPrefix: prefix, scopes })
    .returning();

  log.info({ category: "api_keys", msg: "account_api_key_created", user_id: userId, key_id: row!.id, scopes });
  return { ...toSummary(row!), key: secret };
}

/** Scoped to the owner, so a key id from another account cannot be revoked. */
export async function revokeAccountApiKey(userId: string, keyId: string): Promise<boolean> {
  const rows = await db
    .delete(accountApiKeys)
    .where(and(eq(accountApiKeys.id, keyId), eq(accountApiKeys.userId, userId)))
    .returning({ id: accountApiKeys.id });
  forgetVerifiedAccountKeys();
  if (rows.length > 0) log.info({ category: "api_keys", msg: "account_api_key_revoked", user_id: userId, key_id: keyId });
  return rows.length > 0;
}

// ─── Verification ───────────────────────────────────────────────────────────
// Answers kept briefly under a digest of the
// key, concurrent askers share one bcrypt check, and a revoke clears this instance at once.

const VERIFIED_TTL_MS = 30_000;
const REFUSED_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 5_000;
const LAST_USED_INTERVAL_MS = 60_000;
const answers = new Map<string, { value: VerifiedAccountKey | null; expiresAt: number }>();
const inFlight = new Map<string, Promise<VerifiedAccountKey | null>>();
const lastUsedWritten = new Map<string, number>();

export function forgetVerifiedAccountKeys(): void {
  answers.clear();
  inFlight.clear();
}

export async function verifyAccountApiKey(rawKey: string | undefined): Promise<VerifiedAccountKey | null> {
  if (!rawKey?.startsWith(ACCOUNT_KEY_PREFIX)) return null;

  const cacheKey = createHash("sha256").update(rawKey).digest("hex");
  const hit = answers.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const running = inFlight.get(cacheKey);
  if (running) return running;

  const check = checkKey(rawKey)
    .then((value) => {
      if (answers.size >= CACHE_MAX_ENTRIES) answers.delete(answers.keys().next().value!);
      answers.set(cacheKey, { value, expiresAt: Date.now() + (value ? VERIFIED_TTL_MS : REFUSED_TTL_MS) });
      return value;
    })
    .finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, check);
  return check;
}

async function checkKey(rawKey: string): Promise<VerifiedAccountKey | null> {
  const rows = await db.select().from(accountApiKeys).where(eq(accountApiKeys.keyPrefix, rawKey.slice(0, 16)));
  for (const row of rows) {
    if (!(await compareKey(rawKey, row.keyHash))) continue;
    stampLastUsed(row.id);
    return { userId: row.userId, apiKeyId: row.id, scopes: (row.scopes ?? []) as AccountScope[] };
  }
  return null;
}

/** Best-effort and not awaited: telemetry must not delay the request. */
function stampLastUsed(keyId: string): void {
  const previous = lastUsedWritten.get(keyId);
  if (previous !== undefined && Date.now() - previous < LAST_USED_INTERVAL_MS) return;
  if (lastUsedWritten.size >= 5_000) lastUsedWritten.delete(lastUsedWritten.keys().next().value!);
  const writtenAt = Date.now();
  lastUsedWritten.set(keyId, writtenAt);
  void (async () => {
    try {
      await db.update(accountApiKeys).set({ lastUsedAt: new Date() }).where(eq(accountApiKeys.id, keyId));
    } catch {
      if (lastUsedWritten.get(keyId) === writtenAt) lastUsedWritten.delete(keyId);
    }
  })();
}

async function compareKey(rawKey: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(rawKey, hash);
  } catch {
    return bcrypt.compare(rawKey, hash).catch(() => false);
  }
}
