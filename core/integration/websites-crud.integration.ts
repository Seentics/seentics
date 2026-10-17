import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { api, buckets, listKeys, objectExists, putObject, seedUser, seedWebsite, sql } from "./harness";
import { sessionPrefix } from "../platform/storage/s3-keys";
import { MISSING_ID, seedTeam, W } from "./helpers/websites";

describe("creating a website", () => {
  it("stores a bare, lower-cased hostname and gives the site a tracking id and the owner a membership", async () => {
    const owner = await seedUser();

    const res = await api("POST", W, { token: owner.token, body: { name: "  Shop  ", url: "https://WWW.Shop-Example.com:8443/pricing?a=1#x" } });

    expect(res.status).toBe(201);
    const site = res.body.data.website;
    expect(site.url).toBe("shop-example.com");
    expect(site.name).toBe("Shop");
    expect(site.user_id).toBe(owner.id);
    expect(site.tracking_id).toEqual(expect.any(String));
    expect(site.tracking_id.length).toBeGreaterThan(8);
    expect(site.verification_token).toEqual(expect.any(String));
    expect(site.is_verified).toBe(false);
    expect(site.public_share_id).toBeNull();
    // Replay is on at full sampling for a new site; the dashboard reads these defaults.
    expect(site.replay_enabled).toBe(true);
    expect(site.replay_sampling_rate).toBe(1);
    // The membership row every access check reads.
    const [m] = await sql<{ role: string }[]>`SELECT role FROM website_members WHERE website_id = ${site.id}::uuid AND user_id = ${owner.id}::uuid`;
    expect(m?.role).toBe("owner");
  });

  it("gives two sites different tracking ids", async () => {
    const owner = await seedUser();
    const a = await api("POST", W, { token: owner.token, body: { name: "A", url: "https://a.example.com" } });
    const b = await api("POST", W, { token: owner.token, body: { name: "B", url: "https://b.example.com" } });
    expect(a.body.data.website.tracking_id).not.toBe(b.body.data.website.tracking_id);
  });

  it("also answers under the /user/websites mount", async () => {
    const owner = await seedUser();
    const res = await api("POST", "/api/v1/user/websites", { token: owner.token, body: { name: "Mounted", url: "https://mounted.example.com" } });
    expect(res.status).toBe(201);
    const list = await api("GET", "/api/v1/user/websites", { token: owner.token });
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([res.body.data.website.id]);
  });

  it("needs a session", async () => {
    const res = await api("POST", W, { body: { name: "x", url: "https://x.example.com" } });
    expect(res.status).toBe(401);
  });

  it("rejects a missing name, a blank name, an over-long name, a bare host and a non-URL", async () => {
    const owner = await seedUser();
    for (const body of [
      { url: "https://x.example.com" },
      { name: "   ", url: "https://x.example.com" },
      { name: "n".repeat(121), url: "https://x.example.com" },
      // The dashboard form sends a full URL; a bare host is the management API's job.
      { name: "x", url: "x.example.com" },
      { name: "x", url: "not a url" },
      { name: "x" },
    ]) {
      const res = await api("POST", W, { token: owner.token, body });
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    const res = await api("POST", W, { token: owner.token, body: "{not json" });
    expect(res.status).toBe(400);
    const rows = await sql`SELECT 1 FROM websites WHERE user_id = ${owner.id}::uuid`;
    expect(rows).toHaveLength(0);
  });
});

describe("listing websites", () => {
  it("lists the caller's own sites with zeroed stats, and nobody else's", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const mine = await seedWebsite(owner.id);
    await seedWebsite(other.id);

    const res = await api("GET", W, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { id: string }) => s.id)).toEqual([mine.id]);
    expect(res.body.data[0].stats).toEqual(expect.objectContaining({ totalPageviews: 0, uniqueVisitors: 0 }));
  });

  it("lists a site the caller is only a member of, beside the ones they own", async () => {
    const t = await seedTeam();
    const res = await api("GET", W, { token: t.admin.token });
    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { id: string }) => s.id)).toContain(t.site.id);
  });

  it("needs a session", async () => {
    expect((await api("GET", W)).status).toBe(401);
    expect((await api("GET", W, { token: "not-a-jwt" })).status).toBe(401);
  });
});

describe("reading one website", () => {
  it("is open to every role on the site, with the same body", async () => {
    const t = await seedTeam();
    for (const u of [t.owner, t.admin, t.member, t.viewer]) {
      const res = await api("GET", `${W}/${t.site.id}`, { token: u.token });
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(t.site.id);
      expect(res.body.data.tracking_id).toBe(t.site.trackingId);
    }
  });

  it("refuses another account, a missing id and a malformed id", async () => {
    const t = await seedTeam();
    expect((await api("GET", `${W}/${t.site.id}`, { token: t.stranger.token })).status).toBe(403);
    expect((await api("GET", `${W}/${MISSING_ID}`, { token: t.owner.token })).status).toBe(403);
    // A non-uuid reaches Postgres as a bad value; it must not be a 500.
    const bad = await api("GET", `${W}/not-a-uuid`, { token: t.owner.token });
    expect([403, 404]).toContain(bad.status);
    expect((await api("GET", `${W}/${t.site.id}`)).status).toBe(401);
  });

  it("reports each caller's own role", async () => {
    const t = await seedTeam();
    for (const [u, role] of [[t.owner, "owner"], [t.admin, "admin"], [t.member, "member"], [t.viewer, "viewer"]] as const) {
      const res = await api("GET", `${W}/${t.site.id}/my-role`, { token: u.token });
      expect(res.body).toEqual({ data: { role } });
    }
    expect((await api("GET", `${W}/${t.site.id}/my-role`, { token: t.stranger.token })).status).toBe(403);
  });
});

describe("updating a website's settings", () => {
  it("changes name and address, normalising the address the same way create does", async () => {
    const t = await seedTeam();
    const res = await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { name: "Renamed", url: "https://www.New-Host.example.com/x" } });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed");
    expect(res.body.data.url).toBe("new-host.example.com");
    const [row] = await sql<{ url: string }[]>`SELECT url FROM websites WHERE id = ${t.site.id}::uuid`;
    expect(row?.url).toBe("new-host.example.com");
  });

  it("switches each feature toggle and the replay, masking and heatmap settings", async () => {
    const t = await seedTeam();
    const patch = {
      is_active: false,
      automation_enabled: false,
      funnel_enabled: false,
      errors_enabled: false,
      heatmap_enabled: false,
      heatmap_layout_enabled: false,
      replay_enabled: false,
      replay_sampling_rate: 0.25,
      mask_all_text: true,
      mask_text_patterns: "/secret",
      heatmap_include_patterns: "/blog/*",
      heatmap_exclude_patterns: "/admin/*",
      replay_include_patterns: "/checkout",
      replay_exclude_patterns: "/account",
    };
    const res = await api("PUT", `${W}/${t.site.id}`, { token: t.admin.token, body: patch });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining(patch));
    const after = await api("GET", `${W}/${t.site.id}`, { token: t.owner.token });
    expect(after.body.data).toEqual(expect.objectContaining(patch));
  });

  it("clears a pattern with null and leaves it alone when absent", async () => {
    const t = await seedTeam();
    await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { replay_include_patterns: "/a", heatmap_include_patterns: "/b" } });

    const res = await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { replay_include_patterns: null } });

    expect(res.body.data.replay_include_patterns).toBeNull();
    expect(res.body.data.heatmap_include_patterns).toBe("/b");
  });

  it("ignores unknown keys and wrong-typed values instead of storing them", async () => {
    const t = await seedTeam();
    const res = await api("PUT", `${W}/${t.site.id}`, {
      token: t.owner.token,
      // user_id and tracking_id are not settings: a patch must not move ownership or the tracker key.
      body: { user_id: t.stranger.id, tracking_id: "trk_hijack", replay_enabled: "no", public_share_id: "x" },
    });
    expect(res.status).toBe(200);
    const [row] = await sql<{ user_id: string; tracking_id: string; replay_enabled: boolean; public_share_id: string | null }[]>`
      SELECT user_id::text, tracking_id, replay_enabled, public_share_id FROM websites WHERE id = ${t.site.id}::uuid`;
    expect(row).toEqual({ user_id: t.owner.id, tracking_id: t.site.trackingId, replay_enabled: true, public_share_id: null });
  });

  it("is for admins and the owner only", async () => {
    const t = await seedTeam();
    for (const u of [t.member, t.viewer, t.stranger]) {
      const res = await api("PUT", `${W}/${t.site.id}`, { token: u.token, body: { name: "Hijacked" } });
      expect(res.status).toBe(403);
    }
    expect((await api("PUT", `${W}/${t.site.id}`, { body: { name: "x" } })).status).toBe(401);
    const [row] = await sql<{ name: string }[]>`SELECT name FROM websites WHERE id = ${t.site.id}::uuid`;
    expect(row?.name).toBe("Test site");
  });

  it("rejects a body that is not an object", async () => {
    const t = await seedTeam();
    expect((await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: "[1,2]" })).status).toBe(400);
    expect((await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: "nope" })).status).toBe(400);
  });

  it("rejects an address that cannot be parsed with 400", async () => {
    const t = await seedTeam();
    const res = await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { url: "http://" } });
    expect(res.status).toBe(400);
  });

  it("rejects a blank name and a replay sampling rate outside 0..1", async () => {
    const t = await seedTeam();
    expect((await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { name: "" } })).status).toBe(400);
    expect((await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { replay_sampling_rate: 5 } })).status).toBe(400);
    expect((await api("PUT", `${W}/${t.site.id}`, { token: t.owner.token, body: { replay_sampling_rate: -1 } })).status).toBe(400);
  });
});

/** One row in every table deleting a site is meant to empty, plus stored replay and heatmap files. */
async function seedSiteData(siteId: string, ownerId: string) {
  const sessionId = `s-${randomUUID().slice(0, 8)}`;
  await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
            VALUES (${siteId}, 'pageview', '/', 'v1', ${sessionId}, now())`;
  await sql`INSERT INTO session_replays (website_id, session_id, sequence, data, timestamp)
            VALUES (${siteId}, ${sessionId}, 0, '[]'::jsonb, now())`;
  const replayKey = `${sessionPrefix(siteId, sessionId)}chunk-0.json`;
  await putObject(buckets.replays(), replayKey);
  await sql`INSERT INTO heatmap_points (website_id, page_path, event_type, device_type, x_percent, y_percent)
            VALUES (${siteId}::uuid, '/', 'click', 'desktop', 10, 20)`;
  const shot = `heatmaps/${siteId}/shot.jpg`;
  await putObject(buckets.heatmaps(), shot);
  await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, device_type)
            VALUES (${siteId}::uuid, '/', ${shot}, NULL, 'sha', 1200, 3000, 'desktop')`;
  await sql`INSERT INTO automations (website_id, user_id, name, definition) VALUES (${siteId}::uuid, ${ownerId}::uuid, 'a', '{}'::jsonb)`;
  await sql`INSERT INTO funnels (website_id, user_id, name, steps) VALUES (${siteId}::uuid, ${ownerId}::uuid, 'f', '[]'::jsonb)`;
  await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${siteId}::uuid, 'g', 'pageview', '/thanks')`;
  await sql`INSERT INTO form_submissions (website_id, email, anonymous_id, session_id) VALUES (${siteId}::uuid, 'lead@example.com', 'v1', ${sessionId})`;
  await sql`INSERT INTO user_profiles (website_id, anonymous_id) VALUES (${siteId}::uuid, 'v1')`;
  await sql`INSERT INTO error_events (website_id, fingerprint, message) VALUES (${siteId}::uuid, 'fp', 'boom')`;
  await sql`INSERT INTO website_invitations (website_id, email, role, token, invited_by, expires_at)
            VALUES (${siteId}::uuid, 'pending@example.com', 'viewer', ${randomUUID()}, ${ownerId}::uuid, now() + interval '1 day')`;
  return { replayKey, shot, sessionId };
}

const SITE_TABLES = [
  "analytics_events", "session_replays", "heatmap_points", "heatmap_page_snapshots", "automations", "funnels", "goals",
  "form_submissions", "user_profiles", "error_events", "website_members", "website_invitations",
];

describe("deleting a website", () => {
  it("removes the site, everything it collected and its stored files — and leaves other sites alone", async () => {
    const t = await seedTeam();
    const keep = await seedWebsite(t.owner.id);
    const gone = await seedSiteData(t.site.id, t.owner.id);
    const kept = await seedSiteData(keep.id, t.owner.id);

    const res = await api("DELETE", `${W}/${t.site.id}`, { token: t.owner.token });

    expect(res.status).toBe(204);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${t.site.id}::uuid`).toHaveLength(0);
    for (const table of SITE_TABLES) {
      const rows = await sql.unsafe(`SELECT 1 FROM ${table} WHERE website_id::text = $1`, [t.site.id]);
      expect({ table, rows: rows.length }).toEqual({ table, rows: 0 });
      const other = await sql.unsafe(`SELECT 1 FROM ${table} WHERE website_id::text = $1`, [keep.id]);
      // seedWebsite adds no owner membership row, so the kept site has none to keep.
      if (table !== "website_members") expect({ table, kept: other.length > 0 }).toEqual({ table, kept: true });
    }
    expect(await objectExists(buckets.replays(), gone.replayKey)).toBe(false);
    expect(await listKeys(buckets.replays(), sessionPrefix(t.site.id, gone.sessionId))).toEqual([]);
    expect(await objectExists(buckets.heatmaps(), gone.shot)).toBe(false);
    expect(await objectExists(buckets.replays(), kept.replayKey)).toBe(true);
    expect(await objectExists(buckets.heatmaps(), kept.shot)).toBe(true);
  });

  it("takes the former members' access away at once", async () => {
    const t = await seedTeam();
    await api("DELETE", `${W}/${t.site.id}`, { token: t.owner.token });
    expect((await api("GET", `${W}/${t.site.id}`, { token: t.admin.token })).status).toBe(403);
  });

  it("removes the site's privacy settings row too", async () => {
    const t = await seedTeam();
    await api("PUT", `${W}/${t.site.id}/privacy`, { token: t.owner.token, body: { ipAnonymization: "full" } });
    await api("DELETE", `${W}/${t.site.id}`, { token: t.owner.token });
    expect(await sql`SELECT 1 FROM website_privacy_settings WHERE site_id = ${t.site.id}`).toHaveLength(0);
  });

  it("is for the owner only — not even an admin", async () => {
    const t = await seedTeam();
    for (const u of [t.admin, t.member, t.viewer, t.stranger]) {
      expect((await api("DELETE", `${W}/${t.site.id}`, { token: u.token })).status).toBe(403);
    }
    expect((await api("DELETE", `${W}/${t.site.id}`)).status).toBe(401);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${t.site.id}::uuid`).toHaveLength(1);
  });

  it("refuses a site that does not exist", async () => {
    const owner = await seedUser();
    expect((await api("DELETE", `${W}/${MISSING_ID}`, { token: owner.token })).status).toBe(403);
  });
});
