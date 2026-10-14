import type {
  BackfillCursor,
  BackfillSession,
  ClaimedStylesheet,
  StylesheetRow,
  StylesheetStatus,
  StylesheetStore,
} from "../../repositories/stylesheet.repository";

export type MemoryStylesheetRow = StylesheetRow & {
  bytes: number | null;
  contentSha256: string | null;
  nextAttemptAt: number;
  lastError: string | null;
  lastSeenAt: number;
};

/**
 * `StylesheetStore` over a Map, with the same semantics as the Postgres one: the pending
 * cap, conflict-ignoring inserts, the claim lease and the keyset backfill walk.
 */
export class MemoryStylesheetStore implements StylesheetStore {
  readonly rows = new Map<string, MemoryStylesheetRow>();
  sessions: BackfillSession[] = [];
  cursor: (BackfillCursor & { completed: boolean; scanned: number }) | null = null;
  now = () => Date.now();

  private k(websiteId: string, urlHash: string) {
    return `${websiteId}\0${urlHash}`;
  }

  row(websiteId: string, urlHash: string): MemoryStylesheetRow | undefined {
    return this.rows.get(this.k(websiteId, urlHash));
  }

  async enqueue(websiteId: string, entries: { url: string; urlHash: string }[], maxPending: number): Promise<number> {
    const pending = [...this.rows.values()].filter((r) => r.websiteId === websiteId && r.status === "pending").length;
    if (pending >= maxPending) return 0;
    let inserted = 0;
    for (const e of entries) {
      const key = this.k(websiteId, e.urlHash);
      const existing = this.rows.get(key);
      if (existing) {
        if (existing.lastSeenAt < this.now() - 86_400_000) existing.lastSeenAt = this.now();
        continue;
      }
      this.rows.set(key, {
        websiteId, urlHash: e.urlHash, url: e.url, status: "pending", storageKey: null, attempts: 0,
        bytes: null, contentSha256: null, nextAttemptAt: this.now(), lastError: null, lastSeenAt: this.now(),
      });
      inserted++;
    }
    return inserted;
  }

  async get(websiteId: string, urlHash: string): Promise<StylesheetRow | null> {
    const r = this.row(websiteId, urlHash);
    return r ? { websiteId: r.websiteId, urlHash: r.urlHash, url: r.url, status: r.status, storageKey: r.storageKey, attempts: r.attempts } : null;
  }

  async claimDue(limit: number, leaseSeconds: number): Promise<ClaimedStylesheet[]> {
    const due = [...this.rows.values()]
      .filter((r) => r.status === "pending" && r.nextAttemptAt <= this.now())
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
      .slice(0, limit);
    for (const r of due) r.nextAttemptAt = this.now() + leaseSeconds * 1000;
    return due.map((r) => ({ websiteId: r.websiteId, urlHash: r.urlHash, url: r.url, attempts: r.attempts }));
  }

  async hasContent(websiteId: string, sha: string): Promise<boolean> {
    return [...this.rows.values()].some((r) => r.websiteId === websiteId && r.contentSha256 === sha && r.status === "stored");
  }

  async markStored(websiteId: string, urlHash: string, w: { storageKey: string; bytes: number; contentSha256: string }): Promise<void> {
    const r = this.row(websiteId, urlHash)!;
    Object.assign(r, { status: "stored", storageKey: w.storageKey, bytes: w.bytes, contentSha256: w.contentSha256, attempts: r.attempts + 1, lastError: null });
  }

  async markFinal(websiteId: string, urlHash: string, status: Exclude<StylesheetStatus, "pending" | "stored">, attempts: number, error: string): Promise<void> {
    Object.assign(this.row(websiteId, urlHash)!, { status, attempts, lastError: error });
  }

  async scheduleRetry(websiteId: string, urlHash: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void> {
    Object.assign(this.row(websiteId, urlHash)!, { attempts, nextAttemptAt: nextAttemptAt.getTime(), lastError: error });
  }

  async listUnseenSince(websiteId: string, before: Date, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.websiteId === websiteId && r.lastSeenAt < before.getTime())
      .sort((a, b) => a.lastSeenAt - b.lastSeenAt)
      .slice(0, limit)
      .map((r) => ({ urlHash: r.urlHash, storageKey: r.storageKey }));
  }

  async keysStillReferenced(websiteId: string, keys: string[], excludingHashes: string[]): Promise<string[]> {
    const out = new Set<string>();
    for (const r of this.rows.values()) {
      if (r.websiteId === websiteId && r.storageKey && keys.includes(r.storageKey) && !excludingHashes.includes(r.urlHash)) out.add(r.storageKey);
    }
    return [...out];
  }

  async deleteRows(websiteId: string, urlHashes: string[]): Promise<number> {
    let n = 0;
    for (const h of urlHashes) if (this.rows.delete(this.k(websiteId, h))) n++;
    return n;
  }

  async backfillCursor(): Promise<BackfillCursor | null> {
    return this.cursor && !this.cursor.completed ? { ...this.cursor } : null;
  }

  async backfillSessions(c: BackfillCursor, limit: number): Promise<BackfillSession[]> {
    const key = (s: { startedAt: Date; websiteId: string; sessionId: string }) =>
      [s.startedAt.getTime(), s.websiteId, s.sessionId] as const;
    const before = (a: readonly [number, string, string], b: readonly [number, string, string]) =>
      a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
    const cur = [c.cursorTs.getTime(), c.cursorWebsiteId, c.cursorSessionId] as const;
    return this.sessions
      .filter((s) => s.startedAt >= c.floorTs && before(key(s), cur))
      .sort((a, b) => (before(key(a), key(b)) ? 1 : -1))
      .slice(0, limit);
  }

  async advanceBackfill(last: BackfillSession | null, scanned: number): Promise<void> {
    if (!this.cursor) return;
    this.cursor.scanned += scanned;
    if (!last) {
      this.cursor.completed = true;
      return;
    }
    Object.assign(this.cursor, { cursorTs: last.startedAt, cursorWebsiteId: last.websiteId, cursorSessionId: last.sessionId });
  }
}
