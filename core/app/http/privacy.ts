import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../../db";
import { env } from "../../config";
import { deleteS3Objects, deleteSessionPrefix } from "../../platform/storage/s3";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPORT_ROW_LIMIT = Math.max(1_000, Number(process.env.PRIVACY_EXPORT_MAX_ROWS) || 100_000);

type Website = { id: string; name: string; url: string; created_at: Date };

function user(c: Context<{ Variables: AuthVars }>): string | Response {
  const id = requireUser(c);
  return id ?? c.json({ error: "unauthorized" }, 401);
}

async function ownedWebsite(websiteId: string, userId: string): Promise<Website | null> {
  if (!UUID_RE.test(websiteId)) return null;
  const rows = await sql<Website[]>`
    SELECT id::text, name, url, created_at FROM websites
    WHERE id = ${websiteId}::uuid AND user_id = ${userId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function requireWebsite(c: Context<{ Variables: AuthVars }>, websiteId: string, userId: string): Promise<Website | Response> {
  const website = await ownedWebsite(websiteId, userId);
  return website ?? c.json({ error: "website not found" }, 404);
}

async function exportWebsite(website: Website) {
  const id = website.id;
  const [events, replays, heatmaps, profiles, goals, funnels, automations] = await Promise.all([
    sql`SELECT * FROM analytics_events WHERE website_id = ${id} ORDER BY occurred_at LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM session_replays WHERE website_id = ${id} ORDER BY timestamp, sequence LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM heatmap_points WHERE website_id = ${id}::uuid LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM user_profiles WHERE website_id = ${id}::uuid LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM goals WHERE website_id = ${id}::uuid LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM funnels WHERE website_id = ${id}::uuid LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM automations WHERE website_id = ${id}::uuid LIMIT ${EXPORT_ROW_LIMIT + 1}`,
  ]);
  const collections = { events, replays, heatmaps, profiles, goals, funnels, automations };
  for (const [name, rows] of Object.entries(collections)) {
    if (rows.length > EXPORT_ROW_LIMIT) {
      const error = new Error(`${name} export exceeds ${EXPORT_ROW_LIMIT} rows; request a managed export`);
      (error as Error & { status: number }).status = 413;
      throw error;
    }
  }
  return { website, ...collections };
}

/** Remove stored objects first, then make the relational delete atomic. */
async function eraseWebsiteAnalytics(websiteId: string): Promise<void> {
  const cfg = env();
  const [sessions, snapshots] = await Promise.all([
    sql<{ session_id: string }[]>`SELECT DISTINCT session_id FROM session_replays WHERE website_id = ${websiteId} AND sequence = 0`,
    sql<{ s3_key: string; html_s3_key: string | null }[]>`SELECT s3_key, html_s3_key FROM heatmap_page_snapshots WHERE website_id = ${websiteId}::uuid`,
  ]);
  for (const row of sessions) await deleteSessionPrefix(cfg.s3.bucket, websiteId, row.session_id);
  const keys = snapshots.flatMap((row) => [row.s3_key, row.html_s3_key]).filter((key): key is string => Boolean(key));
  if (keys.length) await deleteS3Objects(cfg.s3.bucket, keys);

  await sql.begin(async (tx) => {
    await tx`DELETE FROM analytics_events WHERE website_id = ${websiteId}`;
    await tx`DELETE FROM session_replays WHERE website_id = ${websiteId}`;
    await tx`DELETE FROM heatmap_points WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM heatmap_page_snapshots WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM user_profiles WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM automation_impressions WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM automation_events WHERE automation_id IN (SELECT id FROM automations WHERE website_id = ${websiteId}::uuid)`;
    await tx`DELETE FROM automations WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM funnels WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM goals WHERE website_id = ${websiteId}::uuid`;
  });
}

r.get("/export/:user_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  if ((c.req.param("user_id") ?? "") !== userId) return c.json({ error: "forbidden" }, 403);
  const websites = await sql<Website[]>`SELECT id::text, name, url, created_at FROM websites WHERE user_id = ${userId}::uuid ORDER BY created_at`;
  try {
    return c.json({ success: true, data: { exportedAt: new Date().toISOString(), websites: await Promise.all(websites.map(exportWebsite)) } });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return c.json({ error: error instanceof Error ? error.message : "export failed" }, status as 413);
  }
});

r.get("/export/website/:website_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  const website = await requireWebsite(c, c.req.param("website_id") ?? "", userId);
  if (website instanceof Response) return website;
  try {
    return c.json({ success: true, data: await exportWebsite(website) });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return c.json({ error: error instanceof Error ? error.message : "export failed" }, status as 413);
  }
});

r.delete("/delete/website/:website_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  const website = await requireWebsite(c, c.req.param("website_id") ?? "", userId);
  if (website instanceof Response) return website;
  try {
    await eraseWebsiteAnalytics(website.id);
    return c.json({ success: true, message: "Website analytics data erased" });
  } catch {
    return c.json({ error: "Could not complete data erasure safely; retry the request" }, 503);
  }
});

r.delete("/delete/:user_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  if ((c.req.param("user_id") ?? "") !== userId) return c.json({ error: "forbidden" }, 403);
  const websites = await sql<{ id: string }[]>`SELECT id::text FROM websites WHERE user_id = ${userId}::uuid`;
  try {
    for (const website of websites) await eraseWebsiteAnalytics(website.id);
    return c.json({ success: true, message: "Analytics data erased" });
  } catch {
    return c.json({ error: "Could not complete data erasure safely; retry the request" }, 503);
  }
});

// Do not accept untrusted bulk imports. Erasure is the safe irreversible privacy operation.
r.post("/import/:website_id", (c) => c.json({ error: "Data import is not supported; create a new website instead" }, 405));
r.put("/anonymize/:user_id", (c) => c.json({ error: "Use data erasure for an irreversible privacy request" }, 405));

r.get("/retention-policies", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  const cfg = env();
  const data = await sql`SELECT site_id AS "websiteId", data_retention_days AS "dataRetentionDays" FROM website_privacy_settings WHERE user_id = ${userId}::uuid`;
  return c.json({ success: true, data, defaults: { analyticsDays: cfg.dataRetention.analyticsDays, replayDays: cfg.dataRetention.replayDays, heatmapDays: cfg.dataRetention.heatmapDays } });
});

r.post("/cleanup", (c) => c.json({ error: "Retention cleanup runs on the configured schedule" }, 409));

export const privacyRoutes = r;
