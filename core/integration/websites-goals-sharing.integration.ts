import { describe, expect, it } from "bun:test";
import { api, sql } from "./harness";
import { MISSING_ID, seedTeam, W } from "./helpers/websites";

const goal = { name: "Signed up", type: "pageview", identifier: "/thanks" };

describe("goals", () => {
  it("creates a goal any member can then read", async () => {
    const t = await seedTeam();
    const res = await api("POST", `${W}/${t.site.id}/goals`, { token: t.member.token, body: { ...goal, selector: "#cta" } });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ name: "Signed up", type: "pageview", identifier: "/thanks", selector: "#cta" }));

    const list = await api("GET", `${W}/${t.site.id}/goals`, { token: t.viewer.token });
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([expect.objectContaining({ id: res.body.data.id, website_id: t.site.id, name: "Signed up", selector: "#cta" })]);
  });

  it("keeps each site's goals to itself", async () => {
    const t = await seedTeam();
    const other = await seedTeam();
    await api("POST", `${W}/${other.site.id}/goals`, { token: other.owner.token, body: goal });
    const list = await api("GET", `${W}/${t.site.id}/goals`, { token: t.owner.token });
    expect(list.body.data).toEqual([]);
    expect((await api("GET", `${W}/${other.site.id}/goals`, { token: t.owner.token })).status).toBe(403);
  });

  it("is managed by members and up; viewers and strangers only read or nothing", async () => {
    const t = await seedTeam();
    expect((await api("POST", `${W}/${t.site.id}/goals`, { token: t.viewer.token, body: goal })).status).toBe(403);
    expect((await api("POST", `${W}/${t.site.id}/goals`, { token: t.stranger.token, body: goal })).status).toBe(403);
    expect((await api("POST", `${W}/${t.site.id}/goals`, { body: goal })).status).toBe(401);
    expect((await api("GET", `${W}/${t.site.id}/goals`, { token: t.stranger.token })).status).toBe(403);
    expect((await api("GET", `${W}/${t.site.id}/goals`)).status).toBe(401);
    expect(await sql`SELECT 1 FROM goals WHERE website_id = ${t.site.id}::uuid`).toHaveLength(0);
  });

  it("rejects missing fields and oversize values", async () => {
    const t = await seedTeam();
    for (const body of [
      {},
      { ...goal, name: "" },
      { ...goal, name: "n".repeat(121) },
      { type: "pageview", identifier: "/x" },
      { ...goal, identifier: "/".repeat(257) },
      { ...goal, selector: "s".repeat(1025) },
    ]) {
      const res = await api("POST", `${W}/${t.site.id}/goals`, { token: t.owner.token, body });
      expect(res.status).toBe(400);
    }
    expect(await sql`SELECT 1 FROM goals WHERE website_id = ${t.site.id}::uuid`).toHaveLength(0);
  });

  it("updates only the fields sent, and clears the selector with null", async () => {
    const t = await seedTeam();
    const created = await api("POST", `${W}/${t.site.id}/goals`, { token: t.owner.token, body: { ...goal, selector: "#cta" } });
    const id = created.body.data.id;

    const res = await api("PATCH", `${W}/${t.site.id}/goals/${id}`, { token: t.member.token, body: { name: "Renamed", selector: null } });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ name: "Renamed", identifier: "/thanks", selector: null }));
  });

  it("will not update or delete a goal through another site's path", async () => {
    const t = await seedTeam();
    const other = await seedTeam();
    const theirs = await api("POST", `${W}/${other.site.id}/goals`, { token: other.owner.token, body: goal });
    const id = theirs.body.data.id;

    expect((await api("PATCH", `${W}/${t.site.id}/goals/${id}`, { token: t.owner.token, body: { name: "Hijacked" } })).status).toBe(404);
    await api("DELETE", `${W}/${t.site.id}/goals/${id}`, { token: t.owner.token });

    const [row] = await sql<{ name: string }[]>`SELECT name FROM goals WHERE id = ${id}::uuid`;
    expect(row?.name).toBe("Signed up");
  });

  it("answers 404 for a goal that does not exist", async () => {
    const t = await seedTeam();
    expect((await api("PATCH", `${W}/${t.site.id}/goals/${MISSING_ID}`, { token: t.owner.token, body: { name: "x" } })).status).toBe(404);
  });

  it("deletes a goal for members and up, never for a viewer", async () => {
    const t = await seedTeam();
    const created = await api("POST", `${W}/${t.site.id}/goals`, { token: t.owner.token, body: goal });
    const id = created.body.data.id;

    expect((await api("DELETE", `${W}/${t.site.id}/goals/${id}`, { token: t.viewer.token })).status).toBe(403);
    expect((await api("PATCH", `${W}/${t.site.id}/goals/${id}`, { token: t.viewer.token, body: { name: "x" } })).status).toBe(403);
    expect(await sql`SELECT 1 FROM goals WHERE id = ${id}::uuid`).toHaveLength(1);

    expect((await api("DELETE", `${W}/${t.site.id}/goals/${id}`, { token: t.member.token })).status).toBe(204);
    expect(await sql`SELECT 1 FROM goals WHERE id = ${id}::uuid`).toHaveLength(0);
  });

  it("rejects an update body that is not an object", async () => {
    const t = await seedTeam();
    const created = await api("POST", `${W}/${t.site.id}/goals`, { token: t.owner.token, body: goal });
    expect((await api("PATCH", `${W}/${t.site.id}/goals/${created.body.data.id}`, { token: t.owner.token, body: "[]" })).status).toBe(400);
  });

  it("an update holds goal fields to the create rules: a blank name or oversize identifier is refused", async () => {
    const t = await seedTeam();
    const created = await api("POST", `${W}/${t.site.id}/goals`, { token: t.owner.token, body: goal });
    const id = created.body.data.id;
    expect((await api("PATCH", `${W}/${t.site.id}/goals/${id}`, { token: t.owner.token, body: { name: "" } })).status).toBe(400);
    expect((await api("PATCH", `${W}/${t.site.id}/goals/${id}`, { token: t.owner.token, body: { identifier: "x".repeat(5000) } })).status).toBe(400);
    const [row] = await sql<{ name: string; identifier: string }[]>`SELECT name, identifier FROM goals WHERE id = ${id}::uuid`;
    expect(row).toEqual({ name: "Signed up", identifier: "/thanks" });
  });
});

describe("public share links", () => {
  const share = (siteId: string, token: string | undefined, body: unknown) => api("POST", `${W}/${siteId}/share`, { token, body });
  const publicRead = (shareId: string) => api("GET", `/api/v1/analytics/public/dashboard/${shareId}`);

  it("turns sharing on with a stable id, and the public dashboard reads without a session", async () => {
    const t = await seedTeam();
    await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
              VALUES (${t.site.id}, 'pageview', '/', 'v1', 's1', now())`;

    const on = await share(t.site.id, t.admin.token, { enabled: true });
    expect(on.status).toBe(200);
    const shareId = on.body.data.public_share_id;
    expect(shareId).toMatch(/^[0-9a-f]{24}$/);
    // Asking again keeps the link people already have.
    expect((await share(t.site.id, t.owner.token, { enabled: true })).body.data.public_share_id).toBe(shareId);

    const res = await publicRead(shareId);
    expect(res.status).toBe(200);
    // The share id is the public name for the site; its internal id and owner never leave.
    expect(res.text).not.toContain(t.site.id);
    expect(res.text).not.toContain(t.owner.id);
    expect(res.text).not.toContain(t.owner.email);
    expect(res.text).not.toContain(t.site.trackingId);
  });

  it("closes the public dashboard when sharing is turned off, and a new link differs from the old", async () => {
    const t = await seedTeam();
    const first = (await share(t.site.id, t.owner.token, { enabled: true })).body.data.public_share_id;

    const off = await share(t.site.id, t.owner.token, { enabled: false });

    expect(off.status).toBe(200);
    expect(off.body.data.public_share_id).toBeNull();
    expect((await publicRead(first)).status).toBe(404);
    const second = (await share(t.site.id, t.owner.token, { enabled: true })).body.data.public_share_id;
    expect(second).not.toBe(first);
    expect((await publicRead(first)).status).toBe(404);
    expect((await publicRead(second)).status).toBe(200);
  });

  it("answers 404 for a link that never existed", async () => {
    expect((await publicRead("deadbeefdeadbeefdeadbeef")).status).toBe(404);
  });

  it("is for admins and the owner only", async () => {
    const t = await seedTeam();
    for (const u of [t.member, t.viewer, t.stranger]) {
      expect((await share(t.site.id, u.token, { enabled: true })).status).toBe(403);
    }
    expect((await share(t.site.id, undefined, { enabled: true })).status).toBe(401);
    const [row] = await sql<{ public_share_id: string | null }[]>`SELECT public_share_id FROM websites WHERE id = ${t.site.id}::uuid`;
    expect(row?.public_share_id).toBeNull();
  });

  it("treats a body it cannot read as a request to share (current behaviour)", async () => {
    const t = await seedTeam();
    const res = await share(t.site.id, t.owner.token, "not json");
    expect(res.status).toBe(200);
    expect(res.body.data.public_share_id).toEqual(expect.any(String));
  });

  it("dies with the site", async () => {
    const t = await seedTeam();
    const shareId = (await share(t.site.id, t.owner.token, { enabled: true })).body.data.public_share_id;
    await api("DELETE", `${W}/${t.site.id}`, { token: t.owner.token });
    expect((await publicRead(shareId)).status).toBe(404);
  });
});

describe("website privacy settings", () => {
  const path = (siteId: string) => `${W}/${siteId}/privacy`;

  it("starts from the defaults", async () => {
    const t = await seedTeam();
    const res = await api("GET", path(t.site.id), { token: t.owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ipAnonymization: "none", respectDnt: false, consentMode: "cookieless", dataRetentionDays: null });
  });

  it("saves and reads back each setting", async () => {
    const t = await seedTeam();
    const body = { ipAnonymization: "full", respectDnt: true, consentMode: "strict", dataRetentionDays: 90 };
    const res = await api("PUT", path(t.site.id), { token: t.owner.token, body });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(body);
    expect((await api("GET", path(t.site.id), { token: t.owner.token })).body.data).toEqual(body);
  });

  it("accepts consent mode none", async () => {
    const t = await seedTeam();
    const res = await api("PUT", path(t.site.id), { token: t.owner.token, body: { consentMode: "none" } });
    expect(res.status).toBe(200);
    expect(res.body.data.consentMode).toBe("none");
  });

  it("resets fields left out of a save to their defaults (a PUT replaces the whole set)", async () => {
    const t = await seedTeam();
    await api("PUT", path(t.site.id), { token: t.owner.token, body: { ipAnonymization: "full", respectDnt: true } });
    const res = await api("PUT", path(t.site.id), { token: t.owner.token, body: { dataRetentionDays: 30 } });
    expect(res.body.data).toEqual({ ipAnonymization: "none", respectDnt: false, consentMode: "cookieless", dataRetentionDays: 30 });
  });

  it("rejects values outside each setting's range", async () => {
    const t = await seedTeam();
    for (const body of [
      { ipAnonymization: "some" },
      { consentMode: "opt-out" },
      { dataRetentionDays: 0 },
      { dataRetentionDays: 3651 },
      { dataRetentionDays: 1.5 },
      { respectDnt: "yes" },
    ]) {
      const res = await api("PUT", path(t.site.id), { token: t.owner.token, body });
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    expect((await api("PUT", path(t.site.id), { token: t.owner.token, body: "nope" })).status).toBe(400);
    expect(await sql`SELECT 1 FROM website_privacy_settings WHERE site_id = ${t.site.id}`).toHaveLength(0);
  });

  it("is the owner's alone — admins cannot read or change it", async () => {
    const t = await seedTeam();
    for (const u of [t.admin, t.member, t.viewer, t.stranger]) {
      expect((await api("GET", path(t.site.id), { token: u.token })).status).toBe(403);
      expect((await api("PUT", path(t.site.id), { token: u.token, body: { respectDnt: true } })).status).toBe(403);
    }
    expect((await api("GET", path(t.site.id))).status).toBe(401);
    expect(await sql`SELECT 1 FROM website_privacy_settings WHERE site_id = ${t.site.id}`).toHaveLength(0);
  });
});
