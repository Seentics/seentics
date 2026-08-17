import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { apiKeys, db } from "../../db";
import { resolveWebsiteIds } from "./website-resolve";

export type VerifiedApiKeyContext = {
  websiteUuid: string;
  siteId: string;
  apiKeyId: string;
};

/** Validates `X-API-Key` (full secret) against `api_keys` for the resolved website. */
export async function verifyWebsiteApiKey(
  rawKey: string | undefined,
  websiteParam: string,
): Promise<VerifiedApiKeyContext | null> {
  if (!rawKey?.trim()) return null;
  let siteId: string;
  let uuidStr: string;
  try {
    const r = await resolveWebsiteIds(websiteParam);
    siteId = r.siteId;
    uuidStr = r.uuidStr;
  } catch {
    return null;
  }

  const prefix = rawKey.slice(0, 16);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));
  for (const row of rows) {
    if (row.websiteId !== uuidStr) continue;
    const ok = await bcrypt.compare(rawKey, row.keyHash);
    if (!ok) continue;
    void (async () => {
      try {
        await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
      } catch {
        /* ignore */
      }
    })();
    return { websiteUuid: uuidStr, siteId, apiKeyId: row.id };
  }
  return null;
}
