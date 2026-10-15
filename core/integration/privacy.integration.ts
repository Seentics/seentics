import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { api, buckets, objectExists, putObject, seedUser, seedWebsite, sql } from "./harness";

/** A visitor with an event, a session analysis and a popup lead that was queued for an integration. */
async function seedVisitor(websiteId: string) {
  const visitorId = `v-${randomUUID().slice(0, 8)}`;
  const sessionId = `s-${randomUUID().slice(0, 8)}`;
  await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
            VALUES (${websiteId}, 'pageview', '/', ${visitorId}, ${sessionId}, now())`;
  await sql`INSERT INTO session_analyses (website_id, session_id, started_at, summary)
            VALUES (${websiteId}, ${sessionId}, now(), '{"text":"Visited the home page"}'::jsonb)`;
  const [lead] = await sql<{ id: string }[]>`
    INSERT INTO form_submissions (website_id, email, name, phone, anonymous_id, session_id)
    VALUES (${websiteId}::uuid, 'jane@example.com', 'Jane', '+100', ${visitorId}, ${sessionId})
    RETURNING id::text`;
  const [conn] = await sql<{ id: string }[]>`
    INSERT INTO integration_connections (website_id, provider, credentials)
    VALUES (${websiteId}::uuid, 'webhook', 'ciphertext') RETURNING id::text`;
  await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload, status)
            VALUES (${conn!.id}::uuid, ${websiteId}::uuid, ${lead!.id}::uuid, '{"email":"jane@example.com"}'::jsonb, 'pending')`;
  await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload, status)
            VALUES (${conn!.id}::uuid, ${websiteId}::uuid, ${randomUUID()}::uuid, '{"other":true}'::jsonb, 'success')`;
  return { visitorId, sessionId, leadId: lead!.id };
}

describe("one visitor's data (Art. 15 / 17)", () => {
  it("exports what they typed into the site's popups", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const v = await seedVisitor(site.id);

    const res = await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { visitor_id: v.visitorId } });

    expect(res.status).toBe(200);
    expect(res.body.data.found).toBe(true);
    expect(res.body.data.leads.map((l: { email: string }) => l.email)).toEqual(["jane@example.com"]);
    expect(res.body.data.analyses).toHaveLength(1);
  });

  it("erases their leads and the copies queued for integrations, and nobody else's", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const v = await seedVisitor(site.id);
    const other = await seedVisitor(site.id);

    const res = await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { visitor_id: v.visitorId } });

    expect(res.status).toBe(200);
    expect(res.body.data.erased).toBe(true);
    const leads = await sql<{ id: string }[]>`SELECT id::text FROM form_submissions WHERE website_id = ${site.id}::uuid`;
    expect(leads.map((r) => r.id)).toEqual([other.leadId]);
    const theirs = await sql`SELECT 1 FROM integration_deliveries WHERE submission_id = ${v.leadId}::uuid`;
    expect(theirs).toHaveLength(0);
    const events = await sql`SELECT 1 FROM analytics_events WHERE website_id = ${site.id} AND visitor_id = ${v.visitorId}`;
    expect(events).toHaveLength(0);
    const analyses = await sql`SELECT 1 FROM session_analyses WHERE website_id = ${site.id} AND session_id = ${v.sessionId}`;
    expect(analyses).toHaveLength(0);
  });

  it("refuses another account's site", async () => {
    const owner = await seedUser();
    const stranger = await seedUser();
    const site = await seedWebsite(owner.id);
    const v = await seedVisitor(site.id);

    const res = await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: stranger.token, query: { visitor_id: v.visitorId } });

    expect(res.status).toBe(404);
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${v.leadId}::uuid`).toHaveLength(1);
  });
});

describe("erasing a whole site's data", () => {
  it("removes its leads, deliveries, prizes, page variants and their stored copies — from the heatmap bucket", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    await seedVisitor(site.id);
    await sql`INSERT INTO form_prizes (website_id, automation_id, email_hash, prize)
              VALUES (${site.id}::uuid, ${randomUUID()}::uuid, ${"a".repeat(64)}, '{}'::jsonb)`;
    const shot = `heatmaps/${site.id}/shot.jpg`;
    const html = `heatmaps/${site.id}/page.html`;
    const variant = `heatmaps/${site.id}/page_abc.html`;
    for (const key of [shot, html, variant]) await putObject(buckets.heatmaps(), key);
    await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, device_type)
              VALUES (${site.id}::uuid, '/', ${shot}, ${html}, 'sha', 1200, 3000, 'desktop')`;
    await sql`INSERT INTO heatmap_page_versions (website_id, page_path, dom_fingerprint, device_type, viewport_width, viewport_height, html_s3_key, content_sha256)
              VALUES (${site.id}::uuid, '/', 'fp1', 'desktop', 1200, 800, ${variant}, 'sha')`;

    const res = await api("DELETE", `/api/v1/privacy/delete/website/${site.id}`, { token: owner.token });

    expect(res.status).toBe(200);
    for (const table of ["form_submissions", "integration_deliveries", "form_prizes", "heatmap_page_snapshots", "heatmap_page_versions"]) {
      const rows = await sql.unsafe(`SELECT 1 FROM ${table} WHERE website_id::text = $1`, [site.id]);
      expect({ table, rows: rows.length }).toEqual({ table, rows: 0 });
    }
    for (const key of [shot, html, variant]) expect({ key, exists: await objectExists(buckets.heatmaps(), key) }).toEqual({ key, exists: false });
  });
});
