import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { apiKeys, db } from "../../db";

export type VerifiedApiKeyContext = {
  websiteId: string;
  apiKeyId: string;
};

/** Validates `X-API-Key` (full secret) against `api_keys` for the resolved website. */
export async function verifyWebsiteApiKey(
  rawKey: string | undefined,
  websiteId: string,
): Promise<VerifiedApiKeyContext | null> {
  if (!rawKey?.trim()) return null;

  const prefix = rawKey.slice(0, 16);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));
  for (const row of rows) {
    if (row.id !== websiteId) continue;
    const ok = await bcrypt.compare(rawKey, row.keyHash);
    if (!ok) continue;
    void (async () => {
      try {
        await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
      } catch {
        /* ignore */
      }
    })();
    return { websiteId: websiteId, apiKeyId: row.id };
  }
  return null;
}
