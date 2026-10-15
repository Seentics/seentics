import { afterAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { env } from "../config";
import { RetentionService } from "../app/services/retention/retention.service";
import type { RetentionCutoffs, RetentionPurge } from "../platform/retention";
import { application, buckets, objectExists, putObject, seedUser, seedWebsite, sql } from "./harness";

/*
 * Every purge here runs for one seeded website only: the database is shared with other
 * files, so a sweep over every site would delete their rows.
 */

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const dayOf = (n: number) => daysAgo(n).toISOString().slice(0, 10);

// General data older than 30 days goes; funnel and automation history is kept for 60.
const cutoffs: RetentionCutoffs = {
  analytics: daysAgo(30),
  funnelAutomation: daysAgo(60),
  replay: daysAgo(30),
  heatmap: daysAgo(30),
};
const options = () => ({ batchSize: 50, bucket: buckets.replays(), heatmapBucket: buckets.heatmaps() });

async function twoSites() {
  const owner = await seedUser();
  return { site: await seedWebsite(owner.id), other: await seedWebsite(owner.id), ownerId: owner.id };
}

const n = async (query: PromiseLike<readonly unknown[]>) => (await query).length;

async function seedEvent(websiteId: string, ageDays: number, eventType = "pageview") {
  const visitorId = `v-${randomUUID().slice(0, 8)}`;
  await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
            VALUES (${websiteId}, ${eventType}, '/', ${visitorId}, ${`s-${visitorId}`}, ${daysAgo(ageDays)})`;
  return visitorId;
}

describe("analytics retention", () => {
  const purge = () => application().modules.analytics.retention;

  it("deletes events older than the analytics cutoff and keeps newer ones", async () => {
    const { site } = await twoSites();
    const old = await seedEvent(site.id, 45);
    const fresh = await seedEvent(site.id, 5);

    const counts = await purge().purge({ websiteId: site.id }, cutoffs, options());

    const left = await sql<{ visitor_id: string }[]>`SELECT visitor_id FROM analytics_events WHERE website_id = ${site.id}`;
    expect(left.map((r) => r.visitor_id)).toEqual([fresh]);
    expect(left.map((r) => r.visitor_id)).not.toContain(old);
    expect(counts.analyticsGeneralRows).toBe(1);
  });

  it("keeps funnel steps on the longer funnel clock", async () => {
    // A 45-day-old funnel step is past the analytics cutoff but inside the funnel one.
    const { site } = await twoSites();
    await seedEvent(site.id, 45, "funnel_step");
    await seedEvent(site.id, 90, "funnel_complete");

    const counts = await purge().purge({ websiteId: site.id }, cutoffs, options());

    const left = await sql<{ event_type: string }[]>`SELECT event_type FROM analytics_events WHERE website_id = ${site.id}`;
    expect(left.map((r) => r.event_type)).toEqual(["funnel_step"]);
    expect(counts.analyticsFunnelRows).toBe(1);
  });

  it("drops the derived day rows (revenue orders, event counts) past the cutoff", async () => {
    const { site } = await twoSites();
    for (const [age, key] of [[45, "old"], [5, "new"]] as const) {
      await sql`INSERT INTO analytics_revenue_orders (website_id, day, kind, order_key, event_id, event_type, occurred_at, value, currency,
                  user_type, product_name, order_id, source, medium, campaign)
                VALUES (${site.id}, ${dayOf(age)}::date, 'order', ${key}, ${key}, 'purchase', ${daysAgo(age)}, 10, 'USD', 'new', '', ${key}, '', '', '')`;
      await sql`INSERT INTO analytics_event_counts (website_id, day, events) VALUES (${site.id}, ${dayOf(age)}::date, 3)`;
    }

    await purge().purge({ websiteId: site.id }, cutoffs, options());

    const orders = await sql<{ order_key: string }[]>`SELECT order_key FROM analytics_revenue_orders WHERE website_id = ${site.id}`;
    expect(orders.map((r) => r.order_key)).toEqual(["new"]);
    expect(await n(sql`SELECT 1 FROM analytics_event_counts WHERE website_id = ${site.id}`)).toBe(1);
  });

  it("touches only the website it is given", async () => {
    const { site, other } = await twoSites();
    await seedEvent(other.id, 45);
    await purge().purge({ websiteId: site.id }, cutoffs, options());
    expect(await n(sql`SELECT 1 FROM analytics_events WHERE website_id = ${other.id}`)).toBe(1);
  });
});

describe("heatmap retention", () => {
  const purge = () => application().modules.heatmaps.retention;

  it("deletes old points, old snapshots with their stored files, and unreferenced old page versions", async () => {
    const { site, other } = await twoSites();
    for (const [id, age] of [[site.id, 45], [site.id, 5], [other.id, 45]] as const) {
      await sql`INSERT INTO heatmap_points (website_id, page_path, event_type, device_type, x_percent, y_percent, day)
                VALUES (${id}::uuid, ${`/p${age}`}, 'click', 'desktop', 10, 10, ${dayOf(age)}::date)`;
    }
    const oldShot = `heatmaps/${site.id}/old.jpg`;
    const oldHtml = `heatmaps/${site.id}/old.html`;
    const newShot = `heatmaps/${site.id}/new.jpg`;
    const oldVariant = `heatmaps/${site.id}/old_v.html`;
    for (const key of [oldShot, oldHtml, newShot, oldVariant]) await putObject(buckets.heatmaps(), key);
    await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, updated_at)
              VALUES (${site.id}::uuid, '/old', ${oldShot}, ${oldHtml}, 'sha', 1200, 3000, ${daysAgo(45)}),
                     (${site.id}::uuid, '/new', ${newShot}, NULL, 'sha', 1200, 3000, ${daysAgo(5)})`;
    await sql`INSERT INTO heatmap_page_versions (website_id, page_path, dom_fingerprint, device_type, viewport_width, viewport_height, html_s3_key, content_sha256, last_seen_at)
              VALUES (${site.id}::uuid, '/old', 'fp-old', 'desktop', 1200, 800, ${oldVariant}, 'sha', ${daysAgo(45)}),
                     (${site.id}::uuid, '/new', 'fp-new', 'desktop', 1200, 800, NULL, 'sha', ${daysAgo(5)})`;

    const counts = await purge().purge({ websiteId: site.id }, cutoffs, options());

    expect((await sql<{ page_path: string }[]>`SELECT page_path FROM heatmap_points WHERE website_id = ${site.id}::uuid`).map((r) => r.page_path)).toEqual(["/p5"]);
    expect(await n(sql`SELECT 1 FROM heatmap_points WHERE website_id = ${other.id}::uuid`)).toBe(1);
    expect((await sql<{ page_path: string }[]>`SELECT page_path FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`).map((r) => r.page_path)).toEqual(["/new"]);
    expect((await sql<{ page_path: string }[]>`SELECT page_path FROM heatmap_page_versions WHERE website_id = ${site.id}::uuid`).map((r) => r.page_path)).toEqual(["/new"]);
    expect(await objectExists(buckets.heatmaps(), oldShot)).toBe(false);
    expect(await objectExists(buckets.heatmaps(), oldHtml)).toBe(false);
    expect(await objectExists(buckets.heatmaps(), oldVariant)).toBe(false);
    expect(await objectExists(buckets.heatmaps(), newShot)).toBe(true);
    expect(counts).toMatchObject({ heatmapPointRows: 1, heatmapSnapshotRows: 1, heatmapVersionRows: 1 });
  });

  it("keeps an old page version whose copy a live snapshot still points at", async () => {
    // Deleting it would delete the HTML the current heatmap renders over.
    const { site } = await twoSites();
    const shared = `heatmaps/${site.id}/shared.html`;
    await putObject(buckets.heatmaps(), shared);
    await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, updated_at)
              VALUES (${site.id}::uuid, '/', ${`heatmaps/${site.id}/s.jpg`}, ${shared}, 'sha', 1200, 3000, ${daysAgo(1)})`;
    await sql`INSERT INTO heatmap_page_versions (website_id, page_path, dom_fingerprint, device_type, viewport_width, viewport_height, html_s3_key, content_sha256, last_seen_at)
              VALUES (${site.id}::uuid, '/', 'fp', 'desktop', 1200, 800, ${shared}, 'sha', ${daysAgo(45)})`;

    await purge().purge({ websiteId: site.id }, cutoffs, options());

    expect(await n(sql`SELECT 1 FROM heatmap_page_versions WHERE website_id = ${site.id}::uuid`)).toBe(1);
    expect(await objectExists(buckets.heatmaps(), shared)).toBe(true);
  });
});

describe("recording retention", () => {
  const purge = () => application().modules.recordings.retention;

  async function seedRecording(websiteId: string, ageDays: number) {
    const sessionId = `s-${randomUUID().slice(0, 8)}`;
    for (const sequence of [0, 1]) {
      await sql`INSERT INTO session_replays (website_id, session_id, sequence, data, timestamp)
                VALUES (${websiteId}, ${sessionId}, ${sequence}, '[]'::jsonb, ${daysAgo(ageDays)})`;
    }
    await sql`INSERT INTO session_analyses (website_id, session_id, started_at, summary)
              VALUES (${websiteId}, ${sessionId}, ${daysAgo(ageDays)}, '{"text":"a visit"}'::jsonb)`;
    const key = `sessions/${websiteId}/${sessionId}/chunk-00000000.json.gz`;
    await putObject(buckets.replays(), key);
    return { sessionId, key };
  }

  it("deletes old recordings, their stored chunks and their analyses, and keeps newer ones", async () => {
    const { site, other } = await twoSites();
    const old = await seedRecording(site.id, 45);
    const fresh = await seedRecording(site.id, 5);
    const theirs = await seedRecording(other.id, 45);

    const counts = await purge().purge({ websiteId: site.id }, cutoffs, options());

    const sessions = await sql<{ session_id: string }[]>`SELECT DISTINCT session_id FROM session_replays WHERE website_id = ${site.id}`;
    expect(sessions.map((r) => r.session_id)).toEqual([fresh.sessionId]);
    expect(await n(sql`SELECT 1 FROM session_analyses WHERE website_id = ${site.id} AND session_id = ${old.sessionId}`)).toBe(0);
    expect(await n(sql`SELECT 1 FROM session_analyses WHERE website_id = ${site.id} AND session_id = ${fresh.sessionId}`)).toBe(1);
    expect(await objectExists(buckets.replays(), old.key)).toBe(false);
    expect(await objectExists(buckets.replays(), fresh.key)).toBe(true);
    expect(await objectExists(buckets.replays(), theirs.key)).toBe(true);
    expect(counts).toMatchObject({ replaySessionsPurged: 1, sessionReplayPgRows: 2, replayStorageDeleteFailures: 0 });
  });

  it("pages through more old sessions than one batch holds", async () => {
    const { site } = await twoSites();
    for (let i = 0; i < 3; i++) await seedRecording(site.id, 45);
    const counts = await purge().purge({ websiteId: site.id }, cutoffs, { ...options(), batchSize: 2 });
    expect(counts.replaySessionsPurged).toBe(3);
    expect(await n(sql`SELECT 1 FROM session_replays WHERE website_id = ${site.id}`)).toBe(0);
  });
});

describe("integration delivery retention", () => {
  const purge = () => application().modules.integrations.retention;

  async function seedDelivery(websiteId: string, connectionId: string, ageDays: number, status: string) {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload, status, created_at, completed_at)
      VALUES (${connectionId}::uuid, ${websiteId}::uuid, ${randomUUID()}::uuid, '{"email":"a@b.c"}'::jsonb, ${status}, ${daysAgo(ageDays)},
              ${status === "pending" ? null : daysAgo(ageDays)})
      RETURNING id::text`;
    return row!.id;
  }

  it("deletes history past the funnel clock, expires undelivered leads after 30 days, and drops their payloads", async () => {
    const { site } = await twoSites();
    const [conn] = await sql<{ id: string }[]>`
      INSERT INTO integration_connections (website_id, provider, credentials) VALUES (${site.id}::uuid, 'webhook', 'x') RETURNING id::text`;
    const ancient = await seedDelivery(site.id, conn!.id, 90, "success");
    const stuck = await seedDelivery(site.id, conn!.id, 40, "pending");
    const failed = await seedDelivery(site.id, conn!.id, 40, "failed");
    const recent = await seedDelivery(site.id, conn!.id, 2, "pending");

    const counts = await purge().purge({ websiteId: site.id }, cutoffs, options());

    const rows = new Map((await sql<{ id: string; status: string; payload: unknown }[]>`
      SELECT id::text, status, payload FROM integration_deliveries WHERE website_id = ${site.id}::uuid`).map((r) => [r.id, r]));
    expect(rows.has(ancient)).toBe(false);
    expect(rows.get(stuck)).toMatchObject({ status: "failed", payload: null });
    expect(rows.get(failed)!.payload).toBeNull();
    expect(rows.get(recent)).toMatchObject({ status: "pending" });
    expect(rows.get(recent)!.payload).not.toBeNull();
    expect(counts).toMatchObject({ integrationDeliveryRows: 1, integrationDeliveriesExpired: 1 });
  });
});

describe("AI retention", () => {
  const purge = () => application().modules.ai.retention;

  it("deletes old questions, insights, resolved alerts and closed suggestions, and keeps open ones", async () => {
    const { site, ownerId } = await twoSites();
    for (const age of [45, 5]) {
      await sql`INSERT INTO ai_queries (user_id, website_id, prompt, created_at) VALUES (${ownerId}::uuid, ${site.id}::uuid, ${`q${age}`}, ${daysAgo(age)})`;
      await sql`INSERT INTO ai_insights (website_id, insight_date, status, created_at) VALUES (${site.id}::uuid, ${dayOf(age)}::date, 'ready', ${daysAgo(age)})`;
    }
    for (const [status, subject] of [["resolved", "a"], ["open", "b"]] as const) {
      await sql`INSERT INTO ai_anomalies (website_id, type, subject, status, severity, metric, window_start, window_end, title, summary, detected_at)
                VALUES (${site.id}::uuid, 'traffic_drop', ${subject}, ${status}, 'high', 'visitors', ${daysAgo(46)}, ${daysAgo(45)}, 't', 's', ${daysAgo(45)})`;
    }
    for (const status of ["dismissed", "open"]) {
      await sql`INSERT INTO ai_recommendations (website_id, source, dedupe_key, title, status, updated_at)
                VALUES (${site.id}::uuid, 'insight', ${status}, ${status}, ${status}, ${daysAgo(45)})`;
    }

    const counts = await purge().purge({ websiteId: site.id }, cutoffs, options());

    expect((await sql<{ prompt: string }[]>`SELECT prompt FROM ai_queries WHERE website_id = ${site.id}::uuid`).map((r) => r.prompt)).toEqual(["q5"]);
    expect(await n(sql`SELECT 1 FROM ai_insights WHERE website_id = ${site.id}::uuid`)).toBe(1);
    // An open alert is still happening, and an open suggestion still waiting: age alone does not end them.
    expect((await sql<{ status: string }[]>`SELECT status FROM ai_anomalies WHERE website_id = ${site.id}::uuid`).map((r) => r.status)).toEqual(["open"]);
    expect((await sql<{ status: string }[]>`SELECT status FROM ai_recommendations WHERE website_id = ${site.id}::uuid`).map((r) => r.status)).toEqual(["open"]);
    expect(counts).toMatchObject({ aiQueryRows: 1, aiInsightRows: 1, aiAnomalyRows: 1, aiRecommendationRows: 1 });
  });
});

describe("errors and visitor profile retention", () => {
  it("deletes old error events, groups left empty, and stale profiles and their aliases", async () => {
    const { site } = await twoSites();
    await sql`INSERT INTO error_events (website_id, fingerprint, message, occurred_at)
              VALUES (${site.id}::uuid, 'old', 'boom', ${daysAgo(45)}), (${site.id}::uuid, 'new', 'boom', ${daysAgo(5)})`;
    await sql`INSERT INTO error_groups (website_id, fingerprint, message, last_seen)
              VALUES (${site.id}::uuid, 'old', 'boom', ${daysAgo(45)}), (${site.id}::uuid, 'new', 'boom', ${daysAgo(5)})`;
    await sql`INSERT INTO user_profiles (website_id, anonymous_id, last_seen_at)
              VALUES (${site.id}::uuid, 'stale', ${daysAgo(45)}), (${site.id}::uuid, 'active', ${daysAgo(5)})`;
    await sql`INSERT INTO identity_aliases (website_id, anonymous_id, user_id, linked_at)
              VALUES (${site.id}::uuid, 'stale', 'u', ${daysAgo(45)}), (${site.id}::uuid, 'active', 'u', ${daysAgo(45)})`;

    await application().modules.errors.retention.purge({ websiteId: site.id }, cutoffs, options());
    await application().modules.automations.retention.purge({ websiteId: site.id }, cutoffs, options());

    expect((await sql<{ fingerprint: string }[]>`SELECT fingerprint FROM error_events WHERE website_id = ${site.id}::uuid`).map((r) => r.fingerprint)).toEqual(["new"]);
    expect((await sql<{ fingerprint: string }[]>`SELECT fingerprint FROM error_groups WHERE website_id = ${site.id}::uuid`).map((r) => r.fingerprint)).toEqual(["new"]);
    expect((await sql<{ anonymous_id: string }[]>`SELECT anonymous_id FROM user_profiles WHERE website_id = ${site.id}::uuid`).map((r) => r.anonymous_id)).toEqual(["active"]);
    // An old link to a profile still in use stays: it is how that visitor is still known.
    expect((await sql<{ anonymous_id: string }[]>`SELECT anonymous_id FROM identity_aliases WHERE website_id = ${site.id}::uuid`).map((r) => r.anonymous_id)).toEqual(["active"]);
  });
});

describe("the retention sweep with per-site overrides", () => {
  // Stands in for the gateway's per-site retention endpoint.
  let overrides: unknown = { websites: [] };
  let status = 200;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => new Response(JSON.stringify(overrides), { status, headers: { "Content-Type": "application/json" } }),
  });
  afterAll(() => server.stop(true));

  /** A sweep over exactly one website, with every module's real purge. */
  function sweepFor(websiteId: string) {
    const m = application().modules;
    const purgers: RetentionPurge[] = [
      m.analytics.retention, m.automations.retention, m.errors.retention, m.leads.retention,
      m.integrations.retention, m.ai.retention, m.recordings.retention, m.heatmaps.retention,
    ];
    return new RetentionService({ listAllSites: async () => [{ websiteId }] }, purgers);
  }

  const config = (dataRetention: Partial<ReturnType<typeof env>["dataRetention"]> = {}) => {
    const base = env();
    return {
      ...base,
      dataRetention: {
        ...base.dataRetention,
        enabled: true,
        analyticsDays: 365,
        replayDays: 365,
        heatmapDays: 365,
        funnelAutomationDays: 365,
        enterpriseEnabled: true,
        enterpriseRetentionUrl: `http://127.0.0.1:${server.port}/retention`,
        ...dataRetention,
      },
    };
  };

  it("applies a site's own analytics retention over the deployment default", async () => {
    const { site } = await twoSites();
    overrides = { websites: [{ website_id: site.id, analytics_days: 10 }] };
    status = 200;
    await seedEvent(site.id, 20);
    const fresh = await seedEvent(site.id, 2);

    const stats = await sweepFor(site.id).runSafely(config());

    expect(stats!.websitesProcessed).toBe(1);
    expect((await sql<{ visitor_id: string }[]>`SELECT visitor_id FROM analytics_events WHERE website_id = ${site.id}`).map((r) => r.visitor_id)).toEqual([fresh]);
  });

  it("caps every kind of data at the site's privacy promise (max_days)", async () => {
    // Recordings default to a year here; the site promised its visitors 7 days.
    const { site } = await twoSites();
    overrides = { websites: [{ website_id: site.id, replay_days: 300, max_days: 7 }] };
    status = 200;
    await sql`INSERT INTO session_replays (website_id, session_id, sequence, data, timestamp)
              VALUES (${site.id}, 'old', 0, '[]'::jsonb, ${daysAgo(10)}), (${site.id}, 'new', 0, '[]'::jsonb, ${daysAgo(3)})`;

    await sweepFor(site.id).runSafely(config());

    expect((await sql<{ session_id: string }[]>`SELECT session_id FROM session_replays WHERE website_id = ${site.id}`).map((r) => r.session_id)).toEqual(["new"]);
  });

  it("falls back to the deployment defaults when the overrides cannot be read", async () => {
    const { site } = await twoSites();
    overrides = { websites: [{ website_id: site.id, analytics_days: 1 }] };
    status = 500;
    await seedEvent(site.id, 20);

    const stats = await sweepFor(site.id).runSafely(config());

    // Defaults are a year: nothing of this site's goes on the wrong clock.
    expect(stats!.websitesProcessed).toBe(1);
    expect(await n(sql`SELECT 1 FROM analytics_events WHERE website_id = ${site.id}`)).toBe(1);
  });

  it("ignores an override for another website", async () => {
    const { site, other } = await twoSites();
    overrides = { websites: [{ website_id: other.id, analytics_days: 1 }] };
    status = 200;
    await seedEvent(site.id, 20);
    await sweepFor(site.id).runSafely(config());
    expect(await n(sql`SELECT 1 FROM analytics_events WHERE website_id = ${site.id}`)).toBe(1);
  });

  it("does nothing when retention is disabled", async () => {
    const { site } = await twoSites();
    await seedEvent(site.id, 400);
    expect(await sweepFor(site.id).runSafely(config({ enabled: false }))).toBeNull();
    expect(await n(sql`SELECT 1 FROM analytics_events WHERE website_id = ${site.id}`)).toBe(1);
  });

  it("refuses a second sweep while one is running", async () => {
    const { site } = await twoSites();
    const service = sweepFor(site.id);
    const [a, b] = await Promise.all([service.runSafely(config()), service.runSafely(config())]);
    expect([a, b].filter((s) => s === null)).toHaveLength(1);
  });
});
