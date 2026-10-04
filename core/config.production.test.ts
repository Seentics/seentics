import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { env } from "./config";

const keys = [
  "DATABASE_URL", "ENVIRONMENT", "NODE_ENV", "JWT_SECRET", "GLOBAL_API_KEY",
  "CORS_ALLOWED_ORIGINS", "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "CORE_ROLE",
] as const;
const saved = new Map<string, string | undefined>();

function validProductionEnvironment() {
  process.env.DATABASE_URL = "postgres://seentics:password@postgres:5432/seentics?sslmode=disable";
  process.env.ENVIRONMENT = "PrOdUcTiOn";
  process.env.JWT_SECRET = "a".repeat(48);
  process.env.GLOBAL_API_KEY = "b".repeat(48);
  process.env.CORS_ALLOWED_ORIGINS = "https://analytics.example.test";
  process.env.S3_ENDPOINT = "http://minio:9000";
  process.env.S3_PUBLIC_ENDPOINT = "https://storage.example.test";
  process.env.AWS_ACCESS_KEY_ID = "seentics";
  process.env.AWS_SECRET_ACCESS_KEY = "c".repeat(48);
}

describe("production configuration", () => {
  beforeEach(() => {
    for (const key of keys) saved.set(key, process.env[key]);
    validProductionEnvironment();
  });

  afterEach(() => {
    for (const key of keys) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("runs every role in one process unless CORE_ROLE splits them", () => {
    delete process.env.CORE_ROLE;
    expect(env().role).toBe("all");
    process.env.CORE_ROLE = " Worker ";
    expect(env().role).toBe("worker");
    process.env.CORE_ROLE = "api";
    expect(env().role).toBe("api");
    process.env.CORE_ROLE = "both";
    expect(() => env()).toThrow("CORE_ROLE");
  });

  it("normalizes the environment name and accepts explicit, secure settings", () => {
    const config = env();
    expect(config.isProduction).toBe(true);
    expect(config.environment).toBe("production");
  });

  it("refuses a placeholder JWT secret before the server starts", () => {
    process.env.JWT_SECRET = "your-super-secret-jwt-key-change-this-in-production";
    expect(() => env()).toThrow("JWT_SECRET must be a unique value");
  });

  it("refuses wildcard dashboard CORS in production", () => {
    process.env.CORS_ALLOWED_ORIGINS = "*";
    expect(() => env()).toThrow("CORS_ALLOWED_ORIGINS must list explicit dashboard origins");
  });

  it("requires browser-reachable TLS object storage for replay and heatmap artifacts", () => {
    process.env.S3_PUBLIC_ENDPOINT = "http://storage.example.test";
    expect(() => env()).toThrow("S3_PUBLIC_ENDPOINT must be an https URL");
  });
});
