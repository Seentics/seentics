/** In-memory token-bucket rate limiter (per key). */

type Bucket = {
  tokens: number;
  lastRefillMs: number;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 100_000;

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
    // Public tracker and auth paths can receive arbitrary client keys. Keep the
    // process-local limiter bounded between periodic sweeps under an IP-cardinality flood.
    if (!b && buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value!);
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
