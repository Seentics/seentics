import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { createAutomation, definition, graphOf } from "./helpers/automations";

const base = (siteId: string) => `/api/v1/automations/${siteId}`;

async function ownerWithSite() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

describe("creating an automation", () => {
  it("stores it for the site and returns it active", async () => {
    const { owner, site } = await ownerWithSite();

    const res = await api("POST", base(site.id), { token: owner.token, body: { name: "Exit banner", definition: definition() } });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Exit banner", websiteId: site.id, isActive: true });
    const [row] = await sql`SELECT user_id::text, definition FROM automations WHERE id = ${res.body.data.id}::uuid`;
    expect(row!.user_id).toBe(owner.id);
    expect(row!.definition.triggers).toEqual([{ type: "exit_intent" }]);
  });

  // The schema accepts `enabled`, so a client sending `enabled: false` expects a draft —
  // the repository only reads `is_active`, which the schema strips.
  it("create with enabled:false stores an inactive automation", async () => {
    const { owner, site } = await ownerWithSite();
    const res = await api("POST", base(site.id), { token: owner.token, body: { name: "Draft", enabled: false, definition: definition() } });
    expect(res.status).toBe(201);
    expect(res.body.data.isActive).toBe(false);
  });

  it("requires a signed-in user", async () => {
    const { site } = await ownerWithSite();
    const res = await api("POST", base(site.id), { body: { name: "x", definition: definition() } });
    expect(res.status).toBe(401);
  });

  it("refuses another account's site and writes nothing there", async () => {
    const { site } = await ownerWithSite();
    const stranger = await seedUser();

    const res = await api("POST", base(site.id), { token: stranger.token, body: { name: "x", definition: definition() } });

    expect(res.status).toBe(403);
    expect(await sql`SELECT 1 FROM automations WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("refuses a viewer but lets a member create", async () => {
    const { site } = await ownerWithSite();
    const viewer = await seedUser();
    const member = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");

    const asViewer = await api("POST", base(site.id), { token: viewer.token, body: { name: "x", definition: definition() } });
    const asMember = await api("POST", base(site.id), { token: member.token, body: { name: "y", definition: definition() } });

    expect(asViewer.status).toBe(403);
    expect(asMember.status).toBe(201);
    const names = await sql<{ name: string }[]>`SELECT name FROM automations WHERE website_id = ${site.id}::uuid`;
    expect(names.map((r) => r.name)).toEqual(["y"]);
  });

  // A malformed site id must be a refusal, not a database cast error surfacing as 500.
  it("answers a malformed site id with a refusal, not a server error", async () => {
    const owner = await seedUser();
    const res = await api("GET", base("not-a-uuid"), { token: owner.token });
    expect([403, 404]).toContain(res.status);
  });
});

describe("validating the definition", () => {
  // Each one would save and then never fire, or fire something unsafe.
  const cases: Array<[string, Record<string, unknown>]> = [
    ["no name", { name: "", definition: definition() }],
    ["no definition", { name: "x" }],
    ["no triggers", { name: "x", definition: definition({ triggers: [] }) }],
    ["an unknown trigger type", { name: "x", definition: definition({ triggers: [{ type: "telepathy" }] }) }],
    ["an unknown action type", { name: "x", definition: definition({ graph: graphOf({ type: "format_disk" }) }) }],
    ["a graph whose entry does not exist", { name: "x", definition: definition({ graph: { ...graphOf({ type: "show_toast" }), entry: "zz" } }) }],
    [
      "a graph with a loop",
      {
        name: "x",
        definition: definition({
          graph: {
            entry: "a",
            nodes: [
              { id: "a", kind: "action", action: { type: "show_toast" } },
              { id: "b", kind: "action", action: { type: "show_banner" } },
            ],
            edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
          },
        }),
      },
    ],
    [
      "an if node with an unnamed branch",
      {
        name: "x",
        definition: definition({
          graph: {
            entry: "a",
            nodes: [
              { id: "a", kind: "if", group: { operator: "AND", rules: [] } },
              { id: "b", kind: "action", action: { type: "show_banner" } },
            ],
            edges: [{ from: "a", to: "b" }],
          },
        }),
      },
    ],
    ["a webhook to a cloud metadata address", { name: "x", definition: definition({ graph: graphOf({ type: "webhook", url: "http://169.254.169.254/latest/meta-data/" }) }) }],
    ["a webhook to localhost", { name: "x", definition: definition({ graph: graphOf({ type: "webhook", url: "https://127.0.0.1/hook" }) }) }],
    ["a webhook that sets Authorization", { name: "x", definition: definition({ graph: graphOf({ type: "webhook", url: "https://hooks.example.com/x", headers: { Authorization: "Bearer stolen" } }) }) }],
    ["a frequency cap of zero", { name: "x", definition: definition({ frequency: { maxPerSession: 0 } }) }],
    ["an enabled A/B test with no variants", { name: "x", definition: definition({ abTest: { enabled: true, variants: [] } }) }],
    ["an A/B test with duplicate variant ids", { name: "x", definition: definition({ abTest: { enabled: true, variants: [{ id: "a" }, { id: "a" }] } }) }],
    ["a spin wheel without its form", { name: "x", definition: definition({ graph: graphOf({ type: "show_modal", layout: "spin_wheel" }) }) }],
  ];

  for (const [label, body] of cases) {
    it(`rejects ${label} with 400 and stores nothing`, async () => {
      const { owner, site } = await ownerWithSite();
      const res = await api("POST", base(site.id), { token: owner.token, body });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("validation_error");
      expect(await sql`SELECT 1 FROM automations WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
    });
  }

  it("rejects a body that is not JSON", async () => {
    const { owner, site } = await ownerWithSite();
    const res = await api("POST", base(site.id), { token: owner.token, body: "{not json" });
    expect(res.status).toBe(400);
  });

  it("accepts a public https webhook with a custom header", async () => {
    const { owner, site } = await ownerWithSite();
    const res = await api("POST", base(site.id), {
      token: owner.token,
      body: { name: "hook", definition: definition({ graph: graphOf({ type: "webhook", url: "https://hooks.example.com/in", headers: { "X-Api-Key": "k" } }) }) },
    });
    expect(res.status).toBe(201);
  });
});

describe("reading automations", () => {
  it("lists the site's automations with their counters, newest first", async () => {
    const { owner, site } = await ownerWithSite();
    const first = await createAutomation(owner.token, site.id, { name: "first" });
    const second = await createAutomation(owner.token, site.id, { name: "second" });
    await sql`INSERT INTO automation_events (automation_id, record_type, status) VALUES
      (${first.id}::uuid, 'server_run', 'running'),
      (${first.id}::uuid, 'action', 'success'),
      (${first.id}::uuid, 'action', 'failed')`;

    const res = await api("GET", base(site.id), { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data.map((a: { id: string }) => a.id)).toEqual([second.id, first.id]);
    const stats = res.body.data.find((a: { id: string }) => a.id === first.id).stats;
    expect(stats).toEqual({ totalExecutions: 1, successCount: 1, failureCount: 1, successRate: 50, last30Days: 1 });
  });

  it("does not show one site's automations on another site's list", async () => {
    const { owner, site } = await ownerWithSite();
    const other = await seedWebsite(owner.id);
    await createAutomation(owner.token, other.id);

    const res = await api("GET", base(site.id), { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("lets a viewer read the list and one automation", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const a = await createAutomation(owner.token, site.id);

    expect((await api("GET", base(site.id), { token: viewer.token })).status).toBe(200);
    const one = await api("GET", `${base(site.id)}/${a.id}`, { token: viewer.token });
    expect(one.status).toBe(200);
    expect(one.body.data.id).toBe(a.id);
  });

  it("refuses a stranger the list", async () => {
    const { site } = await ownerWithSite();
    const stranger = await seedUser();
    expect((await api("GET", base(site.id), { token: stranger.token })).status).toBe(403);
    expect((await api("GET", base(site.id))).status).toBe(401);
  });

  // Access is checked on the site in the URL, so an id from another site must not resolve under it.
  it("answers 404 for an automation that belongs to another of the user's sites", async () => {
    const { owner, site } = await ownerWithSite();
    const other = await seedWebsite(owner.id);
    const theirs = await createAutomation(owner.token, other.id);

    for (const path of ["", "/stats", "/stats/daily", "/executions"]) {
      const res = await api("GET", `${base(site.id)}/${theirs.id}${path}`, { token: owner.token });
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
  });
});

describe("updating an automation", () => {
  it("changes only the fields sent", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id, { name: "before" });

    const res = await api("PUT", `${base(site.id)}/${a.id}`, { token: owner.token, body: { name: "after" } });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("after");
    expect(res.body.data.definition.triggers).toEqual([{ type: "exit_intent" }]);
  });

  it("validates a supplied definition in full", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);

    const res = await api("PUT", `${base(site.id)}/${a.id}`, {
      token: owner.token,
      body: { definition: definition({ graph: graphOf({ type: "webhook", url: "http://10.0.0.5/hook" }) }) },
    });

    expect(res.status).toBe(400);
    const [row] = await sql`SELECT definition FROM automations WHERE id = ${a.id}::uuid`;
    expect(row!.definition.graph.nodes[0].action.type).toBe("show_banner");
  });

  it("refuses a viewer and a stranger, and answers 404 for an unknown id", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const a = await createAutomation(owner.token, site.id, { name: "keep" });

    expect((await api("PUT", `${base(site.id)}/${a.id}`, { token: viewer.token, body: { name: "x" } })).status).toBe(403);
    expect((await api("PUT", `${base(site.id)}/${a.id}`, { token: stranger.token, body: { name: "x" } })).status).toBe(403);
    expect((await api("PUT", `${base(site.id)}/${randomUUID()}`, { token: owner.token, body: { name: "x" } })).status).toBe(404);
    const [row] = await sql`SELECT name FROM automations WHERE id = ${a.id}::uuid`;
    expect(row!.name).toBe("keep");
  });

  it("cannot reach another site's automation through a site the user may edit", async () => {
    const victim = await ownerWithSite();
    const theirs = await createAutomation(victim.owner.token, victim.site.id, { name: "theirs" });
    const attacker = await ownerWithSite();

    const res = await api("PUT", `${base(attacker.site.id)}/${theirs.id}`, { token: attacker.owner.token, body: { name: "pwned" } });

    expect(res.status).toBe(404);
    const [row] = await sql`SELECT name FROM automations WHERE id = ${theirs.id}::uuid`;
    expect(row!.name).toBe("theirs");
  });
});

describe("switching an automation on and off", () => {
  it("flips it each time", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);

    const off = await api("POST", `${base(site.id)}/${a.id}/toggle`, { token: owner.token });
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);
    const on = await api("POST", `${base(site.id)}/${a.id}/toggle`, { token: owner.token });
    expect(on.body.data.isActive).toBe(true);
  });

  it("is refused to a viewer, allowed to a member", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    const member = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");
    const a = await createAutomation(owner.token, site.id);

    expect((await api("POST", `${base(site.id)}/${a.id}/toggle`, { token: viewer.token })).status).toBe(403);
    expect((await api("POST", `${base(site.id)}/${a.id}/toggle`, { token: member.token })).status).toBe(200);
    const [row] = await sql`SELECT is_active FROM automations WHERE id = ${a.id}::uuid`;
    expect(row!.is_active).toBe(false);
  });

  it("answers 404 for an automation of another site", async () => {
    const victim = await ownerWithSite();
    const theirs = await createAutomation(victim.owner.token, victim.site.id);
    const attacker = await ownerWithSite();

    const res = await api("POST", `${base(attacker.site.id)}/${theirs.id}/toggle`, { token: attacker.owner.token });

    expect(res.status).toBe(404);
    const [row] = await sql`SELECT is_active FROM automations WHERE id = ${theirs.id}::uuid`;
    expect(row!.is_active).toBe(true);
  });
});

describe("stats and run history", () => {
  it("counts runs and action outcomes, and pads the daily chart to 14 days", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    await sql`INSERT INTO automation_events (automation_id, record_type, status, created_at) VALUES
      (${a.id}::uuid, 'server_run', 'running', now()),
      (${a.id}::uuid, 'server_run', 'running', now() - interval '40 days'),
      (${a.id}::uuid, 'action', 'success', now()),
      (${a.id}::uuid, 'action', 'success', now()),
      (${a.id}::uuid, 'action', 'success', now()),
      (${a.id}::uuid, 'action', 'failed', now())`;

    const stats = await api("GET", `${base(site.id)}/${a.id}/stats`, { token: owner.token });
    expect(stats.status).toBe(200);
    expect(stats.body.data).toEqual({ totalExecutions: 2, successCount: 3, failureCount: 1, successRate: 75, last30Days: 1 });

    const daily = await api("GET", `${base(site.id)}/${a.id}/stats/daily`, { token: owner.token });
    expect(daily.body.data).toHaveLength(14);
    // Today's bucket is the last; the 40-day-old run falls outside the window.
    expect(daily.body.data[13]).toEqual({ day: "D14", runs: 5 });
    expect(daily.body.data.slice(0, 13).every((d: { runs: number }) => d.runs === 0)).toBe(true);
  });

  it("reports 100% success for runs that had no actions, and zeros for none", async () => {
    const { owner, site } = await ownerWithSite();
    const quiet = await createAutomation(owner.token, site.id);
    const ran = await createAutomation(owner.token, site.id);
    await sql`INSERT INTO automation_events (automation_id, record_type, status) VALUES (${ran.id}::uuid, 'server_run', 'running')`;

    const q = await api("GET", `${base(site.id)}/${quiet.id}/stats`, { token: owner.token });
    const r = await api("GET", `${base(site.id)}/${ran.id}/stats`, { token: owner.token });
    expect(q.body.data.successRate).toBe(0);
    expect(r.body.data.successRate).toBe(100);
  });

  it("lists executions newest first, for a viewer too", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const a = await createAutomation(owner.token, site.id);
    await sql`INSERT INTO automation_events (automation_id, record_type, status, trigger_event, created_at) VALUES
      (${a.id}::uuid, 'server_run', 'running', 'old', now() - interval '1 hour'),
      (${a.id}::uuid, 'server_run', 'running', 'new', now())`;

    const res = await api("GET", `${base(site.id)}/${a.id}/executions`, { token: viewer.token });

    expect(res.status).toBe(200);
    expect(res.body.data.map((e: { triggerEvent: string }) => e.triggerEvent)).toEqual(["new", "old"]);
  });
});

describe("deleting automations", () => {
  it("removes the automation and its run history", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    await sql`INSERT INTO automation_events (automation_id, record_type, status) VALUES (${a.id}::uuid, 'server_run', 'running')`;

    const res = await api("DELETE", `${base(site.id)}/${a.id}`, { token: owner.token });

    expect(res.status).toBe(204);
    expect(await sql`SELECT 1 FROM automations WHERE id = ${a.id}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });

  it("is refused to a viewer", async () => {
    const { owner, site } = await ownerWithSite();
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const a = await createAutomation(owner.token, site.id);

    expect((await api("DELETE", `${base(site.id)}/${a.id}`, { token: viewer.token })).status).toBe(403);
    expect((await api("DELETE", `${base(site.id)}/bulk-delete`, { token: viewer.token, body: { ids: [a.id] } })).status).toBe(403);
    expect(await sql`SELECT 1 FROM automations WHERE id = ${a.id}::uuid`).toHaveLength(1);
  });

  it("bulk-deletes the named automations of this site only, history included", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    const b = await createAutomation(owner.token, site.id);
    const keep = await createAutomation(owner.token, site.id);
    const victim = await ownerWithSite();
    const theirs = await createAutomation(victim.owner.token, victim.site.id);
    await sql`INSERT INTO automation_events (automation_id, record_type, status) VALUES (${theirs.id}::uuid, 'server_run', 'running')`;

    const res = await api("DELETE", `${base(site.id)}/bulk-delete`, { token: owner.token, body: { ids: [a.id, b.id, theirs.id] } });

    expect(res.status).toBe(204);
    const left = await sql<{ id: string }[]>`SELECT id::text FROM automations WHERE website_id = ${site.id}::uuid`;
    expect(left.map((r) => r.id)).toEqual([keep.id]);
    // Another site's automation, and its history, survive being named.
    expect(await sql`SELECT 1 FROM automations WHERE id = ${theirs.id}::uuid`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${theirs.id}::uuid`).toHaveLength(1);
  });

  it("deleting another site's automation through one's own site changes nothing", async () => {
    const victim = await ownerWithSite();
    const theirs = await createAutomation(victim.owner.token, victim.site.id);
    const attacker = await ownerWithSite();

    const res = await api("DELETE", `${base(attacker.site.id)}/${theirs.id}`, { token: attacker.owner.token });

    expect(res.status).toBe(204); // idempotent by contract
    expect(await sql`SELECT 1 FROM automations WHERE id = ${theirs.id}::uuid`).toHaveLength(1);
  });

  it("rejects a bulk-delete body that is not a list of ids", async () => {
    const { owner, site } = await ownerWithSite();
    const res = await api("DELETE", `${base(site.id)}/bulk-delete`, { token: owner.token, body: { ids: "all" } });
    expect(res.status).toBe(400);
  });
});
