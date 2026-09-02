import { mock } from "bun:test";

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

mock.module("../../../../config", () => ({
  env: () => ({
    s3: { bucket: "test-bucket" },
    // Long enough that no background flush fires while a test is running.
    replayChunkFlushMs: 600_000,
    spoolIdleMs: 600_000,
    presignTtlMs: 60_000,
  }),
}));

// ─── object storage ───────────────────────────────────────────────────────────

/** Chunks handed to `uploadSessionChunkGzip`, in call order. */
export const uploads: { sessionId: string; sequence: number; count: number }[] = [];

/** Session ids passed to `deleteSessionPrefix`, in call order. */
export const prefixDeletes: string[] = [];

/** Session ids whose `deleteSessionPrefix` should throw. */
export const s3DeleteFailures = new Set<string>();

/** Chunk rows `listSessionReplayChunks` returns, keyed by session id. */
export const storedChunks = new Map<string, { sequence: number; key: string }[]>();

mock.module("../../../../platform/lib/s3", () => ({
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
    if (s3DeleteFailures.has(sessionId)) throw new Error("storage unreachable");
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
  s3DeleteFailures.clear();
  storedChunks.clear();
}
