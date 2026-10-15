/**
 * Preloaded before every integration test file (`bun run test:integration`).
 *
 * Points Core at a disposable Postgres (with `hll`) and S3-compatible store — started by
 * `scripts/test-integration.sh` — migrates the database once, and makes the buckets. The
 * heatmap bucket is deliberately separate from the replay bucket, so a test can tell
 * which one a file was written to or deleted from.
 */
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

const defaults: Record<string, string> = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://seentics:test@localhost:55432/seentics_test",
  ENVIRONMENT: "test",
  JWT_SECRET: "integration-test-jwt-secret-0123456789",
  GATEWAY_ONLY: "false",
  RATE_LIMIT_ENABLED: "false",
  TRUST_PROXY: "false",
  S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? "http://localhost:59000",
  S3_ACCESS_KEY: "test-key",
  S3_SECRET_KEY: "test-secret-key",
  S3_REGION: "auto",
  S3_BUCKET_REPLAYS: "it-replays",
  S3_BUCKET_HEATMAPS: "it-heatmaps",
  LOG_LEVEL: "error",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
  GOOGLE_API_KEY: "",
};
// DATABASE_URL always: a developer's own would otherwise be truncated by the suite.
process.env.DATABASE_URL = defaults.DATABASE_URL;
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
if (!/localhost|127\.0\.0\.1|postgres-test/.test(process.env.DATABASE_URL!)) {
  throw new Error(`Refusing to run the integration suite against a non-local database: ${process.env.DATABASE_URL}`);
}

const { runCoreMigrations } = await import("../db/migrate");
await runCoreMigrations(process.env.DATABASE_URL!);

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: "auto",
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
});
for (const Bucket of [process.env.S3_BUCKET_REPLAYS!, process.env.S3_BUCKET_HEATMAPS!]) {
  await s3.send(new CreateBucketCommand({ Bucket })).catch((e: { name?: string }) => {
    if (e?.name !== "BucketAlreadyOwnedByYou" && e?.name !== "BucketAlreadyExists") throw e;
  });
}
