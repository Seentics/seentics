/**
 * The AI routes with no model configured (the suite's default): what still works without a key,
 * what answers "unavailable", and who may read or change what. Rows a model run would have
 * written are seeded directly, so history, conversations, drafts, alerts and recommendations are
 * exercised end to end over HTTP against the real database.
 */
import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { ai, seedAnomaly, seedQuery, seedRecommendation } from "./helpers/ai";

async function siteWithOwner() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

async function memberOf(siteId: string, role: "viewer" | "member" | "admin") {
  const u = await seedUser();
  await addMember(siteId, u.id, role);
  return u;
}

describe("GET /ai/status", () => {
  it("says AI is not configured when no provider key is set", async () => {
    const u = await seedUser();
    const res = await api("GET", ai("/status"), { token: u.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { configured: false } });
  });

  it("requires a session", async () => {
    expect((await api("GET", ai("/status"))).status).toBe(401);
  });
});

describe("POST /ai/chat without a model", () => {
  it("answers 503 and records nothing", async () => {
    const { owner, site } = await siteWithOwner();
    const res = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "How many visitors this week?" } });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not set up/i);
    const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ai_queries WHERE website_id = ${site.id}`;
    expect(row!.n).toBe(0);
  });

  it("still declines an obviously off-topic question without needing a model", async () => {
    // The off-topic check runs before the model is consulted, so it answers even unconfigured.
    const { owner, site } = await siteWithOwner();
    const res = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "Write me a poem about cats" } });
    expect(res.status).toBe(200);
    expect(res.body.queryId).toBeNull();
    expect(res.body.answer).toMatch(/only help with your Seentics/);
  });

  it("validates the body before anything else", async () => {
    const { owner, site } = await siteWithOwner();
    const send = (body: unknown) => api("POST", ai(`/chat/${site.id}`), { token: owner.token, body });
    expect((await send({})).status).toBe(400);
    expect((await send({ prompt: "   " })).status).toBe(400);
    expect((await send({ prompt: "x".repeat(2001) })).status).toBe(400);
    expect((await send("{not json")).status).toBe(400);
  });

  it("refuses another account's site, and a site that does not exist", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("POST", ai(`/chat/${site.id}`), { token: stranger.token, body: { prompt: "visitors?" } })).status).toBe(403);
    expect((await api("POST", ai(`/chat/${randomUUID()}`), { token: stranger.token, body: { prompt: "visitors?" } })).status).toBe(403);
  });

  it("refuses an unauthenticated request", async () => {
    const { site } = await siteWithOwner();
    expect((await api("POST", ai(`/chat/${site.id}`), { body: { prompt: "visitors?" } })).status).toBe(401);
  });

  it("lets a viewer ask (and so reach the not-configured answer)", async () => {
    const { site } = await siteWithOwner();
    const viewer = await memberOf(site.id, "viewer");
    expect((await api("POST", ai(`/chat/${site.id}`), { token: viewer.token, body: { prompt: "visitors?" } })).status).toBe(503);
  });
});

describe("POST /ai/query without a model", () => {
  it("answers 503 for a valid question", async () => {
    const { owner, site } = await siteWithOwner();
    const res = await api("POST", ai(`/query/${site.id}`), { token: owner.token, body: { prompt: "Top pages", domain: "analytics" } });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not available/i);
  });

  it("rejects an empty or over-long prompt and an unknown domain", async () => {
    const { owner, site } = await siteWithOwner();
    const send = (body: unknown) => api("POST", ai(`/query/${site.id}`), { token: owner.token, body });
    expect((await send({ prompt: "" })).status).toBe(400);
    expect((await send({ prompt: "x".repeat(501) })).status).toBe(400);
    expect((await send({ prompt: "Top pages", domain: "billing" })).status).toBe(400);
  });

  it("refuses another account's site and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("POST", ai(`/query/${site.id}`), { token: stranger.token, body: { prompt: "Top pages" } })).status).toBe(403);
    expect((await api("POST", ai(`/query/${site.id}`), { body: { prompt: "Top pages" } })).status).toBe(401);
  });
});

describe("GET /ai/history", () => {
  it("lists only the caller's questions on this site, newest first", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    const teammate = await memberOf(site.id, "member");
    await seedQuery({ userId: owner.id, websiteId: site.id, prompt: "older", createdAt: new Date(Date.now() - 60_000) });
    await seedQuery({ userId: owner.id, websiteId: site.id, prompt: "newer" });
    await seedQuery({ userId: owner.id, websiteId: other.id, prompt: "other site" });
    await seedQuery({ userId: teammate.id, websiteId: site.id, prompt: "teammate's" });

    const res = await api("GET", ai(`/history/${site.id}`), { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { prompt: string }) => r.prompt)).toEqual(["newer", "older"]);
    // A teammate on the same site sees their own, not the owner's.
    const theirs = await api("GET", ai(`/history/${site.id}`), { token: teammate.token });
    expect(theirs.body.data.map((r: { prompt: string }) => r.prompt)).toEqual(["teammate's"]);
  });

  it("caps the limit at 20 whatever is asked", async () => {
    const { owner, site } = await siteWithOwner();
    for (let i = 0; i < 22; i++) await seedQuery({ userId: owner.id, websiteId: site.id, prompt: `q${i}` });
    const res = await api("GET", ai(`/history/${site.id}`), { token: owner.token, query: { limit: 500 } });
    expect(res.body.data).toHaveLength(20);
    const dflt = await api("GET", ai(`/history/${site.id}`), { token: owner.token, query: { limit: "abc" } });
    expect(dflt.body.data).toHaveLength(8);
  });

  it("refuses another account's site and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("GET", ai(`/history/${site.id}`), { token: stranger.token })).status).toBe(403);
    expect((await api("GET", ai(`/history/${site.id}`))).status).toBe(401);
  });
});

describe("conversations", () => {
  it("lists the caller's threads on the site, titled by their opening question", async () => {
    const { owner, site } = await siteWithOwner();
    const conv = randomUUID();
    await seedQuery({ userId: owner.id, websiteId: site.id, conversationId: conv, prompt: "first", answer: "a", createdAt: new Date(Date.now() - 60_000) });
    await seedQuery({ userId: owner.id, websiteId: site.id, conversationId: conv, prompt: "second", answer: "b" });
    // A single-shot query has no conversation and is not a thread.
    await seedQuery({ userId: owner.id, websiteId: site.id, prompt: "sql" });

    const res = await api("GET", ai(`/conversations/${site.id}`), { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([
      expect.objectContaining({ id: conv, title: "first", messageCount: 2 }),
    ]);
  });

  it("reads one conversation in order, and only for its owner", async () => {
    const { owner, site } = await siteWithOwner();
    const teammate = await memberOf(site.id, "admin");
    const conv = randomUUID();
    await seedQuery({ userId: owner.id, websiteId: site.id, conversationId: conv, prompt: "first", answer: "a", createdAt: new Date(Date.now() - 60_000) });
    await seedQuery({ userId: owner.id, websiteId: site.id, conversationId: conv, prompt: "second", answer: "b" });

    const mine = await api("GET", ai(`/conversation/${site.id}/${conv}`), { token: owner.token });
    expect(mine.status).toBe(200);
    expect(mine.body.turns.map((t: { prompt: string }) => t.prompt)).toEqual(["first", "second"]);

    // Even an admin of the same site cannot read someone else's thread by its id.
    const theirs = await api("GET", ai(`/conversation/${site.id}/${conv}`), { token: teammate.token });
    expect(theirs.status).toBe(200);
    expect(theirs.body.turns).toEqual([]);
    expect((await api("GET", ai(`/conversations/${site.id}`), { token: teammate.token })).body.conversations).toEqual([]);
  });

  it("refuses another account's site", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("GET", ai(`/conversations/${site.id}`), { token: stranger.token })).status).toBe(403);
    expect((await api("GET", ai(`/conversation/${site.id}/${randomUUID()}`), { token: stranger.token })).status).toBe(403);
  });
});

describe("POST /ai/confirm — applying a stored draft", () => {
  const goalDraft = (payload: unknown = { name: "Signed up", type: "pageview", identifier: "welcome" }) => ({
    resource: "goal", operation: "create", payload, summary: { title: "Track sign-ups" },
  });

  it("creates the goal from the stored payload and marks the draft applied", async () => {
    const { owner, site } = await siteWithOwner();
    const q = await seedQuery({ userId: owner.id, websiteId: site.id, proposal: goalDraft() });
    // The request body is ignored: only the stored payload is applied.
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: owner.token, body: { payload: { name: "evil" } } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, operation: "create", created: { resource: "goal" } });
    const goals = await sql<{ id: string; name: string; identifier: string }[]>`SELECT id::text, name, identifier FROM goals WHERE website_id = ${site.id}::uuid`;
    expect([...goals]).toEqual([{ id: res.body.created.id, name: "Signed up", identifier: "/welcome" }]);
    const [row] = await sql<{ at: Date | null }[]>`SELECT proposal_applied_at AS at FROM ai_queries WHERE id = ${q}::uuid`;
    expect(row!.at).not.toBeNull();

    // A second confirm finds nothing pending: no double create.
    const again = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: owner.token });
    expect(again.status).toBe(404);
    expect(again.body.code).toBe("gone");
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM goals WHERE website_id = ${site.id}::uuid`;
    expect(n!.n).toBe(1);
  });

  it("refuses a viewer before reading the draft", async () => {
    const { site } = await siteWithOwner();
    const viewer = await memberOf(site.id, "viewer");
    const q = await seedQuery({ userId: viewer.id, websiteId: site.id, proposal: goalDraft() });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: viewer.token });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Viewers cannot confirm/);
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM goals WHERE website_id = ${site.id}::uuid`;
    expect(n!.n).toBe(0);
  });

  it("refuses a member confirming a settings change, which needs an admin", async () => {
    const { site } = await siteWithOwner();
    const member = await memberOf(site.id, "member");
    const [w] = await sql<{ v: Date }[]>`SELECT updated_at AS v FROM websites WHERE id = ${site.id}::uuid`;
    const q = await seedQuery({
      userId: member.id, websiteId: site.id,
      proposal: { resource: "site_settings", operation: "update", target: { id: site.id, version: new Date(w!.v).toISOString() }, payload: { replay_enabled: false } },
    });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: member.token });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "forbidden" });
    const [after] = await sql<{ replay_enabled: boolean }[]>`SELECT replay_enabled FROM websites WHERE id = ${site.id}::uuid`;
    expect(after!.replay_enabled).toBe(true);
  });

  it("applies a settings change for an admin at the current version", async () => {
    const { site } = await siteWithOwner();
    const admin = await memberOf(site.id, "admin");
    const [w] = await sql<{ v: Date }[]>`SELECT updated_at AS v FROM websites WHERE id = ${site.id}::uuid`;
    const q = await seedQuery({
      userId: admin.id, websiteId: site.id,
      proposal: { resource: "site_settings", operation: "update", target: { id: site.id, version: new Date(w!.v).toISOString() }, payload: { replay_enabled: false } },
    });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: admin.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, operation: "update", created: { resource: "site_settings", id: site.id } });
    const [after] = await sql<{ replay_enabled: boolean }[]>`SELECT replay_enabled FROM websites WHERE id = ${site.id}::uuid`;
    expect(after!.replay_enabled).toBe(false);
  });

  it("answers 409 for a draft made against an older version, and leaves it confirmable", async () => {
    const { owner, site } = await siteWithOwner();
    const [goal] = await sql<{ id: string }[]>`
      INSERT INTO goals (website_id, name, type, identifier) VALUES (${site.id}::uuid, 'Old', 'pageview', '/a') RETURNING id::text`;
    const q = await seedQuery({
      userId: owner.id, websiteId: site.id,
      proposal: { resource: "goal", operation: "update", target: { id: goal!.id, version: "2000-01-01T00:00:00.000Z" }, payload: { name: "New" } },
    });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: owner.token });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("stale");
    expect(res.body.error).toMatch(/out of date/);
    const [g] = await sql<{ name: string }[]>`SELECT name FROM goals WHERE id = ${goal!.id}::uuid`;
    expect(g!.name).toBe("Old");
    // The claim was released, so a fresh draft path is not blocked.
    const [row] = await sql<{ at: Date | null }[]>`SELECT proposal_applied_at AS at FROM ai_queries WHERE id = ${q}::uuid`;
    expect(row!.at).toBeNull();
  });

  it("answers 404 when the draft's target is gone from this website", async () => {
    const { owner, site } = await siteWithOwner();
    const q = await seedQuery({
      userId: owner.id, websiteId: site.id,
      proposal: { resource: "goal", operation: "update", target: { id: randomUUID(), version: "v" }, payload: { name: "New" } },
    });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: owner.token });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("gone");
  });

  it("will not apply a draft to a different website than it was made for", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    const q = await seedQuery({ userId: owner.id, websiteId: other.id, proposal: goalDraft() });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: owner.token });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different website/);
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM goals WHERE website_id IN (${site.id}::uuid, ${other.id}::uuid)`;
    expect(n!.n).toBe(0);
  });

  it("will not apply someone else's draft, even on a shared site", async () => {
    const { owner, site } = await siteWithOwner();
    const admin = await memberOf(site.id, "admin");
    const q = await seedQuery({ userId: owner.id, websiteId: site.id, proposal: goalDraft() });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: admin.token });
    expect(res.status).toBe(404);
  });

  it("returns the writer's own refusal as a plain message and releases the claim", async () => {
    const { owner, site } = await siteWithOwner();
    const q = await seedQuery({ userId: owner.id, websiteId: site.id, proposal: goalDraft({ name: "x", type: "click", identifier: "#b" }) });
    const res = await api("POST", ai(`/confirm/${site.id}/${q}`), { token: owner.token });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/The approved goal is not valid: type must be one of pageview, event/);
    const [row] = await sql<{ at: Date | null }[]>`SELECT proposal_applied_at AS at FROM ai_queries WHERE id = ${q}::uuid`;
    expect(row!.at).toBeNull();
  });

  it("refuses an unsupported resource or operation", async () => {
    const { owner, site } = await siteWithOwner();
    const q1 = await seedQuery({ userId: owner.id, websiteId: site.id, proposal: { resource: "users", operation: "create", payload: {} } });
    const q2 = await seedQuery({ userId: owner.id, websiteId: site.id, proposal: { resource: "goal", operation: "delete", payload: {} } });
    const r1 = await api("POST", ai(`/confirm/${site.id}/${q1}`), { token: owner.token });
    const r2 = await api("POST", ai(`/confirm/${site.id}/${q2}`), { token: owner.token });
    expect(r1.status).toBe(400);
    expect(r1.body.error).toMatch(/Unsupported change/);
    expect(r2.status).toBe(400);
    expect(r2.body.error).toMatch(/Unsupported operation/);
  });

  it("keeps database errors out of the response", async () => {
    // A query id that is not a UUID fails inside Postgres; the reply must not quote it.
    const { owner, site } = await siteWithOwner();
    const res = await api("POST", ai(`/confirm/${site.id}/not-a-uuid`), { token: owner.token });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Could not apply the proposal" });
    expect(res.text).not.toMatch(/uuid|syntax|select|ai_queries/i);
  });

  it("refuses another account's site and an anonymous caller", async () => {
    const { owner, site } = await siteWithOwner();
    const stranger = await seedUser();
    const q = await seedQuery({ userId: owner.id, websiteId: site.id, proposal: goalDraft() });
    expect((await api("POST", ai(`/confirm/${site.id}/${q}`), { token: stranger.token })).status).toBe(403);
    expect((await api("POST", ai(`/confirm/${site.id}/${q}`))).status).toBe(401);
  });
});

describe("insights", () => {
  it("writes today's insight on first read, from the data alone without a model", async () => {
    const { owner, site } = await siteWithOwner();
    const res = await api("GET", ai(`/insights/${site.id}`), { token: owner.token });
    expect(res.status).toBe(200);
    // A brand-new site has too few visitors to say anything.
    expect(res.body.data).toMatchObject({ status: "insufficient_data", source: "rules", lines: [] });
    const rows = await sql<{ status: string; model: string | null }[]>`SELECT status, model FROM ai_insights WHERE website_id = ${site.id}::uuid`;
    expect([...rows]).toEqual([{ status: "insufficient_data", model: null }]);
  });

  it("lets a viewer read but not refresh", async () => {
    const { site } = await siteWithOwner();
    const viewer = await memberOf(site.id, "viewer");
    expect((await api("GET", ai(`/insights/${site.id}`), { token: viewer.token })).status).toBe(200);
    expect((await api("POST", ai(`/insights/${site.id}/refresh`), { token: viewer.token })).status).toBe(403);
  });

  it("refreshes for a member, then holds further refreshes back with Retry-After", async () => {
    const { site } = await siteWithOwner();
    const member = await memberOf(site.id, "member");
    const first = await api("POST", ai(`/insights/${site.id}/refresh`), { token: member.token });
    expect(first.status).toBe(200);
    expect(first.body.refreshed).toBe(true);
    const second = await api("POST", ai(`/insights/${site.id}/refresh`), { token: member.token });
    expect(second.status).toBe(200);
    expect(second.body.refreshed).toBe(false);
    expect(second.body.retryAfterSec).toBeGreaterThan(5 * 3600);
    expect(Number(second.headers.get("Retry-After"))).toBe(second.body.retryAfterSec);
  });

  it("rejects a malformed id, another account's site and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("GET", ai(`/insights/not-a-uuid`), { token: stranger.token })).status).toBe(400);
    expect((await api("GET", ai(`/insights/${site.id}`), { token: stranger.token })).status).toBe(403);
    expect((await api("POST", ai(`/insights/${site.id}/refresh`), { token: stranger.token })).status).toBe(403);
    expect((await api("GET", ai(`/insights/${site.id}`))).status).toBe(401);
  });
});

describe("anomaly alerts", () => {
  it("lists only this site's alerts, with the open filter, and who may manage them", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    const open = await seedAnomaly(site.id, { status: "open" });
    const resolved = await seedAnomaly(site.id, { status: "resolved", type: "error_spike" });
    await seedAnomaly(other.id);

    const all = await api("GET", ai(`/alerts/${site.id}`), { token: owner.token });
    expect(all.status).toBe(200);
    expect(all.body.data.alerts.map((a: { id: string }) => a.id).sort()).toEqual([open, resolved].sort());
    expect(all.body.data.settings).toMatchObject({ enabled: true, sensitivity: "normal" });
    expect(all.body.data.canManage).toBe(true);

    const onlyOpen = await api("GET", ai(`/alerts/${site.id}`), { token: owner.token, query: { status: "open" } });
    expect(onlyOpen.body.data.alerts.map((a: { id: string }) => a.id)).toEqual([open]);
  });

  it("lets any member read the settings, flagged as not manageable below admin", async () => {
    const { site } = await siteWithOwner();
    const viewer = await memberOf(site.id, "viewer");
    const res = await api("GET", ai(`/alerts/${site.id}/settings`), { token: viewer.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ enabled: true, sensitivity: "normal", canManage: false });
  });

  it("saves settings for an admin, and turning alerts off resolves what is open", async () => {
    const { site } = await siteWithOwner();
    const admin = await memberOf(site.id, "admin");
    const open = await seedAnomaly(site.id);
    const res = await api("PUT", ai(`/alerts/${site.id}/settings`), { token: admin.token, body: { enabled: false, sensitivity: "high" } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ enabled: false, sensitivity: "high", canManage: true });
    const [row] = await sql<{ enabled: boolean; sensitivity: string; updated_by: string }[]>`
      SELECT enabled, sensitivity, updated_by::text FROM ai_anomaly_settings WHERE website_id = ${site.id}::uuid`;
    expect(row).toEqual({ enabled: false, sensitivity: "high", updated_by: admin.id });
    const [a] = await sql<{ status: string }[]>`SELECT status FROM ai_anomalies WHERE id = ${open}::uuid`;
    expect(a!.status).toBe("resolved");
  });

  it("keeps a partial update's other field", async () => {
    const { owner, site } = await siteWithOwner();
    await api("PUT", ai(`/alerts/${site.id}/settings`), { token: owner.token, body: { sensitivity: "low" } });
    const res = await api("PUT", ai(`/alerts/${site.id}/settings`), { token: owner.token, body: { enabled: true } });
    expect(res.body.data).toMatchObject({ enabled: true, sensitivity: "low" });
  });

  it("refuses members and viewers changing settings", async () => {
    const { site } = await siteWithOwner();
    for (const role of ["viewer", "member"] as const) {
      const u = await memberOf(site.id, role);
      const res = await api("PUT", ai(`/alerts/${site.id}/settings`), { token: u.token, body: { enabled: false } });
      expect(res.status).toBe(403);
    }
    const rows = await sql`SELECT 1 FROM ai_anomaly_settings WHERE website_id = ${site.id}::uuid`;
    expect(rows).toHaveLength(0);
  });

  it("validates the settings body", async () => {
    const { owner, site } = await siteWithOwner();
    const put = (body: unknown) => api("PUT", ai(`/alerts/${site.id}/settings`), { token: owner.token, body });
    expect((await put({})).status).toBe(400);
    expect((await put({ sensitivity: "extreme" })).status).toBe(400);
    expect((await put({ enabled: "yes" })).status).toBe(400);
    expect((await put({ enabled: true, extra: 1 })).status).toBe(400);
    expect((await put("nope")).status).toBe(400);
  });

  it("rejects a malformed id, another account's site and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("GET", ai(`/alerts/bad-id`), { token: stranger.token })).status).toBe(400);
    expect((await api("GET", ai(`/alerts/${site.id}`), { token: stranger.token })).status).toBe(403);
    expect((await api("PUT", ai(`/alerts/${site.id}/settings`), { token: stranger.token, body: { enabled: false } })).status).toBe(403);
    expect((await api("GET", ai(`/alerts/${site.id}/settings`))).status).toBe(401);
  });
});

describe("recommendations", () => {
  it("lists this site's suggestions without internal bookkeeping", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    const mine = await seedRecommendation(site.id);
    await seedRecommendation(other.id);
    const res = await api("GET", ai(`/recommendations/${site.id}`), { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([mine]);
    const r = res.body.data[0];
    expect(r).toMatchObject({ source: "insight", status: "open", title: "Fix the pricing page" });
    for (const hidden of ["dedupeKey", "dedupe_key", "queryId", "query_id", "appliedBy", "baseline"]) expect(r).not.toHaveProperty(hidden);
  });

  it("filters by status and rejects an unknown one", async () => {
    const { owner, site } = await siteWithOwner();
    const open = await seedRecommendation(site.id);
    await seedRecommendation(site.id, { status: "dismissed" });
    const res = await api("GET", ai(`/recommendations/${site.id}`), { token: owner.token, query: { status: "open" } });
    expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([open]);
    expect((await api("GET", ai(`/recommendations/${site.id}`), { token: owner.token, query: { status: "open,bogus" } })).status).toBe(400);
  });

  it("reads one, and not another site's by id", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    const mine = await seedRecommendation(site.id);
    const theirs = await seedRecommendation(other.id);
    expect((await api("GET", ai(`/recommendations/${site.id}/${mine}`), { token: owner.token })).body.data.id).toBe(mine);
    expect((await api("GET", ai(`/recommendations/${site.id}/${theirs}`), { token: owner.token })).status).toBe(404);
    expect((await api("GET", ai(`/recommendations/${site.id}/not-a-uuid`), { token: owner.token })).status).toBe(404);
  });

  it("dismisses an open suggestion once; a second dismiss is a conflict", async () => {
    const { site } = await siteWithOwner();
    const member = await memberOf(site.id, "member");
    const id = await seedRecommendation(site.id);
    const res = await api("POST", ai(`/recommendations/${site.id}/${id}/dismiss`), { token: member.token });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("dismissed");
    expect((await api("POST", ai(`/recommendations/${site.id}/${id}/dismiss`), { token: member.token })).status).toBe(409);
    const [row] = await sql<{ status: string }[]>`SELECT status FROM ai_recommendations WHERE id = ${id}::uuid`;
    expect(row!.status).toBe("dismissed");
  });

  it("marks one done by hand, recording who applied it", async () => {
    const { owner, site } = await siteWithOwner();
    const id = await seedRecommendation(site.id);
    const res = await api("POST", ai(`/recommendations/${site.id}/${id}/done`), { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "applied", appliedVia: "manual", resource: null });
    expect(res.body.data.appliedAt).toBeTruthy();
    const [row] = await sql<{ applied_by: string; applied_via: string }[]>`
      SELECT applied_by::text, applied_via FROM ai_recommendations WHERE id = ${id}::uuid`;
    expect(row).toEqual({ applied_by: owner.id, applied_via: "manual" });
    expect((await api("POST", ai(`/recommendations/${site.id}/${id}/done`), { token: owner.token })).status).toBe(409);
  });

  it("will not act on another site's suggestion through this site's URL", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    const theirs = await seedRecommendation(other.id);
    expect((await api("POST", ai(`/recommendations/${site.id}/${theirs}/dismiss`), { token: owner.token })).status).toBe(409);
    const [row] = await sql<{ status: string }[]>`SELECT status FROM ai_recommendations WHERE id = ${theirs}::uuid`;
    expect(row!.status).toBe("open");
  });

  it("lets a viewer read but not dismiss or mark done", async () => {
    const { site } = await siteWithOwner();
    const viewer = await memberOf(site.id, "viewer");
    const id = await seedRecommendation(site.id);
    expect((await api("GET", ai(`/recommendations/${site.id}`), { token: viewer.token })).status).toBe(200);
    expect((await api("POST", ai(`/recommendations/${site.id}/${id}/dismiss`), { token: viewer.token })).status).toBe(403);
    expect((await api("POST", ai(`/recommendations/${site.id}/${id}/done`), { token: viewer.token })).status).toBe(403);
    const [row] = await sql<{ status: string }[]>`SELECT status FROM ai_recommendations WHERE id = ${id}::uuid`;
    expect(row!.status).toBe("open");
  });

  it("rejects a malformed id, another account's site and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    const stranger = await seedUser();
    const id = await seedRecommendation(site.id);
    expect((await api("GET", ai(`/recommendations/bad`), { token: stranger.token })).status).toBe(400);
    expect((await api("GET", ai(`/recommendations/${site.id}`), { token: stranger.token })).status).toBe(403);
    expect((await api("POST", ai(`/recommendations/${site.id}/${id}/dismiss`), { token: stranger.token })).status).toBe(403);
    expect((await api("GET", ai(`/recommendations/${site.id}`))).status).toBe(401);
  });
});
