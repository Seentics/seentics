import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { apiKeys, db } from "../../db";
import type { ApiScope } from "../public-api/keys/scopes";

export type VerifiedApiKeyContext = {
  websiteId: string;
  apiKeyId: string;
  scopes: ApiScope[];
};

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
export async function verifyWebsiteApiKey(
  rawKey: string | undefined,
  websiteId: string,
): Promise<VerifiedApiKeyContext | null> {
  if (!rawKey?.trim()) return null;

  const prefix = rawKey.slice(0, 16);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));

  for (const row of rows) {
    // `row.websiteId`, not `row.id`. This compared the key's own primary key against the
    // website id, so the loop skipped every candidate and verification could never
    // succeed — invisible until now only because no endpoint could mint a key to try.
    if (row.websiteId !== websiteId) continue;

    const ok = await bcrypt.compare(rawKey, row.keyHash);
    if (!ok) continue;

    // Best-effort, and deliberately not awaited: a last-used stamp is telemetry, and a
    // slow write on it should not delay the request that earned it.
    void (async () => {
      try {
        await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
      } catch {
        /* ignore */
      }
    })();

    return {
      websiteId: row.websiteId,
      apiKeyId: row.id,
      scopes: (row.scopes ?? []) as ApiScope[],
    };
  }

  return null;
}
