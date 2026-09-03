import type { AppConfig } from "../../../config";

/**
 * A complete `AppConfig` for tests that stub the config module.
 *
 * Three test files install `mock.module(".../config", …)`, and Bun applies a module mock
 * to the **entire run** — so whichever one loads first becomes `config` for every file
 * after it, including files that never mention config. A stub carrying only the keys its
 * own file reads therefore breaks somebody else: an incomplete one shipped a
 * `JWT_SECRET is required` failure into the auth tests, from a stub installed by the
 * recordings suite.
 *
 * Hence one base here, spread by all three. A field added to `AppConfig` and needed by a
 * test gets a default in this file, once, rather than in three stubs that drift apart.
 *
 * The values are inert on purpose: no real database URL, flush timers long enough that
 * nothing fires mid-test, and rate limiting off.
 */
export function testConfig(overrides: Record<string, unknown> = {}): AppConfig {
  return {
    databaseUrl: "postgres://test-not-connected",
    jwtSecret: "test-secret-value-that-is-long-enough-for-hs256",
    globalApiKey: "",
    environment: "development",
    isProduction: false,
    trustProxy: false,
    diagnosticLog: false,
    rateLimit: { enabled: false, rawPerKeyMax: 0, windowMs: 60_000 },
    s3: { bucket: "test-bucket" },
    // Long enough that no background flush fires while a test is running.
    replayChunkFlushMs: 600_000,
    spoolIdleMs: 600_000,
    presignTtlMs: 60_000,
    ...overrides,
  } as AppConfig;
}
