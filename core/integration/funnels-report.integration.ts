import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { eventStep, pageStep, seedJourney } from "./helpers/funnels";

const base = (siteId: string) => `/api/v1/websites/${siteId}/funnels`;

async function setup(steps: unknown[], extra: Record<string, unknown> = {}) {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  const res = await api("POST", base(site.id), { token: owner.token, body: { name: "Checkout", steps, ...extra } });
  expect(res.status).toBe(201);
  return { owner, site, funnel: res.body.data as { id: string } };
}

const checkout = [pageStep("Home", "/"), pageStep("Pricing", "/pricing"), eventStep("Signup", "signup")];

describe("a funnel's report from stored events", () => {
  it("counts visitors per step, completions, conversion and drop-off", async () => {
    const { owner, site, funnel } = await setup(checkout);
    // 4 enter, 2 reach pricing, 1 signs up.
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }, { page: "/pricing", minutesAgo: 20 }, { event: "signup", minutesAgo: 10 }]);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }, { page: "/pricing/", minutesAgo: 25 }]); // trailing slash is the same page
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }]);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }, { page: "/about", minutesAgo: 20 }]);

    const res = await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token });

    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r).toMatchObject({ totalEntries: 4, completions: 1, conversionRate: 25 });
    expect(r.stepBreakdown).toEqual([
      { stepOrder: 0, stepName: "Home", count: 4, dropoffCount: 0, dropoffRate: 0 },
      { stepOrder: 1, stepName: "Pricing", count: 2, dropoffCount: 2, dropoffRate: 50 },
      { stepOrder: 2, stepName: "Signup", count: 1, dropoffCount: 1, dropoffRate: 50 },
    ]);
  });

  it("only counts steps reached in order", async () => {
    // Signing up before seeing pricing is not progress through this funnel.
    const { owner, site, funnel } = await setup(checkout);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }, { event: "signup", minutesAgo: 25 }, { page: "/pricing", minutesAgo: 20 }]);

    const r = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token })).body.data;

    expect(r.stepBreakdown.map((s: { count: number }) => s.count)).toEqual([1, 1, 0]);
    expect(r.completions).toBe(0);
  });

  it("counts a visitor once however many times they repeat a step", async () => {
    const { owner, site, funnel } = await setup(checkout);
    const v = `v-${randomUUID().slice(0, 8)}`;
    await seedJourney(site.id, [{ page: "/", minutesAgo: 50 }, { page: "/", minutesAgo: 40 }, { page: "/pricing", minutesAgo: 30 }], v);
    await seedJourney(site.id, [{ page: "/pricing", minutesAgo: 20 }, { event: "signup", minutesAgo: 10 }], v);

    const r = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token })).body.data;

    expect(r).toMatchObject({ totalEntries: 1, completions: 1, conversionRate: 100 });
  });

  it("drops a next step that came after the conversion window", async () => {
    const { owner, site, funnel } = await setup([pageStep("Home", "/"), pageStep("Pricing", "/pricing")], { conversion_window_hours: 1 });
    await seedJourney(site.id, [{ page: "/", minutesAgo: 180 }, { page: "/pricing", minutesAgo: 10 }]);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 40 }, { page: "/pricing", minutesAgo: 10 }]);

    const r = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token })).body.data;

    expect(r).toMatchObject({ totalEntries: 2, completions: 1, conversionRate: 50 });
  });

  it("ignores events older than the requested days", async () => {
    const { owner, site, funnel } = await setup([pageStep("Home", "/"), pageStep("Pricing", "/pricing")]);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 3 * 24 * 60 }, { page: "/pricing", minutesAgo: 3 * 24 * 60 - 5 }]);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }]);

    const week = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token, query: { days: 7 } })).body.data;
    const day = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token, query: { days: 1 } })).body.data;

    expect(week).toMatchObject({ totalEntries: 2, completions: 1 });
    expect(day).toMatchObject({ totalEntries: 1, completions: 0 });
  });

  it("matches contains, starts_with and regex steps", async () => {
    const { owner, site, funnel } = await setup([
      pageStep("Blog", "/blog/", "starts_with"),
      pageStep("Docs", "install", "contains"),
      pageStep("Plan", "^/plans/(pro|team)$", "regex"),
    ]);
    await seedJourney(site.id, [{ page: "/blog/post-1", minutesAgo: 30 }, { page: "/docs/install-guide", minutesAgo: 20 }, { page: "/plans/team", minutesAgo: 10 }]);
    await seedJourney(site.id, [{ page: "/blog/post-2", minutesAgo: 30 }, { page: "/docs/install", minutesAgo: 20 }, { page: "/plans/free", minutesAgo: 10 }]);

    const r = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token })).body.data;

    expect(r.stepBreakdown.map((s: { count: number }) => s.count)).toEqual([2, 2, 1]);
  });

  it("does not count another site's events", async () => {
    const { owner, site, funnel } = await setup(checkout);
    const other = await seedWebsite(owner.id);
    await seedJourney(other.id, [{ page: "/", minutesAgo: 30 }, { page: "/pricing", minutesAgo: 20 }, { event: "signup", minutesAgo: 10 }]);

    const r = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token })).body.data;

    expect(r).toMatchObject({ totalEntries: 0, completions: 0, conversionRate: 0 });
  });

  it("warns about a step with nothing to match and counts nobody past it", async () => {
    // Saved by an older builder: the report says so rather than guessing.
    const { owner, site, funnel } = await setup([pageStep("Home", "/"), pageStep("Blank", ""), pageStep("Pricing", "/pricing")]);
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }, { page: "/pricing", minutesAgo: 10 }]);

    const r = (await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token })).body.data;

    expect(r.totalEntries).toBe(1);
    expect(r.completions).toBe(0);
    expect(r.stepBreakdown.map((s: { count: number }) => s.count)).toEqual([1, 0, 0]);
    expect(r.warnings[0]).toContain("Blank");
  });

  it("warns instead of failing when a stored regex is one the database cannot run", async () => {
    const { owner, site, funnel } = await setup([pageStep("Home", "/"), pageStep("Pricing", "/pricing")]);
    // Written straight to the row, as a funnel saved before the save-time check existed.
    await sql`UPDATE funnels SET steps = ${JSON.stringify([pageStep("Home", "/"), pageStep("Broken", "(", "regex")])}::jsonb WHERE id = ${funnel.id}::uuid`;
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }]);

    const res = await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data.totalEntries).toBe(1);
    expect(res.body.data.warnings.join(" ")).toContain("Broken");
  });

  it("is readable by a viewer and refused to a stranger or without a session", async () => {
    const { site, funnel } = await setup(checkout);
    const viewer = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, viewer.id, "viewer");

    expect((await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: viewer.token })).status).toBe(200);
    expect((await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: stranger.token })).status).toBe(403);
    expect((await api("GET", `${base(site.id)}/${funnel.id}/stats`)).status).toBe(401);
    expect((await api("GET", `${base(site.id)}/stats`, { token: stranger.token })).status).toBe(403);
  });

  it("404s for a funnel that belongs to another site", async () => {
    const mine = await setup(checkout);
    const theirs = await setup(checkout);
    const res = await api("GET", `${base(mine.site.id)}/${theirs.funnel.id}/stats`, { token: mine.owner.token });
    expect(res.status).toBe(404);
  });
});

describe("every funnel's report at once", () => {
  it("returns each funnel's figures keyed by id, matching the single report", async () => {
    const { owner, site, funnel } = await setup(checkout);
    const second = (await api("POST", base(site.id), { token: owner.token, body: { name: "Pricing only", steps: [pageStep("Pricing", "/pricing")] } })).body.data;
    await seedJourney(site.id, [{ page: "/", minutesAgo: 30 }, { page: "/pricing", minutesAgo: 20 }, { event: "signup", minutesAgo: 10 }]);
    await seedJourney(site.id, [{ page: "/pricing", minutesAgo: 30 }]);

    const res = await api("GET", `${base(site.id)}/stats`, { token: owner.token });
    const single = await api("GET", `${base(site.id)}/${funnel.id}/stats`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual([funnel.id, second.id].sort());
    expect(res.body.data[funnel.id]).toEqual(single.body.data);
    expect(res.body.data[second.id]).toMatchObject({ totalEntries: 2, completions: 2, conversionRate: 100 });
  });

  it("is an empty object for a site with no funnels", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const res = await api("GET", `${base(site.id)}/stats`, { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });
});

describe("the tracker's active-funnel list (public)", () => {
  it("serves only active funnels with their id, name and step matching rules", async () => {
    // Anonymous and served to every visitor: no owner id, description or live numbers.
    const { owner, site, funnel } = await setup(checkout, { description: "internal notes" });
    const off = (await api("POST", base(site.id), { token: owner.token, body: { name: "Off", is_active: false, steps: [pageStep("A", "/a")] } })).body.data;

    const res = await api("GET", "/api/v1/funnels/active", { query: { website_id: site.id } });

    expect(res.status).toBe(200);
    expect(res.body.data.map((f: { id: string }) => f.id)).toEqual([funnel.id]);
    expect(res.body.data.map((f: { id: string }) => f.id)).not.toContain(off.id);
    const [f] = res.body.data;
    expect(Object.keys(f).sort()).toEqual(["id", "name", "steps"]);
    const allowed = new Set(["id", "name", "order", "step_type", "page_path", "path", "match_type", "match", "pattern", "event_type", "event"]);
    for (const step of f.steps) for (const key of Object.keys(step)) expect(allowed.has(key)).toBe(true);
    expect(res.text).not.toContain("internal notes");
    expect(res.text).not.toContain(owner.id);
  });

  it("accepts the camelCase parameter too", async () => {
    const { site, funnel } = await setup(checkout);
    const res = await api("GET", "/api/v1/funnels/active", { query: { websiteId: site.id } });
    expect(res.body.data.map((f: { id: string }) => f.id)).toEqual([funnel.id]);
  });

  it("serves nothing for an inactive site", async () => {
    const { site } = await setup(checkout);
    await sql`UPDATE websites SET is_active = false WHERE id = ${site.id}::uuid`;
    const res = await api("GET", "/api/v1/funnels/active", { query: { website_id: site.id } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("serves nothing for an unknown site", async () => {
    const res = await api("GET", "/api/v1/funnels/active", { query: { website_id: randomUUID() } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("answers 400 when no site is named", async () => {
    const res = await api("GET", "/api/v1/funnels/active");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("website_id required");
  });
});

describe("malformed site ids", () => {
  it("answers the tracker without a server error for a site id that is not a UUID", async () => {
    // Public and hit on every page load: garbage must not surface as a server error.
    const res = await api("GET", "/api/v1/funnels/active", { query: { website_id: "not-a-uuid" } });
    expect(res.status).toBeLessThan(500);
    expect(res.body.data ?? []).toEqual([]);
  });

  it("refuses a dashboard site id that is not a UUID without a server error", async () => {
    const user = await seedUser();
    const res = await api("GET", `${base("not-a-uuid")}`, { token: user.token });
    expect([403, 404]).toContain(res.status);
  });
});
