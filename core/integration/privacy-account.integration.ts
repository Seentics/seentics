import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

// The export budgets are read when app/http/privacy.ts loads, so they are lowered before the
// harness (and with it the app) is imported: 1,000 rows is the smallest either may be.
process.env.PRIVACY_EXPORT_MAX_ROWS = "1000";
process.env.PRIVACY_EXPORT_MAX_TOTAL_ROWS = "1000";
const { api, addMember, seedUser, seedWebsite, sql } = await import("./harness");

async function seedEvents(websiteId: string, n: number, opts: { visitorId?: string; sessionId?: string } = {}) {
  const visitorId = opts.visitorId ?? `v-${randomUUID().slice(0, 8)}`;
  const sessionId = opts.sessionId ?? `s-${randomUUID().slice(0, 8)}`;
  await sql`
    INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
    SELECT ${websiteId}, 'pageview', '/p' || g, ${visitorId}, ${sessionId}, now() - (g || ' seconds')::interval
    FROM generate_series(1, ${n}) g`;
  return { visitorId, sessionId };
}

const count = async (table: string, websiteId: string) =>
  Number((await sql.unsafe(`SELECT count(*)::int AS n FROM ${table} WHERE website_id::text = $1`, [websiteId]))[0]!.n);

describe("exporting a whole account (Art. 20)", () => {
  it("requires a signed-in user", async () => {
    const owner = await seedUser();
    const res = await api("GET", `/api/v1/privacy/export/${owner.id}`);
    expect(res.status).toBe(401);
  });

  it("refuses to export someone else's account", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const res = await api("GET", `/api/v1/privacy/export/${other.id}`, { token: owner.token });
    expect(res.status).toBe(403);
  });

  it("exports every site the user owns, and none they are only a member of", async () => {
    const owner = await seedUser();
    const a = await seedWebsite(owner.id);
    const b = await seedWebsite(owner.id);
    const stranger = await seedUser();
    const shared = await seedWebsite(stranger.id);
    await addMember(shared.id, owner.id, "admin");
    await seedEvents(a.id, 3);
    await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${b.id}::uuid, 'Signup', 'event', 'signup')`;
    await seedEvents(shared.id, 2);

    const res = await api("GET", `/api/v1/privacy/export/${owner.id}`, { token: owner.token });

    expect(res.status).toBe(200);
    const sites = res.body.data.websites as Array<{ website: { id: string }; events: unknown[]; goals: unknown[] }>;
    expect(sites.map((s) => s.website.id).sort()).toEqual([a.id, b.id].sort());
    expect(sites.find((s) => s.website.id === a.id)!.events).toHaveLength(3);
    expect(sites.find((s) => s.website.id === b.id)!.goals).toHaveLength(1);
    expect(typeof res.body.data.exportedAt).toBe("string");
  });

  it("answers 413 when one collection is over the per-collection limit, rather than holding it all in memory", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    await seedEvents(site.id, 1001);
    const res = await api("GET", `/api/v1/privacy/export/${owner.id}`, { token: owner.token });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("events export exceeds 1000 rows");
  });

  it("answers 413 when several sites together are over the account's row budget", async () => {
    // Each site is under the per-collection limit; the sum is not. The budget used to be per site.
    const owner = await seedUser();
    const a = await seedWebsite(owner.id);
    const b = await seedWebsite(owner.id);
    await seedEvents(a.id, 600);
    await seedEvents(b.id, 600);
    const res = await api("GET", `/api/v1/privacy/export/${owner.id}`, { token: owner.token });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("request a managed export");
  });
});

describe("exporting one website", () => {
  it("returns the site's collections to its owner", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    await seedEvents(site.id, 2);
    const res = await api("GET", `/api/v1/privacy/export/website/${site.id}`, { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data.website.id).toBe(site.id);
    expect(res.body.data.events).toHaveLength(2);
    for (const key of ["replays", "heatmaps", "profiles", "goals", "funnels", "automations"]) {
      expect(Array.isArray(res.body.data[key])).toBe(true);
    }
  });

  it("is 404 for another account's site, a site the caller is only a member of, and a malformed id", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const member = await seedUser();
    await addMember(site.id, member.id, "admin");
    const stranger = await seedUser();
    // Export is the owner's: an admin member can see the dashboard, not take every visitor's data.
    expect((await api("GET", `/api/v1/privacy/export/website/${site.id}`, { token: member.token })).status).toBe(404);
    expect((await api("GET", `/api/v1/privacy/export/website/${site.id}`, { token: stranger.token })).status).toBe(404);
    expect((await api("GET", `/api/v1/privacy/export/website/not-a-uuid`, { token: owner.token })).status).toBe(404);
    expect((await api("GET", `/api/v1/privacy/export/website/${site.id}`)).status).toBe(401);
  });

  it("answers 413 over the row limit", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    await seedEvents(site.id, 1001);
    const res = await api("GET", `/api/v1/privacy/export/website/${site.id}`, { token: owner.token });
    expect(res.status).toBe(413);
  });
});

describe("erasing a whole account's analytics", () => {
  it("erases every owned site's data and leaves the sites, and other accounts, alone", async () => {
    const owner = await seedUser();
    const a = await seedWebsite(owner.id);
    const b = await seedWebsite(owner.id);
    const stranger = await seedUser();
    const theirs = await seedWebsite(stranger.id);
    for (const site of [a, b, theirs]) {
      await seedEvents(site.id, 2);
      await sql`INSERT INTO ai_queries (user_id, website_id, prompt) VALUES (${site.ownerId}::uuid, ${site.id}::uuid, 'q')`;
      await sql`INSERT INTO identity_aliases (website_id, anonymous_id, user_id) VALUES (${site.id}::uuid, 'anon', 'u1')`;
    }

    const res = await api("DELETE", `/api/v1/privacy/delete/${owner.id}`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const site of [a, b]) {
      expect(await count("analytics_events", site.id)).toBe(0);
      expect(await count("ai_queries", site.id)).toBe(0);
      expect(await count("identity_aliases", site.id)).toBe(0);
    }
    // The websites themselves stay: this is a data erasure, not an account deletion.
    const kept = await sql`SELECT id FROM websites WHERE id = ANY(${[a.id, b.id]}::uuid[])`;
    expect(kept).toHaveLength(2);
    expect(await count("analytics_events", theirs.id)).toBe(2);
    expect(await count("ai_queries", theirs.id)).toBe(1);
  });

  it("refuses to erase another account, and erases nothing of theirs", async () => {
    const owner = await seedUser();
    const victim = await seedUser();
    const site = await seedWebsite(victim.id);
    await seedEvents(site.id, 1);
    const res = await api("DELETE", `/api/v1/privacy/delete/${victim.id}`, { token: owner.token });
    expect(res.status).toBe(403);
    expect(await count("analytics_events", site.id)).toBe(1);
  });

  it("requires a signed-in user", async () => {
    const owner = await seedUser();
    expect((await api("DELETE", `/api/v1/privacy/delete/${owner.id}`)).status).toBe(401);
  });

  it("succeeds for an account with no sites", async () => {
    const owner = await seedUser();
    const res = await api("DELETE", `/api/v1/privacy/delete/${owner.id}`, { token: owner.token });
    expect(res.status).toBe(200);
  });
});

describe("retention policies", () => {
  it("lists the caller's per-site retention and the deployment defaults", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const other = await seedUser();
    const theirs = await seedWebsite(other.id);
    await sql`INSERT INTO website_privacy_settings (site_id, user_id, data_retention_days) VALUES (${site.id}, ${owner.id}::uuid, 30)`;
    await sql`INSERT INTO website_privacy_settings (site_id, user_id, data_retention_days) VALUES (${theirs.id}, ${other.id}::uuid, 7)`;

    const res = await api("GET", "/api/v1/privacy/retention-policies", { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ websiteId: site.id, dataRetentionDays: 30 }]);
    for (const key of ["analyticsDays", "replayDays", "heatmapDays"]) expect(typeof res.body.defaults[key]).toBe("number");
  });

  it("is an empty list for a user with no settings, and 401 without a session", async () => {
    const owner = await seedUser();
    const res = await api("GET", "/api/v1/privacy/retention-policies", { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect((await api("GET", "/api/v1/privacy/retention-policies")).status).toBe(401);
  });
});

describe("operations that are deliberately not offered", () => {
  it("refuses bulk import with 405", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const res = await api("POST", `/api/v1/privacy/import/${site.id}`, { token: owner.token, body: { events: [] } });
    expect(res.status).toBe(405);
  });

  it("refuses anonymisation with 405 and points at erasure", async () => {
    const owner = await seedUser();
    const res = await api("PUT", `/api/v1/privacy/anonymize/${owner.id}`, { token: owner.token });
    expect(res.status).toBe(405);
    expect(res.body.error).toContain("erasure");
  });

  it("refuses an on-demand retention cleanup with 409: it runs on the schedule", async () => {
    const owner = await seedUser();
    const res = await api("POST", "/api/v1/privacy/cleanup", { token: owner.token });
    expect(res.status).toBe(409);
  });

  it("still requires a session for the stubs", async () => {
    expect((await api("POST", "/api/v1/privacy/cleanup")).status).toBe(401);
    expect((await api("POST", `/api/v1/privacy/import/${randomUUID()}`)).status).toBe(401);
  });
});

describe("finding one visitor by the user id the site gave them", () => {
  /** One person seen as two anonymous ids, joined by identify(), plus a stranger on the same site. */
  async function seedIdentified(websiteId: string) {
    const userId = `user-${randomUUID().slice(0, 8)}`;
    const aliasOnly = await seedEvents(websiteId, 2);
    const viaIdentify = await seedEvents(websiteId, 1);
    const viaProfile = await seedEvents(websiteId, 1);
    await sql`INSERT INTO identity_aliases (website_id, anonymous_id, user_id) VALUES (${websiteId}::uuid, ${aliasOnly.visitorId}, ${userId})`;
    await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at, properties)
              VALUES (${websiteId}, 'identify', '/', ${viaIdentify.visitorId}, ${viaIdentify.sessionId}, now(), ${JSON.stringify({ user_id: userId })}::jsonb)`;
    await sql`INSERT INTO user_profiles (website_id, anonymous_id, user_id) VALUES (${websiteId}::uuid, ${viaProfile.visitorId}, ${userId})`;
    const stranger = await seedEvents(websiteId, 3);
    return { userId, ids: [aliasOnly.visitorId, viaIdentify.visitorId, viaProfile.visitorId], stranger };
  }

  it("exports every anonymous id linked to the user id, through aliases, identify events and profiles", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const { userId, ids, stranger } = await seedIdentified(site.id);

    const res = await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { user_id: userId } });

    expect(res.status).toBe(200);
    expect(res.body.data.found).toBe(true);
    expect([...res.body.data.visitorIds].sort()).toEqual([...ids].sort());
    // 2 + (1 pageview + 1 identify) + 1, and none of the stranger's 3.
    expect(res.body.data.events).toHaveLength(5);
    expect(res.body.data.events.some((e: { visitor_id: string }) => e.visitor_id === stranger.visitorId)).toBe(false);
    expect(res.body.data.aliases).toHaveLength(1);
    expect(res.body.data.profiles).toHaveLength(1);
  });

  it("erases every linked id and the links themselves, and leaves the stranger", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const { userId, ids, stranger } = await seedIdentified(site.id);

    const res = await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { user_id: userId } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ found: true, erased: true, visitorIds: 3 });
    const left = await sql`SELECT visitor_id FROM analytics_events WHERE website_id = ${site.id} AND visitor_id = ANY(${ids})`;
    expect(left).toHaveLength(0);
    expect(await count("identity_aliases", site.id)).toBe(0);
    expect(await count("user_profiles", site.id)).toBe(0);
    const strangers = await sql`SELECT 1 FROM analytics_events WHERE website_id = ${site.id} AND visitor_id = ${stranger.visitorId}`;
    expect(strangers).toHaveLength(3);
  });

  it("does not follow a user id across sites", async () => {
    // The same user id on another site is another person as far as this site is concerned.
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const otherSite = await seedWebsite(owner.id);
    const { userId } = await seedIdentified(otherSite.id);
    const res = await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { user_id: userId } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ found: false });
  });

  it("answers found:false for an unknown user id, without erasing anything", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    await seedEvents(site.id, 1);
    const res = await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { user_id: "nobody" } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ found: false, erased: false });
    expect(await count("analytics_events", site.id)).toBe(1);
  });

  it("requires a visitor_id or user_id of sane length", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    expect((await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token })).status).toBe(400);
    expect((await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { user_id: "   " } })).status).toBe(400);
    expect((await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { user_id: "x".repeat(201) } })).status).toBe(400);
  });

  it("refuses a member who is not the owner, and requires a session", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const admin = await seedUser();
    await addMember(site.id, admin.id, "admin");
    const { userId } = await seedIdentified(site.id);
    expect((await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: admin.token, query: { user_id: userId } })).status).toBe(404);
    expect((await api("GET", `/api/v1/privacy/visitor/${site.id}`, { query: { user_id: userId } })).status).toBe(401);
    expect(await count("identity_aliases", site.id)).toBe(1);
  });
});
