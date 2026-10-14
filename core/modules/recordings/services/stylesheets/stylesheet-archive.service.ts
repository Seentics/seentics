import { createHash } from "node:crypto";
import { MemoryCache } from "../../../../platform/cache/memory-cache";
import { log as baseLog } from "../../../../platform/observability/logger";
import { safeFetch, type SafeFetchResult } from "../../../../platform/http/safe-fetch";
import { scopedTokenSecret, signScopedToken, verifyScopedToken } from "../../../../platform/security/scoped-token";
import { stylesheetObjectKey } from "../../../../platform/storage/s3-keys";
import type {
  StylesheetArchive,
  StylesheetArchiveRunStats,
  StylesheetServeResult,
} from "../../interfaces";
import type { BackfillSession, StylesheetStore } from "../../repositories/stylesheet.repository";
import { absolutizeCssUrls, looksLikeCss } from "./css-rewrite";
import { e2eLocalStylesheetFetcher } from "./e2e-local-fetch";
import {
  absoluteStylesheetUrl,
  MAX_STYLESHEETS_PER_SCAN,
  stylesheetUrlsFromHtml,
  stylesheetUrlsFromReplayEvents,
} from "./stylesheet-hrefs";

const log = baseLog.child({ category: "replay_stylesheets" });

/** The token scope: a stylesheet token reads stylesheets and nothing else. */
const TOKEN_SCOPE = "replay-stylesheet";
const DAY_SECONDS = 86_400;

/**
 * How long a URL this process has already queued is not queued again. A recording takes a
 * full snapshot every minute, each linking the same stylesheets; without this every one
 * of them would cost an insert that changes nothing.
 */
const RECENTLY_QUEUED_TTL_MS = 60 * 60_000;

/** Website ids reach object keys; anything outside this shape is refused before that. */
const WEBSITE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type StylesheetArchiveConfig = {
  /** Rows claimed per run. */
  batch: number;
  /** Fetches in flight at once. */
  concurrency: number;
  /** Attempts before a transient failure becomes `failed`. */
  maxAttempts: number;
  /** Delay before attempt n+1, by n (1-based); the last value repeats. */
  retryDelaysMs: number[];
  /** A claimed row is handed back after this long if its worker died. */
  leaseSeconds: number;
  /** Pending rows one site may have; past it, discovery for that site waits. */
  maxPendingPerSite: number;
  /** Recordings scanned per run by the backfill. 0 turns it off. */
  backfillBatch: number;
  /** Chunks read per backfilled recording. */
  backfillMaxChunks: number;
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
  userAgent: string;
};

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0): number {
  const n = Number(env[key]);
  return Number.isFinite(n) && n >= min ? Math.trunc(n) : fallback;
}

export function readStylesheetArchiveConfig(env: NodeJS.ProcessEnv = process.env): StylesheetArchiveConfig {
  return {
    batch: envInt(env, "STYLESHEET_ARCHIVE_BATCH", 50, 1),
    concurrency: Math.min(16, envInt(env, "STYLESHEET_ARCHIVE_CONCURRENCY", 4, 1)),
    maxAttempts: 3,
    retryDelaysMs: [2 * 60_000, 30 * 60_000],
    leaseSeconds: 300,
    maxPendingPerSite: envInt(env, "STYLESHEET_ARCHIVE_MAX_PENDING_PER_SITE", 500, 1),
    backfillBatch: envInt(env, "STYLESHEET_BACKFILL_BATCH", 20, 0),
    backfillMaxChunks: envInt(env, "STYLESHEET_BACKFILL_MAX_CHUNKS", 40, 1),
    maxBytes: 3 * 1024 * 1024,
    timeoutMs: 8_000,
    maxRedirects: 3,
    userAgent: "SeenticsStylesheetArchiver/1.0 (+https://seentics.com/docs/privacy)",
  };
}

/** Object storage, as the archive sees it. */
export type StylesheetStorage = {
  put(key: string, css: string): Promise<void>;
  get(key: string): Promise<string>;
  /** Delete these objects; throws when the store cannot be reached. */
  delete(keys: string[]): Promise<void>;
};

/** A recording's stored rows, for the backfill: chunk-capped. `null` when nothing is stored. */
export type RecordingRowsLoader = (websiteId: string, sessionId: string, maxChunks: number) => Promise<unknown[] | null>;

export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/**
 * The stylesheet archive: discovery, the scheduled fetch, serving, and retention.
 *
 * State per (website, URL): `pending` until fetched, then `stored`, or one of the three
 * terminal failures — `failed` (404/410, refused by the SSRF guard, or still failing after
 * `maxAttempts`), `too_large` (past `maxBytes`) and `not_css` (an HTML error page, an
 * image). A transient failure stays `pending` with a later `next_attempt_at`.
 */
export class StylesheetArchiveService implements StylesheetArchive {
  private readonly fetcher: (url: string) => Promise<SafeFetchResult>;
  private readonly now: () => number;
  private readonly secret: () => string;
  private readonly recentlyQueued = new MemoryCache<true>(5_000);

  constructor(
    private readonly deps: {
      store: StylesheetStore;
      storage: StylesheetStorage;
      loadRecording: RecordingRowsLoader;
      config: StylesheetArchiveConfig;
      fetcher?: (url: string) => Promise<SafeFetchResult>;
      now?: () => number;
      secret?: () => string;
    },
  ) {
    const c = deps.config;
    const fetchOptions = {
      maxBytes: c.maxBytes,
      timeoutMs: c.timeoutMs,
      maxRedirects: c.maxRedirects,
      userAgent: c.userAgent,
      accept: "text/css,*/*;q=0.1",
    };
    this.fetcher =
      deps.fetcher ??
      // `null` everywhere but the disposable e2e stack; see e2e-local-fetch.ts.
      e2eLocalStylesheetFetcher(fetchOptions) ??
      ((url) => safeFetch(url, fetchOptions));
    this.now = deps.now ?? Date.now;
    this.secret = deps.secret ?? scopedTokenSecret;
  }

  // ─── Discovery ──────────────────────────────────────────────────────────────

  /** Queue absolute URLs for one site. Never throws: discovery must not fail its caller. */
  async discover(websiteId: string, urls: readonly string[]): Promise<number> {
    if (!WEBSITE_ID_RE.test(websiteId) || urls.length === 0) return 0;
    const entries = urls
      .slice(0, MAX_STYLESHEETS_PER_SCAN)
      .map((url) => ({ url, urlHash: urlHash(url) }))
      .filter((e) => !this.recentlyQueued.get(`${websiteId}:${e.urlHash}`));
    if (entries.length === 0) return 0;
    try {
      const inserted = await this.deps.store.enqueue(websiteId, entries, this.deps.config.maxPendingPerSite);
      for (const e of entries) this.recentlyQueued.set(`${websiteId}:${e.urlHash}`, true, RECENTLY_QUEUED_TTL_MS);
      return inserted;
    } catch (err) {
      log.warn({ msg: "stylesheet_discovery_failed", website_id: websiteId, err: String(err) });
      return 0;
    }
  }

  /** Stylesheets linked from replay events (envelopes or bare rrweb events). */
  discoverFromReplayEvents(websiteId: string, events: Iterable<unknown>): Promise<number> {
    let urls: string[];
    try {
      urls = stylesheetUrlsFromReplayEvents(events);
    } catch (err) {
      log.warn({ msg: "stylesheet_extract_failed", website_id: websiteId, err: String(err) });
      return Promise.resolve(0);
    }
    return this.discover(websiteId, urls);
  }

  async discoverFromHtml(websiteId: string, html: string, pageUrl: string): Promise<void> {
    let urls: string[];
    try {
      urls = stylesheetUrlsFromHtml(html, pageUrl);
    } catch (err) {
      log.warn({ msg: "stylesheet_extract_failed", website_id: websiteId, err: String(err) });
      return;
    }
    await this.discover(websiteId, urls);
  }

  // ─── Access ─────────────────────────────────────────────────────────────────

  /**
   * Valid until the end of the next UTC day: between 24 and 48 hours, and the same token —
   * so the same stylesheet URLs, which the browser caches — all day.
   */
  accessToken(websiteId: string): { token: string; expiresAt: string } {
    const nowSec = Math.floor(this.now() / 1000);
    const exp = (Math.floor(nowSec / DAY_SECONDS) + 2) * DAY_SECONDS;
    return {
      token: signScopedToken(this.secret(), TOKEN_SCOPE, websiteId, exp),
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  // ─── Serving ────────────────────────────────────────────────────────────────

  async serve(websiteId: string, url: string, token: string | undefined): Promise<StylesheetServeResult> {
    if (!WEBSITE_ID_RE.test(websiteId)) return { kind: "not_found" };
    if (!verifyScopedToken(this.secret(), TOKEN_SCOPE, websiteId, token, Math.floor(this.now() / 1000))) {
      return { kind: "forbidden" };
    }
    // The URL is normalised the same way discovery normalised it, so it hashes the same.
    const absolute = absoluteStylesheetUrl(url, undefined);
    if (!absolute) return { kind: "not_found" };
    const hash = urlHash(absolute);

    let row = null;
    try {
      row = await this.deps.store.get(websiteId, hash);
    } catch (err) {
      log.warn({ msg: "stylesheet_lookup_failed", website_id: websiteId, err: String(err) });
    }

    // The key is derived from this site's own row, so another site's object is unreachable.
    if (row?.status === "stored" && row.storageKey?.startsWith(`stylesheets/${websiteId}/`)) {
      try {
        return { kind: "css", body: await this.deps.storage.get(row.storageKey) };
      } catch (err) {
        log.warn({ msg: "stylesheet_read_failed", website_id: websiteId, key: row.storageKey, err: String(err) });
      }
    }

    // Only a URL this site's own recordings or snapshots linked to is redirected to, and to the
    // address stored at discovery, not the one in the request. The token is visible in public
    // embeds, so redirecting to any URL asked for would make this an open redirect on our domain.
    // Recordings from before the archive are covered by the backfill, which discovers their links.
    if (!row) return { kind: "not_found" };
    return { kind: "redirect", location: row.url };
  }

  // ─── The scheduled job ──────────────────────────────────────────────────────

  async runOnce(): Promise<StylesheetArchiveRunStats> {
    const stats: StylesheetArchiveRunStats = { claimed: 0, stored: 0, failed: 0, retried: 0, backfillSessions: 0, backfillQueued: 0 };
    await this.fetchDue(stats);
    await this.backfill(stats);
    return stats;
  }

  private async fetchDue(stats: StylesheetArchiveRunStats): Promise<void> {
    const c = this.deps.config;
    const claimed = await this.deps.store.claimDue(c.batch, c.leaseSeconds);
    stats.claimed = claimed.length;
    let next = 0;
    const worker = async () => {
      for (;;) {
        const row = claimed[next++];
        if (!row) return;
        try {
          const outcome = await this.archiveOne(row.websiteId, row.urlHash, row.url, row.attempts);
          stats[outcome] += 1;
        } catch (err) {
          // Storage or the database failed, not the site: the lease hands the row back.
          log.warn({ msg: "stylesheet_archive_error", website_id: row.websiteId, url: row.url, err: String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(c.concurrency, claimed.length) }, worker));
  }

  /** Fetch, check, rewrite and store one stylesheet, recording what happened. */
  private async archiveOne(
    websiteId: string,
    hash: string,
    url: string,
    previousAttempts: number,
  ): Promise<"stored" | "failed" | "retried"> {
    const store = this.deps.store;
    const attempts = previousAttempts + 1;
    const res = await this.fetcher(url);

    if (res.kind === "blocked") {
      await store.markFinal(websiteId, hash, "failed", attempts, `blocked: ${res.reason}`);
      return "failed";
    }
    if (res.kind === "too_large") {
      await store.markFinal(websiteId, hash, "too_large", attempts, "larger than the archive limit");
      return "failed";
    }
    if (res.kind === "http_error") {
      // 408 and 429 are the site asking us to come back; every other 4xx will not change.
      const transient = res.status >= 500 || res.status === 408 || res.status === 429;
      if (!transient) {
        await store.markFinal(websiteId, hash, "failed", attempts, `HTTP ${res.status}`);
        return "failed";
      }
      return this.retryOrFail(websiteId, hash, attempts, `HTTP ${res.status}`);
    }
    if (res.kind === "network_error") {
      return this.retryOrFail(websiteId, hash, attempts, res.reason);
    }

    const text = new TextDecoder("utf-8").decode(res.body);
    const type = res.contentType.split(";")[0]!.trim();
    const isCss = type === "text/css" || ((type === "" || type === "text/plain") && looksLikeCss(text));
    if (!isCss) {
      await store.markFinal(websiteId, hash, "not_css", attempts, `content-type ${type || "missing"}`);
      return "failed";
    }

    // Against the final URL: a redirect moves the base its relative references resolve from.
    const css = absolutizeCssUrls(text, res.url);
    const sha = createHash("sha256").update(css).digest("hex");
    const key = stylesheetObjectKey(websiteId, sha);
    if (!(await store.hasContent(websiteId, sha))) await this.deps.storage.put(key, css);
    await store.markStored(websiteId, hash, { storageKey: key, bytes: Buffer.byteLength(css), contentSha256: sha });
    return "stored";
  }

  private async retryOrFail(websiteId: string, hash: string, attempts: number, error: string): Promise<"failed" | "retried"> {
    const c = this.deps.config;
    if (attempts >= c.maxAttempts) {
      await this.deps.store.markFinal(websiteId, hash, "failed", attempts, error);
      return "failed";
    }
    const delays = c.retryDelaysMs;
    const delay = delays[Math.min(attempts - 1, delays.length - 1)] ?? 60_000;
    await this.deps.store.scheduleRetry(websiteId, hash, attempts, new Date(this.now() + delay), error);
    return "retried";
  }

  /**
   * Recordings made before ingest-time discovery existed, newest first, a few per run.
   * Newest first because those are the ones still likely to be watched — and whose
   * stylesheets are still likely to be on the site to fetch.
   */
  private async backfill(stats: StylesheetArchiveRunStats): Promise<void> {
    const c = this.deps.config;
    if (c.backfillBatch <= 0) return;
    const cursor = await this.deps.store.backfillCursor();
    if (!cursor) return;
    const sessions = await this.deps.store.backfillSessions(cursor, c.backfillBatch);

    let next = 0;
    const worker = async () => {
      for (;;) {
        const s = sessions[next++];
        if (!s) return;
        try {
          const rows = await this.deps.loadRecording(s.websiteId, s.sessionId, c.backfillMaxChunks);
          if (rows) stats.backfillQueued += await this.discoverFromReplayEvents(s.websiteId, rows);
        } catch (err) {
          // One unreadable recording must not hold the walk at the same place forever.
          log.warn({ msg: "stylesheet_backfill_session_failed", website_id: s.websiteId, session_id: s.sessionId, err: String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, sessions.length) }, worker));

    stats.backfillSessions = sessions.length;
    const last: BackfillSession | null = sessions.length < c.backfillBatch ? null : sessions[sessions.length - 1]!;
    await this.deps.store.advanceBackfill(last, sessions.length);
    if (!last) log.info({ msg: "stylesheet_backfill_complete" });
  }

  // ─── Retention ──────────────────────────────────────────────────────────────

  /**
   * Delete a site's stylesheets nothing has linked to since `before`.
   *
   * Objects first, rows second, and only the objects no surviving row shares (storage is
   * content-addressed): a row is the only pointer to its object, so it outlives a failed
   * delete and the next sweep retries.
   */
  async purgeUnseen(websiteId: string, before: Date, batchSize: number): Promise<{ rows: number; objects: number; failures: number }> {
    const totals = { rows: 0, objects: 0, failures: 0 };
    for (;;) {
      const aged = await this.deps.store.listUnseenSince(websiteId, before, batchSize);
      if (aged.length === 0) break;
      const hashes = aged.map((r) => r.urlHash);
      const keys = [...new Set(aged.map((r) => r.storageKey).filter((k): k is string => !!k))];
      const shared = new Set(await this.deps.store.keysStillReferenced(websiteId, keys, hashes));
      const orphaned = keys.filter((k) => !shared.has(k));
      try {
        if (orphaned.length > 0) await this.deps.storage.delete(orphaned);
      } catch (err) {
        totals.failures += 1;
        log.warn({ msg: "retention_stylesheet_delete_failed", website_id: websiteId, err: String(err) });
        break;
      }
      totals.objects += orphaned.length;
      totals.rows += await this.deps.store.deleteRows(websiteId, hashes);
      if (aged.length < batchSize) break;
    }
    return totals;
  }
}
