/** Tiny in-memory TTL cache with LRU eviction when max entries exceeded. */

type Entry<V> = { value: V; exp: number; lastTouch: number };

export class MemoryCache<V = unknown> {
  private store = new Map<string, Entry<V>>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = Math.max(16, maxEntries);
  }

  get(key: string): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    const now = Date.now();
    if (e.exp <= now) {
      this.store.delete(key);
      return undefined;
    }
    e.lastTouch = now;
    return e.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    const now = Date.now();
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOne();
    }
    this.store.set(key, { value, exp: now + ttlMs, lastTouch: now });
  }

  private evictOne(): void {
    let oldestKey: string | undefined;
    let oldest = Infinity;
    for (const [k, e] of this.store) {
      if (e.lastTouch < oldest) {
        oldest = e.lastTouch;
        oldestKey = k;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }

  /** Best-effort sweep of expired keys (called occasionally from middleware). */
  sweepExpired(): void {
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (e.exp <= now) this.store.delete(k);
    }
  }
}
