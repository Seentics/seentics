import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { eventStep, pageStep } from "./helpers/funnels";

const base = (siteId: string) => `/api/v1/websites/${siteId}/funnels`;
const body = (over: Record<string, unknown> = {}) => ({
  name: "Signup",
  description: "Home to thanks",
  steps: [pageStep("Home", "/"), pageStep("Thanks", "/thanks")],
  ...over,
});

async function ownerWithSite() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

async function createFunnel(siteId: string, token: string, over: Record<string, unknown> = {}) {
  const res = await api("POST", base(siteId), { token, body: body(over) });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; [k: string]: any };
}

describe("creating a funnel", () => {
  it("stores it for the site and answers the wire shape with zeroed stats", async () => {
    const { owner, site } = await ownerWithSite();

    const res = await api("POST", base(site.id), { token: owner.token, body: body({ conversion_window_hours: 24 }) });

    expect(res.status).toBe(201);
    const f = res.body.data;
    expect(f).toMatchObject({ website_id: site.id, user_id: owner.id, name: "Signup", is_active: true, conversion_window_hours: 24 });
    expect(f.steps.map((s: { name: string }) => s.name)).toEqual(["Home", "Thanks"]);
    expect(f.stats.stepBreakdown).toHaveLength(2);
    const [row] = await sql<{ website_id: string }[]>`SELECT website_id::text FROM funnels WHERE id = ${f.id}::uuid`;
    expect(row!.website_id).toBe(site.id);
  });

  it("returns steps sorted by their order, not their array position", async () => {
    // The report indexes steps positionally, so the read side must sort.
    const { owner, site } = await ownerWithSite();
    const f = await createFunnel(site.id, owner.token, { steps: [pageStep("Second", "/b", "exact", 1), pageStep("First", "/a", "exact", 0)] });
    expect(f.steps.map((s: { name: string }) => s.name)).toEqual(["First", "Second"]);
  });

  it("requires a signed-in user", async () => {
    const { site } = await ownerWithSite();
    const res = await api("POST", base(site.id), { body: body() });
    expect(res.status).toBe(401);
  });

  it("refuses another account's site and writes nothing", async () => {
    const { site } = await ownerWithSite();
    const stranger = await seedUser();
    const res = await api("POST", base(site.id), { token: stranger.token, body: body() });
    expect(res.status).toBe(403);
    expect(await sql`SELECT 1 FROM funnels WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("refuses a viewer but lets a member create", async () => {
    const { site } = await ownerWithSite();
    const viewer = await seedUser();
    const member = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");

    expect((await api("POST", base(site.id), { token: viewer.token, body: body() })).status).toBe(403);
    expect((await api("POST", base(site.id), { token: member.token, body: body() })).status).toBe(201);
    expect(await sql`SELECT 1 FROM funnels WHERE website_id = ${site.id}::uuid`).toHaveLength(1);
  });

  it("rejects a body that is not a JSON object", async () => {
    const { owner, site } = await ownerWithSite();
    for (const raw of ["not json", "[1,2]", "null"]) {
      const res = await api("POST", base(site.id), { token: owner.token, body: raw });
      expect({ raw, status: res.status }).toEqual({ raw, status: 400 });
    }
  });

  it("rejects more than 20 steps", async () => {
    const { owner, site } = await ownerWithSite();
    const steps = Array.from({ length: 21 }, (_, i) => pageStep(`S${i}`, `/p${i}`));
    const res = await api("POST", base(site.id), { token: owner.token, body: body({ steps }) });
    expect(res.status).toBe(400);
    expect(res.body.issues.join(" ")).toContain("at most 20 steps");
  });

  it("rejects a regex the database cannot run, naming the step", async () => {
    // A JS-valid named group is not valid in Postgres: refused at save rather than failing every report.
    const { owner, site } = await ownerWithSite();
    const res = await api("POST", base(site.id), { token: owner.token, body: body({ steps: [pageStep("Blog", "/blog/(?<slug>[a-z]+)", "regex")] }) });
    expect(res.status).toBe(400);
    expect(res.body.issues[0]).toContain("Blog");
  });

  it("rejects back-references, which make the matcher exponential", async () => {
    const { owner, site } = await ownerWithSite();
    const res = await api("POST", base(site.id), { token: owner.token, body: body({ steps: [pageStep("Rep", "(a)\\1", "regex")] }) });
    expect(res.status).toBe(400);
  });

  it("rejects a conversion window that is not 1..720 whole hours", async () => {
    const { owner, site } = await ownerWithSite();
    for (const w of [0, 721, 1.5, "24"]) {
      const res = await api("POST", base(site.id), { token: owner.token, body: body({ conversion_window_hours: w }) });
      expect({ w, status: res.status }).toEqual({ w, status: 400 });
    }
    expect(await sql`SELECT 1 FROM funnels WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("accepts a valid regex and an event step", async () => {
    const { owner, site } = await ownerWithSite();
    const f = await createFunnel(site.id, owner.token, { steps: [pageStep("Blog", "^/blog/[a-z-]+$", "regex"), eventStep("Signup", "signup")] });
    expect(f.steps[1]).toMatchObject({ step_type: "event", event_type: "signup" });
  });
});

describe("reading funnels", () => {
  it("lists a site's funnels newest first, to a viewer too", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const a = await createFunnel(site.id, owner.token, { name: "A" });
    const b = await createFunnel(site.id, owner.token, { name: "B" });

    const res = await api("GET", base(site.id), { token: viewer.token });

    expect(res.status).toBe(200);
    expect(res.body.data.map((f: { id: string }) => f.id)).toEqual([b.id, a.id]);
  });

  it("does not list another site's funnels", async () => {
    const { owner, site } = await ownerWithSite();
    const other = await seedWebsite(owner.id);
    await createFunnel(other.id, owner.token);
    const res = await api("GET", base(site.id), { token: owner.token });
    expect(res.body.data).toEqual([]);
  });

  it("gets one funnel, and 404s for an id that belongs to another site", async () => {
    // Scoped by site as well as id: a funnel id from another account must not read through.
    const { owner, site } = await ownerWithSite();
    const theirs = await ownerWithSite();
    const mine = await createFunnel(site.id, owner.token);
    const foreign = await createFunnel(theirs.site.id, theirs.owner.token);

    expect((await api("GET", `${base(site.id)}/${mine.id}`, { token: owner.token })).body.data.id).toBe(mine.id);
    expect((await api("GET", `${base(site.id)}/${foreign.id}`, { token: owner.token })).status).toBe(404);
    expect((await api("GET", `${base(site.id)}/${randomUUID()}`, { token: owner.token })).status).toBe(404);
  });

  it("refuses list and get without a session or to a stranger", async () => {
    const { owner, site } = await ownerWithSite();
    const stranger = await seedUser();
    const f = await createFunnel(site.id, owner.token);
    expect((await api("GET", base(site.id))).status).toBe(401);
    expect((await api("GET", base(site.id), { token: stranger.token })).status).toBe(403);
    expect((await api("GET", `${base(site.id)}/${f.id}`, { token: stranger.token })).status).toBe(403);
  });

  // It reached the uuid column and came back as a 500 from the database error.
  it("answers 404 for a funnel id that is not a UUID, on every route that takes one", async () => {
    const { owner, site } = await ownerWithSite();
    for (const [method, path, body] of [
      ["GET", "not-a-uuid", undefined],
      ["PUT", "not-a-uuid", { name: "x" }],
      ["DELETE", "not-a-uuid", undefined],
      ["GET", "not-a-uuid/stats", undefined],
    ] as const) {
      const res = await api(method, `${base(site.id)}/${path}`, { token: owner.token, body });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 404 });
    }
  });
});

describe("updating a funnel", () => {
  it("changes only the fields sent, and null clears the window", async () => {
    const { owner, site } = await ownerWithSite();
    const f = await createFunnel(site.id, owner.token, { conversion_window_hours: 48 });

    const res = await api("PUT", `${base(site.id)}/${f.id}`, { token: owner.token, body: { name: "Renamed", is_active: false, conversion_window_hours: null } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Renamed", is_active: false, conversion_window_hours: null, description: "Home to thanks" });
    expect(res.body.data.steps).toHaveLength(2);
    expect(new Date(res.body.data.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(f.updated_at).getTime());
  });

  it("validates the new steps the same way as create", async () => {
    const { owner, site } = await ownerWithSite();
    const f = await createFunnel(site.id, owner.token);
    const res = await api("PUT", `${base(site.id)}/${f.id}`, { token: owner.token, body: { steps: [pageStep("Bad", "(", "regex")] } });
    expect(res.status).toBe(400);
    const [row] = await sql<{ steps: unknown[] }[]>`SELECT steps FROM funnels WHERE id = ${f.id}::uuid`;
    expect(row!.steps).toHaveLength(2);
  });

  it("404s for a funnel on another site, leaving it untouched", async () => {
    const { owner, site } = await ownerWithSite();
    const theirs = await ownerWithSite();
    const foreign = await createFunnel(theirs.site.id, theirs.owner.token);

    const res = await api("PUT", `${base(site.id)}/${foreign.id}`, { token: owner.token, body: { name: "Hijacked" } });

    expect(res.status).toBe(404);
    const [row] = await sql<{ name: string }[]>`SELECT name FROM funnels WHERE id = ${foreign.id}::uuid`;
    expect(row!.name).toBe("Signup");
  });

  it("is refused to a viewer and allowed to a member", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    const member = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");
    const f = await createFunnel(site.id, owner.token);

    expect((await api("PUT", `${base(site.id)}/${f.id}`, { token: viewer.token, body: { name: "V" } })).status).toBe(403);
    expect((await api("PUT", `${base(site.id)}/${f.id}`, { token: member.token, body: { name: "M" } })).status).toBe(200);
    expect((await api("PUT", `${base(site.id)}/${f.id}`, { body: { name: "X" } })).status).toBe(401);
  });
});

describe("deleting funnels", () => {
  it("deletes one, and deleting it again is not an error", async () => {
    const { owner, site } = await ownerWithSite();
    const f = await createFunnel(site.id, owner.token);

    expect((await api("DELETE", `${base(site.id)}/${f.id}`, { token: owner.token })).status).toBe(204);
    expect((await api("DELETE", `${base(site.id)}/${f.id}`, { token: owner.token })).status).toBe(204);
    expect(await sql`SELECT 1 FROM funnels WHERE id = ${f.id}::uuid`).toHaveLength(0);
  });

  it("cannot delete another site's funnel through your own site's URL", async () => {
    const { owner, site } = await ownerWithSite();
    const theirs = await ownerWithSite();
    const foreign = await createFunnel(theirs.site.id, theirs.owner.token);

    await api("DELETE", `${base(site.id)}/${foreign.id}`, { token: owner.token });
    await api("DELETE", `${base(site.id)}/bulk-delete`, { token: owner.token, body: { ids: [foreign.id] } });

    expect(await sql`SELECT 1 FROM funnels WHERE id = ${foreign.id}::uuid`).toHaveLength(1);
  });

  it("refuses a viewer and a stranger", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const f = await createFunnel(site.id, owner.token);

    expect((await api("DELETE", `${base(site.id)}/${f.id}`, { token: viewer.token })).status).toBe(403);
    expect((await api("DELETE", `${base(site.id)}/${f.id}`, { token: stranger.token })).status).toBe(403);
    expect((await api("DELETE", `${base(site.id)}/bulk-delete`, { token: viewer.token, body: { ids: [f.id] } })).status).toBe(403);
    expect((await api("DELETE", `${base(site.id)}/${f.id}`)).status).toBe(401);
    expect(await sql`SELECT 1 FROM funnels WHERE id = ${f.id}::uuid`).toHaveLength(1);
  });

  it("bulk-deletes only the listed ids, and an empty list deletes nothing", async () => {
    // An empty IN list must not become "delete every funnel on the site".
    const { owner, site } = await ownerWithSite();
    const member = await seedUser();
    await addMember(site.id, member.id, "member");
    const a = await createFunnel(site.id, owner.token, { name: "A" });
    const b = await createFunnel(site.id, owner.token, { name: "B" });
    const c = await createFunnel(site.id, owner.token, { name: "C" });

    expect((await api("DELETE", `${base(site.id)}/bulk-delete`, { token: member.token, body: { ids: [] } })).status).toBe(204);
    expect((await api("DELETE", `${base(site.id)}/bulk-delete`, { token: member.token, body: {} })).status).toBe(204);
    expect(await sql`SELECT 1 FROM funnels WHERE website_id = ${site.id}::uuid`).toHaveLength(3);

    expect((await api("DELETE", `${base(site.id)}/bulk-delete`, { token: member.token, body: { ids: [a.id, b.id] } })).status).toBe(204);
    const left = await sql<{ id: string }[]>`SELECT id::text FROM funnels WHERE website_id = ${site.id}::uuid`;
    expect(left.map((r) => r.id)).toEqual([c.id]);
  });

  it("rejects a bulk body over 500 ids", async () => {
    const { owner, site } = await ownerWithSite();
    const ids = Array.from({ length: 501 }, () => randomUUID());
    const res = await api("DELETE", `${base(site.id)}/bulk-delete`, { token: owner.token, body: { ids } });
    expect(res.status).toBe(400);
  });
});
