import { mock } from "bun:test";
import { testConfig } from "../../../../app/tests/helpers/test-config";

/**
 * The one place this module's tests stub shared infrastructure.
 *
 * `mock.module` is process-global in Bun, and a module binds its imports the first time
 * it is loaded. Two test files each registering their own stub for the same path is
 * therefore a race decided by file order: the first file's stub is what every module
 * under test actually sees, and the second file's is silently inert — or worse, the
 * first file's partial stub is missing an export the second file's subject needs, and
 * the failure surfaces as a `SyntaxError` in an unrelated test.
 *
 * So every stub lives here, registered once, complete, with the knobs each test needs.
 * Import this **before** importing anything under test.
 */

// ─── logger ───────────────────────────────────────────────────────────────────

/** Every `warn` payload emitted since the last `resetStubs()`. */
export const warnings: Record<string, unknown>[] = [];

/** Every `error` payload, for tests asserting a failure was reported rather than swallowed. */
export const errors: Record<string, unknown>[] = [];

mock.module("../../../../platform/lib/logger", () => {
  // Complete, not partial: this becomes the logger for every module the suite loads.
  const logger: Record<string, unknown> = {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock((fields: Record<string, unknown>) => {
      warnings.push(fields);
    }),
    error: mock((fields: Record<string, unknown>) => {
      errors.push(fields);
    }),
  };
  logger.child = () => logger;
  return { log: logger };
});

// ─── config ───────────────────────────────────────────────────────────────────

// Global to the whole run — see `testConfig` for why it must be complete.
mock.module("../../../../config", () => ({ env: () => testConfig() }));

// ─── object storage ───────────────────────────────────────────────────────────

/** Chunks handed to `uploadSessionChunkGzip`, in call order. */
export const uploads: { sessionId: string; sequence: number; count: number }[] = [];

/** Session ids passed to `deleteSessionPrefix`, in call order. */
export const prefixDeletes: string[] = [];

/** Session ids whose `deleteSessionPrefix` should throw. */
export const s3DeleteFailures = new Set<string>();

/**
 * Highest number of `deleteSessionPrefix` calls in flight at once.
 *
 * Retention clears object storage with bounded concurrency; this is how a test sees the
 * bound without reaching into the sweep. The stub yields before resolving so overlap is
 * observable at all — a stub that returns synchronously never has two in flight.
 */
export let maxConcurrentPrefixDeletes = 0;
let inFlightPrefixDeletes = 0;

/** Chunk rows `listSessionReplayChunks` returns, keyed by session id. */
export const storedChunks = new Map<string, { sequence: number; key: string }[]>();

/**
 * Every runtime export of `platform/lib/s3`, not just the ones the recordings tests call.
 *
 * `mock.module` applies to the whole run, so this stub *is* the s3 module for every file
 * loaded after it. Omitting `putJpeg` broke the heatmaps screenshot tests, which never
 * touch replays, with a `SyntaxError` naming the real file that does export it. Same
 * rule as `app/tests/helpers/test-config.ts`: a global stub has to be complete.
 */
mock.module("../../../../platform/lib/s3", () => ({
  s3: () => ({}),
  putHtml: async () => {},
  putJpeg: async () => {},
  deleteS3Objects: async () => {},
  getNextReplayChunkSequence: async () => 0,
  uploadSessionChunkGzip: async (
    _bucket: string,
    _websiteId: string,
    sessionId: string,
    sequence: number,
    events: unknown[],
  ) => {
    uploads.push({ sessionId, sequence, count: events.length });
  },
  deleteSessionPrefix: async (_bucket: string, _websiteId: string, sessionId: string) => {
    prefixDeletes.push(sessionId);
    inFlightPrefixDeletes += 1;
    maxConcurrentPrefixDeletes = Math.max(maxConcurrentPrefixDeletes, inFlightPrefixDeletes);
    try {
      // Yield, so concurrent callers actually overlap here rather than running to
      // completion one at a time.
      await new Promise((r) => setTimeout(r, 0));
      if (s3DeleteFailures.has(sessionId)) throw new Error("storage unreachable");
    } finally {
      inFlightPrefixDeletes -= 1;
    }
  },
  listSessionReplayChunks: async (_bucket: string, _websiteId: string, sessionId: string) =>
    storedChunks.get(sessionId) ?? [],
  presignGet: async (_bucket: string, key: string) => `https://signed.test/${key}`,
  locateBundle: async () => null,
  getJsonGzip: async () => [],
}));

// ─── reset ────────────────────────────────────────────────────────────────────

export function resetStubs(): void {
  warnings.length = 0;
  errors.length = 0;
  uploads.length = 0;
  prefixDeletes.length = 0;
  maxConcurrentPrefixDeletes = 0;
  inFlightPrefixDeletes = 0;
  s3DeleteFailures.clear();
  storedChunks.clear();
}
