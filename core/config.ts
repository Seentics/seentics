function parseBool(v: string | undefined, defaultTrue: boolean): boolean {
  if (v == null || v === "") return defaultTrue;
  const x = v.toLowerCase();
  if (x === "0" || x === "false" || x === "no") return false;
  if (x === "1" || x === "true" || x === "yes") return true;
  return defaultTrue;
}

function parseIntEnv(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export type AppConfig = ReturnType<typeof env>;

export function env() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const jwtSecret = process.env.JWT_SECRET ?? "";
  const globalApiKey = process.env.GLOBAL_API_KEY ?? "";
  const environment = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  const isProduction = environment === "production";

  const bucket = process.env.S3_BUCKET_REPLAYS ?? process.env.S3_BUCKET ?? "seentics-replays";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.AWS_ACCESS_KEY_ID ?? "";
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY ?? "";

  const presignTtlSec = Number(
    process.env.HEATMAP_PRESIGN_TTL_SECONDS ??
      process.env.REPLAY_PRESIGN_TTL_SECONDS ??
      "3600",
  );
  const spoolIdleMs = Number(process.env.REPLAY_SPOOL_IDLE_MS ?? "60000");
  const spoolMaxAgeMs = Number(process.env.REPLAY_SPOOL_MAX_AGE_MS ?? String(30 * 60 * 1000));

  const corsAllowedOrigins =
    process.env.CORS_ALLOWED_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000,https://www.seentics.com,https://seentics.com";

  const rateLimitEnabled = parseBool(process.env.RATE_LIMIT_ENABLED, true);
  const rateWindowMs = parseIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const rateGeneral = parseIntEnv(process.env.RATE_LIMIT_GENERAL_MAX, isProduction ? 300 : 2000);
  const rateAuth = parseIntEnv(process.env.RATE_LIMIT_AUTH_MAX, 20);
  const rateTracker = parseIntEnv(
    process.env.RATE_LIMIT_TRACKER_MAX,
    isProduction ? 120 : 50_000,
  );
  const rateInternal = parseIntEnv(process.env.RATE_LIMIT_INTERNAL_MAX, 2000);

  const analyticsCacheEnabled = parseBool(process.env.ANALYTICS_CACHE_ENABLED, true);
  const analyticsCacheTtlMs = parseIntEnv(process.env.ANALYTICS_CACHE_TTL_MS, 15_000);
  const analyticsCacheMaxEntries = parseIntEnv(process.env.ANALYTICS_CACHE_MAX_ENTRIES, 512);

  const logLevel = (process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug")).toLowerCase();

  return {
    databaseUrl,
    jwtSecret,
    globalApiKey,
    environment,
    isProduction,
    s3: { bucket, region, endpoint, accessKey, secretKey },
    presignTtlMs: Math.max(60, presignTtlSec) * 1000,
    spoolIdleMs,
    spoolMaxAgeMs,
    port: Number(process.env.PORT ?? "8080"),
    trustProxy: parseBool(process.env.TRUST_PROXY, false),
    corsAllowedOrigins,
    logLevel,
    rateLimit: {
      enabled: rateLimitEnabled,
      windowMs: rateWindowMs,
      generalMax: rateGeneral,
      authMax: rateAuth,
      trackerMax: rateTracker,
      internalMax: rateInternal,
    },
    analyticsCache: {
      enabled: analyticsCacheEnabled,
      ttlMs: analyticsCacheTtlMs,
      maxEntries: analyticsCacheMaxEntries,
    },
  };
}
