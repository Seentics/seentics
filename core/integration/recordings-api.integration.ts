import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { addMember, api, application, buckets, listKeys, seedUser, seedWebsite, sql, type SeededWebsite } from "./harness";
import { collect, eventually, flushIngest, MOBILE_UA, rrwebSession, sid } from "./helpers/recordings";

setDefaultTimeout(30_000);

const prefix = (site: SeededWebsite, sessionId: string) => `sessions/${site.id}/${sessionId}/`;

async function sessionRows(site: SeededWebsite) {
  return sql<{ session_id: string; sequence: number }[]>`
    SELECT session_id, sequence FROM session_replays WHERE website_id = ${site.id} ORDER BY session_id`;
}

/** Record sessions through the tracker and wait until each has its metadata row. */
async function record(
  site: SeededWebsite,
  sessions: { id?: string; ua?: string; errors?: boolean; rage?: boolean; path?: string; start?: number }[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const s of sessions) {
    const id = s.id ?? sid();
    ids.push(id);
    const url = `https://${site.domain}${s.path ?? "/"}`;
    const events: Record<string, unknown>[] = rrwebSession(id, url, {
      start: s.start,
      clicks: s.rage ? [{ x: 100, y: 100, dt: 100 }, { x: 101, y: 101, dt: 200 }, { x: 102, y: 99, dt: 300 }] : [],
    });
    if (s.errors) events.push({ type: "session_error", ts: Date.now() - 30_000, url, sid: id, data: { message: "boom" } });
    const res = await collect(site, { session: events }, { ua: s.ua });
    expect(res.status).toBe(200);
  }
  await eventually(async () => {
    const rows = await sql`SELECT 1 FROM session_replays WHERE website_id = ${site.id} AND sequence = 0 AND session_id = ANY(${ids})`;
    return rows.length === ids.length;
  });
  return ids;
}

async function seedAnalysis(site: SeededWebsite, sessionId: string, score: number, counts: Record<string, number> = {}) {
  await sql`INSERT INTO session_analyses (website_id, session_id, started_at, status, frustration_score, signal_counts)
            VALUES (${site.id}, ${sessionId}, now(), 'ready', ${score}, ${JSON.stringify(counts)}::jsonb)`;
}

async function siteWithOwner() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

describe("recording ingest", () => {
  it("stores a tracker session as a chunk in the replay bucket and a metadata row", async () => {
    const { site } = await siteWithOwner();
    const [id] = await record(site, [{ rage: true, path: "/pricing" }]);

    const keys = await listKeys(buckets.replays(), prefix(site, id!));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/chunk-0+-[a-f0-9]{32}\.json\.gz$/);
    // Recordings never land in the heatmap bucket.
    expect(await listKeys(buckets.heatmaps(), `sessions/${site.id}/`)).toEqual([]);

    const [row] = await sql`SELECT * FROM session_replays WHERE website_id = ${site.id} AND session_id = ${id!}`;
    expect(row!.sequence).toBe(0);
    expect(row!.has_rage_clicks).toBe(true);
    expect(row!.entry_page).toBe(`https://${site.domain}/pricing`);
    expect(row!.browser).toContain("Chrome");
  });

  it("keeps two sites' sessions apart when they send the same session id", async () => {
    // The id is the client's to choose; keyed on it alone, one site's events were filed under the other.
    const a = await siteWithOwner();
    const b = await siteWithOwner();
    const shared = sid();
    await record(a.site, [{ id: shared, path: "/from-a" }]);
    await record(b.site, [{ id: shared, path: "/from-b" }]);

    expect(await listKeys(buckets.replays(), prefix(a.site, shared))).toHaveLength(1);
    expect(await listKeys(buckets.replays(), prefix(b.site, shared))).toHaveLength(1);
    const detailA = await api("GET", `/api/v1/replays/${a.site.id}/${shared}`, { token: a.owner.token });
    expect(detailA.body.meta.entryPage).toBe(`https://${a.site.domain}/from-a`);
    const detailB = await api("GET", `/api/v1/replays/${b.site.id}/${shared}`, { token: b.owner.token });
    expect(detailB.body.meta.entryPage).toBe(`https://${b.site.domain}/from-b`);

    // Deleting it on one site leaves the other's recording.
    await api("DELETE", `/api/v1/replays/${a.site.id}/batch`, { token: a.owner.token, body: { sessionIds: [shared] } });
    expect(await listKeys(buckets.replays(), prefix(b.site, shared))).toHaveLength(1);
    expect(await sessionRows(b.site)).toHaveLength(1);
  });

  it("drops events whose session id could reach into another storage path", async () => {
    const { site } = await siteWithOwner();
    const good = sid();
    const url = `https://${site.domain}/`;
    const bad = ["../escape", "a/b", "..", `${good}/../x`];
    const events = [good, ...bad].flatMap((id) => rrwebSession(id, url));

    expect((await collect(site, { session: events })).status).toBe(200);
    await eventually(async () => (await sessionRows(site)).length > 0);

    expect((await sessionRows(site)).map((r) => r.session_id)).toEqual([good]);
    const keys = await listKeys(buckets.replays(), `sessions/${site.id}/`);
    expect(keys.every((k) => k.startsWith(prefix(site, good)))).toBe(true);
    expect(await listKeys(buckets.replays(), "sessions/escape")).toEqual([]);
  });

  it("stores nothing when the site has replay switched off", async () => {
    const { site } = await siteWithOwner();
    await sql`UPDATE websites SET replay_enabled = false WHERE id = ${site.id}::uuid`;
    const id = sid();
    await collect(site, { session: rrwebSession(id, `https://${site.domain}/`) });
    await flushIngest();
    expect(await sessionRows(site)).toHaveLength(0);
    expect(await listKeys(buckets.replays(), prefix(site, id))).toEqual([]);
  });
});

describe("GET /api/v1/replays/:website_id", () => {
  it("lists the site's sessions with totals for the whole set", async () => {
    const { owner, site } = await siteWithOwner();
    await record(site, [{ errors: true }, { rage: true }, {}]);

    const res = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(3);
    expect(res.body.total).toBe(3);
    expect(res.body.summary).toMatchObject({ total: 3, withErrors: 1, withRageClicks: 1 });
    expect(res.body.sessions[0]).toHaveProperty("frustrationScore", null);
  });

  it("requires a signed-in user", async () => {
    const { site } = await siteWithOwner();
    expect((await api("GET", `/api/v1/replays/${site.id}`)).status).toBe(401);
  });

  it("refuses another account's site", async () => {
    const { site } = await siteWithOwner();
    await record(site, [{}]);
    const stranger = await seedUser();
    const res = await api("GET", `/api/v1/replays/${site.id}`, { token: stranger.token });
    expect(res.status).toBe(403);
    expect(res.body.sessions).toBeUndefined();
  });

  it("lets a viewer read the list", async () => {
    const { site } = await siteWithOwner();
    await record(site, [{}]);
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const res = await api("GET", `/api/v1/replays/${site.id}`, { token: viewer.token });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("filters by device, errors, rage clicks and search, with totals that follow the filter", async () => {
    const { owner, site } = await siteWithOwner();
    const [mobile, withErrors, rage] = await record(site, [{ ua: MOBILE_UA }, { errors: true }, { rage: true }]);
    const list = async (query: Record<string, string>) =>
      (await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query })).body;

    const byDevice = await list({ device: "mobile" });
    expect(byDevice.sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual([mobile]);
    expect(byDevice.total).toBe(1);
    expect((await list({ has_errors: "1" })).sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual([withErrors]);
    expect((await list({ has_rage_clicks: "true" })).sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual([rage]);
    expect((await list({ search: rage!.slice(0, 12) })).sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual([rage]);
    // `%` is a literal character in a search, not a wildcard that matches everything.
    expect((await list({ search: "%" })).total).toBe(0);
  });

  it("pages through sessions newest first while the total counts them all", async () => {
    const { owner, site } = await siteWithOwner();
    const now = Date.now();
    const ids = await record(site, [0, 1, 2, 3, 4].map((i) => ({ start: now - (10 - i) * 60_000 })));
    const newestFirst = [...ids].reverse();

    const page1 = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query: { limit: 2, offset: 0 } });
    const page3 = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query: { limit: 2, offset: 4 } });

    expect(page1.body.sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual(newestFirst.slice(0, 2));
    expect(page3.body.sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual(newestFirst.slice(4));
    expect(page1.body.total).toBe(5);
    expect(page1.body).toMatchObject({ limit: 2, offset: 0 });
  });

  it("sorts by frustration worst first, unanalysed sessions last, and filters on score and signal", async () => {
    const { owner, site } = await siteWithOwner();
    const [calm, worst, none, mid] = await record(site, [{}, {}, {}, {}]);
    await seedAnalysis(site, calm!, 5);
    await seedAnalysis(site, worst!, 90, { rage_click: 2 });
    await seedAnalysis(site, mid!, 40, { dead_click: 1 });

    const sorted = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query: { sort: "frustration" } });
    expect(sorted.body.sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual([worst, mid, calm, none]);
    expect(sorted.body.sessions[0]).toMatchObject({ frustrationScore: 90, signalCounts: { rage_click: 2 } });

    const atLeast = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query: { min_frustration: 40 } });
    expect(atLeast.body.sessions.map((s: { sessionId: string }) => s.sessionId).sort()).toEqual([worst, mid].sort());
    const dead = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query: { signal: "dead_click" } });
    expect(dead.body.sessions.map((s: { sessionId: string }) => s.sessionId)).toEqual([mid]);
  });

  it("rejects malformed list queries", async () => {
    const { owner, site } = await siteWithOwner();
    for (const query of <Record<string, string | number>[]>[{ limit: 0 }, { limit: 201 }, { offset: -1 }, { device: "tv" }, { sort: "oldest" }, { has_errors: "yes" }, { min_frustration: 0 }, { signal: "sneeze" }, { search: "x".repeat(129) }]) {
      const res = await api("GET", `/api/v1/replays/${site.id}`, { token: owner.token, query });
      expect({ query, status: res.status }).toEqual({ query, status: 400 });
    }
  });
});

describe("GET /api/v1/replays/:website_id/:session_id", () => {
  it("returns the metadata and a signed URL per stored chunk", async () => {
    const { owner, site } = await siteWithOwner();
    const [id] = await record(site, [{ errors: true }]);
    // A second batch for the same session is a second chunk, in sequence.
    await collect(site, { session: rrwebSession(id!, `https://${site.domain}/next`, { start: Date.now() - 10_000 }) });
    await eventually(async () => (await listKeys(buckets.replays(), prefix(site, id!))).length === 2);

    const res = await api("GET", `/api/v1/replays/${site.id}/${id}`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ session_id: id, replay_storage: "chunks", replay_chunk_count: 2, recording_pending: false });
    expect(res.body.meta).toMatchObject({ sessionId: id, hasErrors: true });
    expect(res.body.replay_chunk_urls.map((c: { sequence: number }) => c.sequence)).toEqual([0, 1]);
    expect(res.body.replay_chunk_urls[0].url).toContain(`sessions/${site.id}/${id}/chunk-`);
    expect(typeof res.body.stylesheet_token).toBe("string");
  });

  it("answers 404 for a session the site never recorded", async () => {
    const { owner, site } = await siteWithOwner();
    const res = await api("GET", `/api/v1/replays/${site.id}/${sid()}`, { token: owner.token });
    expect(res.status).toBe(404);
  });

  it("does not serve another site's session through a site the caller owns", async () => {
    const victim = await siteWithOwner();
    const [id] = await record(victim.site, [{}]);
    const attacker = await siteWithOwner();

    expect((await api("GET", `/api/v1/replays/${victim.site.id}/${id}`, { token: attacker.owner.token })).status).toBe(403);
    expect((await api("GET", `/api/v1/replays/${attacker.site.id}/${id}`, { token: attacker.owner.token })).status).toBe(404);
  });

  it("requires a signed-in user", async () => {
    const { site } = await siteWithOwner();
    expect((await api("GET", `/api/v1/replays/${site.id}/${sid()}`)).status).toBe(401);
  });
});

describe("GET /api/v1/replays/:website_id/:session_id/analysis", () => {
  it("returns stored signals without writing a summary when asked not to", async () => {
    const { owner, site } = await siteWithOwner();
    const [id] = await record(site, [{}]);
    const res = await api("GET", `/api/v1/replays/${site.id}/${id}/analysis`, { token: owner.token, query: { summarize: 0 } });
    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe(id);
    expect(["ready", "pending"]).toContain(res.body.data.status);
  });

  it("answers 404 for an unknown session and 403 for a stranger", async () => {
    const { owner, site } = await siteWithOwner();
    const stranger = await seedUser();
    expect((await api("GET", `/api/v1/replays/${site.id}/${sid()}/analysis`, { token: owner.token, query: { summarize: 0 } })).status).toBe(404);
    expect((await api("GET", `/api/v1/replays/${site.id}/${sid()}/analysis`, { token: stranger.token })).status).toBe(403);
  });

  it("rejects an unrecognised summarize flag", async () => {
    const { owner, site } = await siteWithOwner();
    const res = await api("GET", `/api/v1/replays/${site.id}/${sid()}/analysis`, { token: owner.token, query: { summarize: "maybe" } });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/v1/replays/:website_id/batch", () => {
  it("removes the sessions' rows, stored chunks and analyses, and nothing else", async () => {
    const { owner, site } = await siteWithOwner();
    const [gone, kept] = await record(site, [{}, {}]);
    await seedAnalysis(site, gone!, 50);
    await seedAnalysis(site, kept!, 10);

    const res = await api("DELETE", `/api/v1/replays/${site.id}/batch`, { token: owner.token, body: { sessionIds: [gone] } });

    expect(res.status).toBe(200);
    expect((await sessionRows(site)).map((r) => r.session_id)).toEqual([kept!]);
    expect(await listKeys(buckets.replays(), prefix(site, gone!))).toEqual([]);
    expect(await listKeys(buckets.replays(), prefix(site, kept!))).toHaveLength(1);
    const analyses = await sql<{ session_id: string }[]>`SELECT session_id FROM session_analyses WHERE website_id = ${site.id}`;
    expect(analyses.map((a) => a.session_id)).toEqual([kept!]);
  });

  it("lets a member delete but not a viewer", async () => {
    const { site } = await siteWithOwner();
    const [a, b] = await record(site, [{}, {}]);
    const viewer = await seedUser();
    const member = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");

    const denied = await api("DELETE", `/api/v1/replays/${site.id}/batch`, { token: viewer.token, body: { sessionIds: [a] } });
    expect(denied.status).toBe(403);
    expect(await sessionRows(site)).toHaveLength(2);

    const allowed = await api("DELETE", `/api/v1/replays/${site.id}/batch`, { token: member.token, body: { sessionIds: [a, b] } });
    expect(allowed.status).toBe(200);
    expect(await sessionRows(site)).toHaveLength(0);
  });

  it("refuses another account's site and leaves its recordings", async () => {
    const { site } = await siteWithOwner();
    const [id] = await record(site, [{}]);
    const stranger = await seedUser();
    const res = await api("DELETE", `/api/v1/replays/${site.id}/batch`, { token: stranger.token, body: { sessionIds: [id] } });
    expect(res.status).toBe(403);
    expect(await listKeys(buckets.replays(), prefix(site, id!))).toHaveLength(1);
  });

  it("requires a signed-in user", async () => {
    const { site } = await siteWithOwner();
    expect((await api("DELETE", `/api/v1/replays/${site.id}/batch`, { body: { sessionIds: ["x"] } })).status).toBe(401);
  });

  it("rejects an empty, oversized or malformed list", async () => {
    const { owner, site } = await siteWithOwner();
    for (const body of [{}, { sessionIds: [] }, { sessionIds: [""] }, { sessionIds: ["x".repeat(129)] }, { sessionIds: Array.from({ length: 501 }, (_, i) => `s${i}`) }, { sessionIds: "abc" }]) {
      const res = await api("DELETE", `/api/v1/replays/${site.id}/batch`, { token: owner.token, body });
      expect(res.status).toBe(400);
    }
  });
});

describe("recording retention", () => {
  const purge = (site: SeededWebsite, replayCutoff: Date) =>
    application().modules.recordings.retention.purge(
      { websiteId: site.id },
      { analytics: replayCutoff, funnelAutomation: replayCutoff, replay: replayCutoff, heatmap: replayCutoff },
      { batchSize: 1, bucket: buckets.replays(), heatmapBucket: buckets.heatmaps() } as never,
    );

  it("deletes sessions older than the cutoff with their chunks and analyses, and keeps newer ones", async () => {
    const { site } = await siteWithOwner();
    const [old1, old2, fresh] = await record(site, [{}, {}, {}]);
    await seedAnalysis(site, old1!, 30);
    await seedAnalysis(site, fresh!, 30);
    await sql`UPDATE session_replays SET timestamp = now() - interval '40 days'
              WHERE website_id = ${site.id} AND session_id = ANY(${[old1!, old2!]})`;

    // Batch size 1: the sweep has to page to reach both old sessions.
    const result = await purge(site, new Date(Date.now() - 30 * 86_400_000));

    expect(result.replaySessionsPurged).toBe(2);
    expect(result.replayStorageDeleteFailures).toBe(0);
    expect((await sessionRows(site)).map((r) => r.session_id)).toEqual([fresh!]);
    for (const id of [old1!, old2!]) expect(await listKeys(buckets.replays(), prefix(site, id))).toEqual([]);
    expect(await listKeys(buckets.replays(), prefix(site, fresh!))).toHaveLength(1);
    const analyses = await sql<{ session_id: string }[]>`SELECT session_id FROM session_analyses WHERE website_id = ${site.id}`;
    expect(analyses.map((a) => a.session_id)).toEqual([fresh!]);
  });

  it("only touches the site it was asked to purge", async () => {
    const a = await siteWithOwner();
    const b = await siteWithOwner();
    const [idA] = await record(a.site, [{}]);
    const [idB] = await record(b.site, [{}]);
    await sql`UPDATE session_replays SET timestamp = now() - interval '40 days' WHERE website_id = ANY(${[a.site.id, b.site.id]})`;

    await purge(a.site, new Date(Date.now() - 30 * 86_400_000));

    expect(await listKeys(buckets.replays(), prefix(a.site, idA!))).toEqual([]);
    expect(await listKeys(buckets.replays(), prefix(b.site, idB!))).toHaveLength(1);
    expect(await sessionRows(b.site)).toHaveLength(1);
  });
});
