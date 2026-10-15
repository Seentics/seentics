/**
 * The integration suite's toolkit: the real HTTP app over the test database, and seeds.
 *
 * Every test seeds its own users and sites with fresh ids, so files never depend on each
 * other's rows and in-process caches (roles, analytics responses) cannot leak between tests.
 * `resetDatabase()` is for a file that needs an empty table to count from.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config";
import { sql } from "../db";
import { bootstrap, type Application } from "../app/bootstrap";
import { createHttpApp } from "../app/http-app";
import { signAccessToken, signRefreshToken } from "../platform/security/auth-jwt";
import { log } from "../platform/observability/logger";

export { sql };

let built: { application: Application; app: ReturnType<typeof createHttpApp> } | null = null;

/** The composed application, built once per file. Background work (scheduler, flush timers) is not started. */
export function application(): Application {
  return (built ??= build()).application;
}

function build() {
  const application = bootstrap(env(), log);
  return { application, app: createHttpApp(env(), application, () => true) };
}

export type Session = { token?: string; headers?: Record<string, string> };

/** Call the API the way the dashboard does. A JSON body is serialised; a string is sent as is. */
export async function api(
  method: string,
  path: string,
  opts: Session & { body?: unknown; query?: Record<string, string | number | boolean> } = {},
): Promise<{ status: number; body: any; headers: Headers; text: string }> {
  built ??= build();
  const url = new URL(path, "http://core.test");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["Content-Type"] ??= "application/json";
  }
  const res = await built.app.request(url.pathname + url.search, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, body: parsed, headers: res.headers, text };
}

export type SeededUser = { id: string; email: string; password: string; token: string; refreshToken: string };

/** A user with a known password and a signed-in session. */
export async function seedUser(opts: { email?: string; password?: string; isActive?: boolean; role?: string } = {}): Promise<SeededUser> {
  const email = (opts.email ?? `u-${randomUUID().slice(0, 8)}@it.test`).toLowerCase();
  const password = opts.password ?? "correct horse battery";
  const hash = await bcrypt.hash(password, 4);
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, name, role, is_active)
    VALUES (${email}, ${hash}, 'Test User', ${opts.role ?? "user"}, ${opts.isActive ?? true})
    RETURNING id::text
  `;
  const id = row!.id;
  // The same stamp login would put in the refresh token (credential-authentication.service.ts).
  const { createHash } = await import("node:crypto");
  const stamp = createHash("sha256").update(hash).digest("base64url").slice(0, 16);
  return { id, email, password, token: await signAccessToken(id), refreshToken: await signRefreshToken(id, stamp) };
}

export type SeededWebsite = { id: string; trackingId: string; domain: string; ownerId: string };

/** A website owned by `ownerId`, on a domain of its own. */
export async function seedWebsite(ownerId: string, opts: { domain?: string; name?: string } = {}): Promise<SeededWebsite> {
  const domain = opts.domain ?? `site-${randomUUID().slice(0, 8)}.it.test`;
  const trackingId = `trk_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO websites (user_id, name, url, tracking_id, is_active, is_verified)
    VALUES (${ownerId}::uuid, ${opts.name ?? "Test site"}, ${`https://${domain}`}, ${trackingId}, true, true)
    RETURNING id::text
  `;
  return { id: row!.id, trackingId, domain, ownerId };
}

/** Add `userId` to a site with a role (viewer | member | admin). */
export async function addMember(websiteId: string, userId: string, role: "viewer" | "member" | "admin") {
  await sql`INSERT INTO website_members (website_id, user_id, role) VALUES (${websiteId}::uuid, ${userId}::uuid, ${role})`;
}

/** Empty every table the app owns (not the migration ledger). */
export async function resetDatabase(): Promise<void> {
  const tables = await sql<{ t: string }[]>`
    SELECT quote_ident(tablename) AS t FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'core_schema_migrations'
  `;
  if (tables.length) await sql.unsafe(`TRUNCATE ${tables.map((r) => r.t).join(", ")} RESTART IDENTITY CASCADE`);
}

// ─── Object storage ─────────────────────────────────────────────────────────

let s3client: S3Client | null = null;
function s3(): S3Client {
  const c = env().s3;
  return (s3client ??= new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: true,
    credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secretKey },
  }));
}

export const buckets = { replays: () => env().s3.bucket, heatmaps: () => env().s3.heatmapBucket };

export async function putObject(bucket: string, key: string, body = "x"): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function listKeys(bucket: string, prefix: string): Promise<string[]> {
  const out = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  return (out.Contents ?? []).map((o) => o.Key!).filter(Boolean);
}
