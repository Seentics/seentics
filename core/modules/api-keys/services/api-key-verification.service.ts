import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { apiKeys, db } from "../../../db";
import type { ApiScope, VerifiedApiKeyContext } from "../interfaces";

const lastUsedWritten = new Map<string, number>();
const LAST_USED_INTERVAL_MS = 60_000;

/**
 * Validate an `X-API-Key` against `api_keys` for one website.
 *
 * The prefix narrows the candidate rows before bcrypt runs; without it, verification
 * would mean comparing the presented key against every key in the table. The comparison
 * that decides is still bcrypt's, so a matching prefix proves nothing on its own.
 *
 * `null` for every failure — unknown prefix, wrong website, bad secret — so a caller
 * cannot tell which of those it was.
 */
/**
 * Answers are kept briefly, and concurrent askers share one check.
 *
 * Every public API call used to run a bcrypt comparison, which is a deliberately slow hash and,
 * in bcryptjs, plain JavaScript on the one thread serving all requests. A wrong key with a real
 * prefix cost the same, so guessing was also a way to burn the process's CPU. Now one check per
 * key per window, and the comparison runs natively off the main thread. A revoked key stops
 * working within `TTL`, or at once on this instance (`forgetVerifiedKeys`).
 */
const VERIFIED_TTL_MS = 30_000;
const REFUSED_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 5_000;
const answers = new Map<string, { value: VerifiedApiKeyContext | null; expiresAt: number }>();
const inFlight = new Map<string, Promise<VerifiedApiKeyContext | null>>();

/** After a key is revoked or its scopes change. */
export function forgetVerifiedKeys(): void {
  answers.clear();
  inFlight.clear();
}

export async function verifyWebsiteApiKey(
  rawKey: string | undefined,
  websiteId: string,
): Promise<VerifiedApiKeyContext | null> {
  if (!rawKey?.trim()) return null;

  // Keyed by a digest, so the map never holds a usable key.
  const cacheKey = `${createHash("sha256").update(rawKey).digest("hex")}|${websiteId}`;
  const hit = answers.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const running = inFlight.get(cacheKey);
  if (running) return running;

  const check = checkKey(rawKey, websiteId)
    .then((value) => {
      if (answers.size >= CACHE_MAX_ENTRIES) answers.delete(answers.keys().next().value!);
      answers.set(cacheKey, { value, expiresAt: Date.now() + (value ? VERIFIED_TTL_MS : REFUSED_TTL_MS) });
      return value;
    })
    .finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, check);
  return check;
}

async function checkKey(rawKey: string, websiteId: string): Promise<VerifiedApiKeyContext | null> {
  const prefix = rawKey.slice(0, 16);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));

  for (const row of rows) {
    // `row.websiteId`, not `row.id`. This compared the key's own primary key against the
    // website id, so the loop skipped every candidate and verification could never
    // succeed — invisible until now only because no endpoint could mint a key to try.
    if (row.websiteId !== websiteId) continue;

    const ok = await compareKey(rawKey, row.keyHash);
    if (!ok) continue;

    // Best-effort, and deliberately not awaited: a last-used stamp is telemetry, and a
    // slow write on it should not delay the request that earned it.
    const previous = lastUsedWritten.get(row.id);
    if (previous === undefined || Date.now() - previous >= LAST_USED_INTERVAL_MS) {
      if (lastUsedWritten.size >= 5_000) lastUsedWritten.delete(lastUsedWritten.keys().next().value!);
      const writtenAt = Date.now();
      lastUsedWritten.set(row.id, writtenAt);
      void (async () => {
        try {
          await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
        } catch {
          if (lastUsedWritten.get(row.id) === writtenAt) lastUsedWritten.delete(row.id);
        }
      })();
    }

    return {
      websiteId: row.websiteId,
      apiKeyId: row.id,
      scopes: (row.scopes ?? []) as ApiScope[],
    };
  }

  return null;
}

/** Native bcrypt (off the main thread); the JavaScript implementation only if it cannot read a hash. */
async function compareKey(rawKey: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(rawKey, hash);
  } catch {
    return bcrypt.compare(rawKey, hash).catch(() => false);
  }
}
