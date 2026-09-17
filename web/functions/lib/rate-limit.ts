// Fixed-window rate limiter backed by KV — see wrangler.toml's
// RATE_LIMIT_KV comment for why this exists instead of Cloudflare's actual
// Rate Limiting binding (Pages' config schema rejects it outright).
//
// Race condition: two concurrent requests can both read the same count
// before either writes back, undercounting by one in the rare case they
// land in the same millisecond. Acceptable here — this is blunt abuse
// protection for a contact form and a lead-gen tool, not a precise quota,
// same spirit as the in-memory Map this replaces (which had the same kind
// of non-atomicity) and as uptime-server's own status-page rate limiter.

interface KVLike {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
}

export async function checkRateLimit(kv: KVLike, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const bucket = `${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  const current = await kv.get(bucket);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= limit) return false;
  await kv.put(bucket, String(count + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}
