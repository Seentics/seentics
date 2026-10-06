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
/** Rows across one whole export (all collections, all sites). */
const EXPORT_TOTAL_ROW_LIMIT = Math.max(EXPORT_ROW_LIMIT, Number(process.env.PRIVACY_EXPORT_MAX_TOTAL_ROWS) || 250_000);

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

/**
 * Rows held across one whole export. Each collection was capped on its own, but an account with
 * several sites ran all of them at once: seven queries of up to 100,000 rows per site, every row
 * in memory until the response was built — enough to take the API process down.
 */
class ExportBudget {
  private used = 0;
  constructor(private readonly limit: number) {}
  spend(name: string, rows: number): void {
    this.used += rows;
    if (this.used > this.limit) {
      const error = new Error(`export exceeds ${this.limit} rows in ${name}; request a managed export`);
      (error as Error & { status: number }).status = 413;
      throw error;
    }
  }
}

async function exportWebsite(website: Website, budget = new ExportBudget(EXPORT_TOTAL_ROW_LIMIT)) {
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
  for (const [name, rows] of Object.entries(collections)) budget.spend(name, rows.length);
  return { website, ...collections };
}

/**
 * Erase every piece of data a website collected. Stored objects first, then the
 * relational delete, atomically.
 *
 * Also what deleting a website runs (passed to the websites module in app/bootstrap.ts):
 * deleting one used to remove its events, automations, funnels and goals only, and
 * leave its recordings — rows and stored files — heatmaps, visitor profiles, errors,
 * automation runs and AI history behind, with nothing left that could find them.
 */
export async function eraseWebsiteAnalytics(websiteId: string): Promise<void> {
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
    // What the rollup builder derived from those events: orders always (db/sql/039), the
    // dashboard rollups where the `hll` extension created them (db/sql/031).
    await tx`DELETE FROM analytics_revenue_orders WHERE website_id = ${websiteId}`;
    const [rollups] = await tx<{ ok: boolean }[]>`SELECT to_regclass('analytics_rollup_daily') IS NOT NULL AS ok`;
    if (rollups?.ok) {
      await tx`DELETE FROM analytics_rollup_daily WHERE website_id = ${websiteId}`;
      await tx`DELETE FROM analytics_rollup_hourly WHERE website_id = ${websiteId}`;
      await tx`DELETE FROM analytics_rollup_sessions WHERE website_id = ${websiteId}`;
      await tx`DELETE FROM analytics_rollup_visitor_first_seen WHERE website_id = ${websiteId}`;
      await tx`DELETE FROM analytics_rollup_stale WHERE website_id = ${websiteId}`;
    }
    await tx`DELETE FROM session_replays WHERE website_id = ${websiteId}`;
    await tx`DELETE FROM heatmap_points WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM heatmap_page_snapshots WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM user_profiles WHERE website_id = ${websiteId}::uuid`;
    // Each of these also holds a visitor's id or what they did, and erasure used to
    // leave them behind: the links from anonymous ids to the site's user ids, reported
    // errors with their visitor and session, AI Mode history quoting the analytics, and
    // webhook delivery logs.
    await tx`DELETE FROM identity_aliases WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM error_events WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM error_groups WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM ai_queries WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM webhook_deliveries WHERE automation_id IN (SELECT id FROM automations WHERE website_id = ${websiteId}::uuid)`;
    await tx`DELETE FROM automation_impressions WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM automation_events WHERE automation_id IN (SELECT id FROM automations WHERE website_id = ${websiteId}::uuid)`;
    await tx`DELETE FROM automations WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM funnels WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM goals WHERE website_id = ${websiteId}::uuid`;
    await tx`DELETE FROM api_keys WHERE website_id = ${websiteId}::uuid`;
  });
}

r.get("/export/:user_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  if ((c.req.param("user_id") ?? "") !== userId) return c.json({ error: "forbidden" }, 403);
  const websites = await sql<Website[]>`SELECT id::text, name, url, created_at FROM websites WHERE user_id = ${userId}::uuid ORDER BY created_at`;
  try {
    // One site at a time, against one budget for the whole account.
    const budget = new ExportBudget(EXPORT_TOTAL_ROW_LIMIT);
    const exported = [];
    for (const website of websites) exported.push(await exportWebsite(website, budget));
    return c.json({ success: true, data: { exportedAt: new Date().toISOString(), websites: exported } });
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

// ─── One visitor: data subject requests ─────────────────────────────────────
//
// A visitor asking for their data, or for it to be erased (GDPR Art. 15 and 17), is
// identified by the site the way the site knows them: the visitor id the tracker gave
// them (`seentics.visitorId`, also on every event), or the user id the site passed to
// `identify()` — which reaches every anonymous id that user was linked to.
//
// Visitors who never consented have no id that leads back to them (a daily hash, its
// salt deleted), so there is nothing of theirs to find; that is by design.

type VisitorRef = { visitorIds: string[]; sessionIds: string[] };

async function resolveVisitor(websiteId: string, visitorId: string, userId: string): Promise<VisitorRef> {
  const ids = new Set<string>(visitorId ? [visitorId] : []);
  if (userId) {
    // Every place a user id is tied to a visitor: the identify() calls themselves, and
    // the profile and alias rows built from them.
    const linked = await sql<{ id: string }[]>`
      SELECT DISTINCT visitor_id AS id FROM analytics_events
        WHERE website_id = ${websiteId} AND event_type = 'identify' AND properties->>'user_id' = ${userId}
      UNION SELECT anonymous_id FROM identity_aliases WHERE website_id = ${websiteId}::uuid AND user_id = ${userId}
      UNION SELECT anonymous_id FROM user_profiles WHERE website_id = ${websiteId}::uuid AND user_id = ${userId}
    `;
    for (const row of linked) ids.add(row.id);
  }
  const visitorIds = [...ids];
  if (!visitorIds.length) return { visitorIds, sessionIds: [] };
  const sessions = await sql<{ id: string }[]>`
    SELECT DISTINCT session_id AS id FROM analytics_events WHERE website_id = ${websiteId} AND visitor_id = ANY(${visitorIds}) AND session_id IS NOT NULL
    UNION SELECT DISTINCT session_id FROM error_events WHERE website_id = ${websiteId}::uuid AND visitor_id = ANY(${visitorIds}) AND session_id IS NOT NULL
  `;
  return { visitorIds, sessionIds: sessions.map((row) => row.id) };
}

function visitorQuery(c: Context): { visitorId: string; userId: string } | null {
  const visitorId = (c.req.query("visitor_id") ?? "").trim();
  const userId = (c.req.query("user_id") ?? "").trim();
  if (!visitorId && !userId) return null;
  if (visitorId.length > 200 || userId.length > 200) return null;
  return { visitorId, userId };
}

async function exportVisitor(websiteId: string, ref: VisitorRef, userId: string) {
  const { visitorIds: v, sessionIds: s } = ref;
  const [events, recordings, profiles, aliases, errors, automationRuns, impressions] = await Promise.all([
    sql`SELECT * FROM analytics_events WHERE website_id = ${websiteId} AND visitor_id = ANY(${v}) ORDER BY occurred_at LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT session_id, entry_page, timestamp, pages_viewed, duration_seconds, browser, device, os, country FROM session_replays WHERE website_id = ${websiteId} AND session_id = ANY(${s}) AND sequence = 0`,
    sql`SELECT * FROM user_profiles WHERE website_id = ${websiteId}::uuid AND (anonymous_id = ANY(${v}) OR (${userId} <> '' AND user_id = ${userId}))`,
    sql`SELECT * FROM identity_aliases WHERE website_id = ${websiteId}::uuid AND (anonymous_id = ANY(${v}) OR (${userId} <> '' AND user_id = ${userId}))`,
    sql`SELECT * FROM error_events WHERE website_id = ${websiteId}::uuid AND visitor_id = ANY(${v}) ORDER BY occurred_at LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT ae.* FROM automation_events ae JOIN automations a ON a.id = ae.automation_id WHERE a.website_id = ${websiteId}::uuid AND ae.visitor_id = ANY(${v}) ORDER BY ae.created_at LIMIT ${EXPORT_ROW_LIMIT + 1}`,
    sql`SELECT * FROM automation_impressions WHERE website_id = ${websiteId}::uuid AND (anonymous_id = ANY(${v}) OR (${userId} <> '' AND user_id = ${userId}))`,
  ]);
  return { visitorIds: v, events, recordings, profiles, aliases, errors, automationRuns, impressions };
}

async function eraseVisitor(websiteId: string, ref: VisitorRef, userId: string): Promise<void> {
  const cfg = env();
  const { visitorIds: v, sessionIds: s } = ref;
  // Recording files first: a database row pointing at a deleted file is harmless, a
  // file whose row is gone is a recording nothing can find to delete any more.
  const recorded = await sql<{ session_id: string }[]>`SELECT DISTINCT session_id FROM session_replays WHERE website_id = ${websiteId} AND session_id = ANY(${s})`;
  for (const row of recorded) await deleteSessionPrefix(cfg.s3.bucket, websiteId, row.session_id);

  await sql.begin(async (tx) => {
    // One id per statement, not `= ANY(...)`: on TimescaleDB's compressed days
    // (db/sql/037) only a plain equality lets it open just the batches that can hold the
    // visitor; with ANY it decompresses the site's whole history (measured: 1.9M rows,
    // past its safety limit, failed). The limit is lifted for this transaction since an
    // erasure must complete; elsewhere the setting is an unused placeholder.
    await tx`SET LOCAL timescaledb.max_tuples_decompressed_per_dml_transaction = 0`;
    for (const id of v) {
      await tx`DELETE FROM analytics_events WHERE website_id = ${websiteId} AND visitor_id = ${id}`;
    }
    await tx`DELETE FROM session_replays WHERE website_id = ${websiteId} AND session_id = ANY(${s})`;
    await tx`DELETE FROM error_events WHERE website_id = ${websiteId}::uuid AND visitor_id = ANY(${v})`;
    await tx`DELETE FROM automation_events AS ae USING automations AS a WHERE ae.automation_id = a.id AND a.website_id = ${websiteId}::uuid AND ae.visitor_id = ANY(${v})`;
    await tx`DELETE FROM automation_impressions WHERE website_id = ${websiteId}::uuid AND (anonymous_id = ANY(${v}) OR (${userId} <> '' AND user_id = ${userId}))`;
    await tx`DELETE FROM user_profiles WHERE website_id = ${websiteId}::uuid AND (anonymous_id = ANY(${v}) OR (${userId} <> '' AND user_id = ${userId}))`;
    await tx`DELETE FROM identity_aliases WHERE website_id = ${websiteId}::uuid AND (anonymous_id = ANY(${v}) OR (${userId} <> '' AND user_id = ${userId}))`;
    // The rollups' per-session rows (last three days, rollups/builder.ts) carry session
    // and visitor ids. The table exists only where the `hll` extension does (db/sql/031).
    const [rollups] = await tx<{ ok: boolean }[]>`SELECT to_regclass('analytics_rollup_sessions') IS NOT NULL AS ok`;
    if (rollups?.ok) {
      await tx`DELETE FROM analytics_rollup_sessions WHERE website_id = ${websiteId} AND (session_id = ANY(${s}) OR visitor_key = ANY(${v}))`;
    }
    // Their orders (db/sql/039), kept for the revenue dashboard past the raw window.
    await tx`DELETE FROM analytics_revenue_orders WHERE website_id = ${websiteId} AND visitor_key = ANY(${v})`;
  });
}

/** Export everything held about one visitor of one website (Art. 15 / 20). */
r.get("/visitor/:website_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  const website = await requireWebsite(c, c.req.param("website_id") ?? "", userId);
  if (website instanceof Response) return website;
  const who = visitorQuery(c);
  if (!who) return c.json({ error: "visitor_id or user_id is required" }, 400);
  const ref = await resolveVisitor(website.id, who.visitorId, who.userId);
  if (!ref.visitorIds.length) return c.json({ success: true, data: { found: false } });
  return c.json({ success: true, data: { found: true, exportedAt: new Date().toISOString(), ...(await exportVisitor(website.id, ref, who.userId)) } });
});

/** Erase everything held about one visitor of one website (Art. 17). */
r.delete("/visitor/:website_id", async (c) => {
  const userId = user(c);
  if (userId instanceof Response) return userId;
  const website = await requireWebsite(c, c.req.param("website_id") ?? "", userId);
  if (website instanceof Response) return website;
  const who = visitorQuery(c);
  if (!who) return c.json({ error: "visitor_id or user_id is required" }, 400);
  const ref = await resolveVisitor(website.id, who.visitorId, who.userId);
  if (!ref.visitorIds.length) return c.json({ success: true, data: { found: false, erased: false } });
  try {
    await eraseVisitor(website.id, ref, who.userId);
    return c.json({ success: true, data: { found: true, erased: true, visitorIds: ref.visitorIds.length, sessions: ref.sessionIds.length } });
  } catch {
    return c.json({ error: "Could not complete the erasure safely; retry the request" }, 503);
  }
});

export const privacyRoutes = r;
