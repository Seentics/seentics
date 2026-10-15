import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { addMember, api, application, seedUser, seedWebsite, sql, type SeededWebsite } from "./harness";
import { collect, eventually, flushIngest, sid } from "./helpers/recordings";

setDefaultTimeout(30_000);

async function siteWithOwner() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

const jsError = (site: SeededWebsite, message: string, extra: Record<string, unknown> = {}) => ({
  type: "error",
  kind: "error",
  ts: Date.now() - 1_000,
  url: `https://${site.domain}/checkout?step=2`,
  sid: sid(),
  vid: "v-1",
  message,
  source: `https://${site.domain}/assets/app-3f9a1c2b.js`,
  line_no: 10,
  col_no: 4,
  stack: "TypeError: boom\n    at pay (app.js:10:4)",
  ...extra,
});

async function eventCount(site: SeededWebsite): Promise<number> {
  const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM error_events WHERE website_id = ${site.id}::uuid`;
  return r!.n;
}

/** Send errors and wait until the site has `expected` stored events. */
async function ingestErrors(site: SeededWebsite, errors: unknown[], expected: number, extra: Record<string, unknown> = {}) {
  expect((await collect(site, { errors, ...extra })).status).toBe(200);
  await eventually(async () => (await eventCount(site)) >= expected);
}

const groups = async (site: SeededWebsite, token: string, query: Record<string, string | number> = {}) =>
  api("GET", `/api/v1/errors/${site.id}/groups`, { token, query });

describe("error ingest and grouping", () => {
  it("groups the same fault together even when the numbers and bundle hash in it differ", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestErrors(site, [
      jsError(site, "Cannot read properties of undefined (reading 'id') at item 12"),
      jsError(site, "Cannot read properties of undefined (reading 'id') at item 99", { source: `https://${site.domain}/assets/app-77aa88bb.js` }),
      jsError(site, "Network failure"),
    ], 3);

    const res = await groups(site, owner.token);

    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(2);
    const top = res.body.groups.find((g: { message: string }) => g.message.startsWith("Cannot read"));
    expect(top).toMatchObject({ kind: "error", status: "unresolved", event_count: 2, last_page_path: "/checkout", line_no: 10 });
    expect(top.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(top.window).toMatchObject({ count: 2, prev_count: 0, sessions: 2, pages: ["/checkout"] });
  });

  it("keeps an unhandled rejection apart from an error with the same message", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "boom"), jsError(site, "boom", { kind: "unhandledrejection" })], 2);
    const res = await groups(site, owner.token);
    expect(res.body.groups.map((g: { kind: string }) => g.kind).sort()).toEqual(["error", "unhandledrejection"]);
  });

  it("keeps errors from a visitor without consent, under an anonymous session", async () => {
    // Errors need no consent, but the visitor's own ids must not be stored.
    const { site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "anon boom", { sid: "real-session", vid: "real-visitor" })], 1, { consent: false });
    const [row] = await sql<{ session_id: string; visitor_id: string }[]>`SELECT session_id, visitor_id FROM error_events WHERE website_id = ${site.id}::uuid`;
    expect(row!.session_id).toStartWith("h-");
    expect(row!.visitor_id).toStartWith("h-");
  });

  it("stores nothing for a site with error tracking switched off", async () => {
    const { site } = await siteWithOwner();
    await sql`UPDATE websites SET errors_enabled = false WHERE id = ${site.id}::uuid`;
    await collect(site, { errors: [jsError(site, "ignored")] });
    await flushIngest();
    expect(await eventCount(site)).toBe(0);
  });

  it("rejects a tracker batch with an error that has no message", async () => {
    const { site } = await siteWithOwner();
    const res = await collect(site, { errors: [jsError(site, "")] });
    expect(res.status).toBe(400);
  });

  it("counts a batch retried under the same batch id once", async () => {
    const { site } = await siteWithOwner();
    const batch = `b-${crypto.randomUUID()}`;
    await collect(site, { batch_id: batch, errors: [jsError(site, "once")] });
    expect((await collect(site, { batch_id: batch, errors: [jsError(site, "once")] })).body.message).toBe("duplicate");
    await ingestErrors(site, [jsError(site, "later")], 2);
    expect(await eventCount(site)).toBe(2);
  });
});

describe("GET /api/v1/errors/:website_id/groups", () => {
  it("compares this window with the one before it", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "trend"), jsError(site, "trend"), jsError(site, "trend")], 3);
    // One of the three happened in the previous 7-day window.
    await sql`UPDATE error_events SET occurred_at = now() - interval '10 days'
              WHERE id = (SELECT id FROM error_events WHERE website_id = ${site.id}::uuid LIMIT 1)`;

    const res = await groups(site, owner.token, { days: 7 });

    expect(res.body.groups[0].window).toMatchObject({ count: 2, prev_count: 1 });
  });

  it("filters by status and search and leaves out groups not seen in the window", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "Alpha failure"), jsError(site, "Beta failure"), jsError(site, "Gamma old")], 3);
    const [alpha] = (await groups(site, owner.token, { search: "alpha" })).body.groups;
    await api("PATCH", `/api/v1/errors/${site.id}/groups/${alpha.fingerprint}`, { token: owner.token, body: { status: "resolved" } });
    await sql`UPDATE error_groups SET last_seen = now() - interval '30 days' WHERE website_id = ${site.id}::uuid AND message = 'Gamma old'`;

    const names = async (query: Record<string, string | number>) =>
      (await groups(site, owner.token, query)).body.groups.map((g: { message: string }) => g.message).sort();
    expect(await names({ status: "resolved" })).toEqual(["Alpha failure"]);
    expect(await names({ status: "unresolved" })).toEqual(["Beta failure"]);
    expect(await names({ search: "failure" })).toEqual(["Alpha failure", "Beta failure"]);
    expect(await names({ days: 90 })).toEqual(["Alpha failure", "Beta failure", "Gamma old"]);
    expect(await names({ limit: 1 })).toHaveLength(1);
  });

  it("rejects an unknown status rather than reporting no errors", async () => {
    const { owner, site } = await siteWithOwner();
    expect((await groups(site, owner.token, { status: "fixed" })).status).toBe(400);
  });

  it("requires a signed-in member of the site; a viewer may read", async () => {
    const { site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "secret")], 1);
    const stranger = await seedUser();
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");

    expect((await api("GET", `/api/v1/errors/${site.id}/groups`)).status).toBe(401);
    const denied = await groups(site, stranger.token);
    expect(denied.status).toBe(403);
    expect(denied.body.groups).toBeUndefined();
    expect((await groups(site, viewer.token)).body.groups).toHaveLength(1);
  });
});

describe("GET /api/v1/errors/:website_id/groups/:fingerprint", () => {
  it("returns the group with its newest samples first", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestErrors(site, [
      jsError(site, "sample 1", { ts: Date.now() - 60_000 }),
      jsError(site, "sample 2", { ts: Date.now() - 1_000 }),
    ], 2);
    const [g] = (await groups(site, owner.token)).body.groups;

    const res = await api("GET", `/api/v1/errors/${site.id}/groups/${g.fingerprint}`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.group).toMatchObject({ fingerprint: g.fingerprint, event_count: 2, message: "sample 2" });
    expect(res.body.samples.map((s: { message: string }) => s.message)).toEqual(["sample 2", "sample 1"]);
    expect(res.body.samples[0]).toMatchObject({ page_path: "/checkout", line_no: 10, col_no: 4, browser: expect.stringContaining("Chrome") });
    expect(res.body.samples[0].stack).toContain("at pay");

    const limited = await api("GET", `/api/v1/errors/${site.id}/groups/${g.fingerprint}`, { token: owner.token, query: { limit: 1 } });
    expect(limited.body.samples).toHaveLength(1);
  });

  it("answers 404 for an unknown fingerprint and for another site's group", async () => {
    const victim = await siteWithOwner();
    await ingestErrors(victim.site, [jsError(victim.site, "theirs")], 1);
    const [g] = (await groups(victim.site, victim.owner.token)).body.groups;
    const attacker = await siteWithOwner();

    expect((await api("GET", `/api/v1/errors/${attacker.site.id}/groups/${"0".repeat(64)}`, { token: attacker.owner.token })).status).toBe(404);
    expect((await api("GET", `/api/v1/errors/${attacker.site.id}/groups/${g.fingerprint}`, { token: attacker.owner.token })).status).toBe(404);
    expect((await api("GET", `/api/v1/errors/${victim.site.id}/groups/${g.fingerprint}`, { token: attacker.owner.token })).status).toBe(403);
    expect((await api("GET", `/api/v1/errors/${victim.site.id}/groups/${g.fingerprint}`)).status).toBe(401);
  });
});

describe("PATCH /api/v1/errors/:website_id/groups/:fingerprint", () => {
  async function oneGroup() {
    const { owner, site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "status me")], 1);
    const [g] = (await groups(site, owner.token)).body.groups;
    const statusOf = async () =>
      (await sql<{ status: string }[]>`SELECT status FROM error_groups WHERE website_id = ${site.id}::uuid AND fingerprint = ${g.fingerprint}`)[0]!.status;
    return { owner, site, fingerprint: g.fingerprint as string, statusOf };
  }

  it("resolves and ignores a group", async () => {
    const { owner, site, fingerprint, statusOf } = await oneGroup();
    const res = await api("PATCH", `/api/v1/errors/${site.id}/groups/${fingerprint}`, { token: owner.token, body: { status: "resolved" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, status: "resolved" });
    expect(await statusOf()).toBe("resolved");
    await api("PATCH", `/api/v1/errors/${site.id}/groups/${fingerprint}`, { token: owner.token, body: { status: "ignored" } });
    expect(await statusOf()).toBe("ignored");
  });

  it("reopens a resolved group when the fault comes back, but leaves an ignored one ignored", async () => {
    // A regression must not hide behind a "resolved" someone set before it started throwing again.
    const { owner, site, fingerprint, statusOf } = await oneGroup();
    await api("PATCH", `/api/v1/errors/${site.id}/groups/${fingerprint}`, { token: owner.token, body: { status: "resolved" } });
    await ingestErrors(site, [jsError(site, "status me")], 2);
    expect(await statusOf()).toBe("unresolved");

    await api("PATCH", `/api/v1/errors/${site.id}/groups/${fingerprint}`, { token: owner.token, body: { status: "ignored" } });
    await ingestErrors(site, [jsError(site, "status me")], 3);
    expect(await statusOf()).toBe("ignored");
  });

  it("lets a member change status but not a viewer or a stranger", async () => {
    const { site, fingerprint, statusOf } = await oneGroup();
    const viewer = await seedUser();
    const member = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");
    const patch = (token: string | undefined) =>
      api("PATCH", `/api/v1/errors/${site.id}/groups/${fingerprint}`, { token, body: { status: "ignored" } });

    expect((await patch(viewer.token)).status).toBe(403);
    expect((await patch(stranger.token)).status).toBe(403);
    expect((await patch(undefined)).status).toBe(401);
    expect(await statusOf()).toBe("unresolved");
    expect((await patch(member.token)).status).toBe(200);
    expect(await statusOf()).toBe("ignored");
  });

  it("rejects an unknown status and invalid JSON, and answers 404 for another site's group", async () => {
    const { owner, site, fingerprint, statusOf } = await oneGroup();
    const url = `/api/v1/errors/${site.id}/groups/${fingerprint}`;
    expect((await api("PATCH", url, { token: owner.token, body: { status: "fixed" } })).status).toBe(400);
    expect((await api("PATCH", url, { token: owner.token, body: {} })).status).toBe(400);
    expect((await api("PATCH", url, { token: owner.token, body: "{nope" })).status).toBe(400);

    const other = await siteWithOwner();
    const cross = await api("PATCH", `/api/v1/errors/${other.site.id}/groups/${fingerprint}`, { token: other.owner.token, body: { status: "ignored" } });
    expect(cross.status).toBe(404);
    expect(await statusOf()).toBe("unresolved");
  });
});

describe("error retention", () => {
  it("deletes old events and groups with nothing left, keeping recent ones", async () => {
    const { site } = await siteWithOwner();
    await ingestErrors(site, [jsError(site, "old fault"), jsError(site, "new fault")], 2);
    await sql`UPDATE error_events SET occurred_at = now() - interval '100 days' WHERE website_id = ${site.id}::uuid AND message = 'old fault'`;
    await sql`UPDATE error_groups SET last_seen = now() - interval '100 days' WHERE website_id = ${site.id}::uuid AND message = 'old fault'`;
    const cutoff = new Date(Date.now() - 30 * 86_400_000);

    const result = await application().modules.errors.retention.purge(
      { websiteId: site.id },
      { analytics: cutoff, funnelAutomation: cutoff, replay: cutoff, heatmap: cutoff },
      { batchSize: 100 } as never,
    );

    expect(result).toEqual({ errorEventRows: 1, errorGroupRows: 1 });
    const left = await sql<{ message: string }[]>`SELECT message FROM error_groups WHERE website_id = ${site.id}::uuid`;
    expect(left.map((g) => g.message)).toEqual(["new fault"]);
  });
});
