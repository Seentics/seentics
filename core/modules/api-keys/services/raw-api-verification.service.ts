/**
 * Authenticating the public data API (`/v1/websites/:website_id/…`) with an account key.
 *
 * Two checks, both cached so a busy integration costs neither a bcrypt comparison nor a
 * database read per request: the key is a live account key (`verifyAccountApiKey`, which
 * has its own answer cache and shares concurrent bcrypt checks), and the website exists
 * and belongs to the key's owner.
 *
 * `null` for every failure — not an account key, unknown website, someone else's website —
 * so a caller cannot tell which, and cannot probe which website ids exist.
 */

import type { OwnedWebsites } from "../../websites/interfaces";
import { API_SCOPES, type AccountKeyVerifier, type ApiKeyVerifier, type ApiScope } from "../interfaces";

const OWNED_TTL_MS = 30_000;
const NOT_OWNED_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 5_000;

export function createRawApiVerifier(deps: {
  accountKeys: AccountKeyVerifier;
  ownedWebsites: Pick<OwnedWebsites, "getWebsite">;
}): ApiKeyVerifier {
  const owned = new Map<string, { value: boolean; expiresAt: number }>();
  const inFlight = new Map<string, Promise<boolean>>();

  function ownsWebsite(userId: string, websiteId: string): Promise<boolean> {
    const cacheKey = `${userId}|${websiteId}`;
    const hit = owned.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value);
    const running = inFlight.get(cacheKey);
    if (running) return running;

    const check = deps.ownedWebsites
      .getWebsite(userId, websiteId)
      .then((site) => {
        const value = site !== null;
        if (owned.size >= CACHE_MAX_ENTRIES) owned.delete(owned.keys().next().value!);
        owned.set(cacheKey, { value, expiresAt: Date.now() + (value ? OWNED_TTL_MS : NOT_OWNED_TTL_MS) });
        return value;
      })
      // A lookup that throws (a malformed id) is a refusal, and is not remembered.
      .catch(() => false)
      .finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, check);
    return check;
  }

  return {
    async verify(rawKey, websiteId) {
      const key = await deps.accountKeys.verify(rawKey?.trim());
      if (!key) return null;
      if (!(await ownsWebsite(key.userId, websiteId))) return null;
      // Only the data scopes matter here. A key with none (websites:* only) gets an empty
      // list, which `requireScope` refuses — it never means "unrestricted".
      const scopes = API_SCOPES.filter((s): s is ApiScope => (key.scopes as string[]).includes(s));
      return { websiteId, apiKeyId: key.apiKeyId, scopes };
    },
  };
}
