/** In-memory token-bucket rate limiter (per key). */

type Bucket = {
  tokens: number;
  lastRefillMs: number;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

function refill(b: Bucket, now: number): void {
  if (b.windowMs <= 0) return;
  const elapsed = now - b.lastRefillMs;
  const rate = b.limit / b.windowMs;
  b.tokens = Math.min(b.limit, b.tokens + elapsed * rate);
  b.lastRefillMs = now;
}

export type RateResult = { allowed: boolean; remaining: number; limit: number; resetInMs: number };

export function takeRateToken(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.limit !== limit || b.windowMs !== windowMs) {
    b = { tokens: limit, lastRefillMs: now, limit, windowMs };
    buckets.set(key, b);
  }
  refill(b, now);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.max(0, Math.floor(b.tokens)),
      limit,
      resetInMs: Math.ceil((1 / (limit / windowMs)) || windowMs),
    };
  }
  return { allowed: false, remaining: 0, limit, resetInMs: windowMs };
}

/** Drop stale buckets (call from periodic sweep). */
export function pruneRateBuckets(maxIdleMs: number): void {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.lastRefillMs > maxIdleMs) buckets.delete(k);
  }
}
