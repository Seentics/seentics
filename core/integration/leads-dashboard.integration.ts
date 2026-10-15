import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { seedConnection, seedPopup, seedSubmission } from "./helpers/leads";

/** An owner, their site, one popup and a viewer and member on it. */
async function setup() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  const popup = await seedPopup(site.id, owner.id);
  const viewer = await seedUser();
  const member = await seedUser();
  await addMember(site.id, viewer.id, "viewer");
  await addMember(site.id, member.id, "member");
  return { owner, site, popup, viewer, member };
}

const base = (siteId: string, popup: string) => `/api/v1/leads/${siteId}/forms/${popup}`;

describe("GET /api/v1/leads/:site/forms/:automation/submissions", () => {
  it("lists one form's submissions newest first, with their delivery statuses", async () => {
    const { owner, site, popup } = await setup();
    const conn = await seedConnection(site.id);
    const older = await seedSubmission(site.id, popup, { email: "old@l.test", createdAt: new Date(Date.now() - 60_000) });
    const newer = await seedSubmission(site.id, popup, { email: "new@l.test" });
    await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, status)
              VALUES (${conn}::uuid, ${site.id}::uuid, ${newer}::uuid, 'success')`;
    // Another form on the same site is not part of this list.
    await seedSubmission(site.id, await seedPopup(site.id, owner.id));

    const res = await api("GET", `${base(site.id, popup)}/submissions`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.submissions.map((s: { id: string }) => s.id)).toEqual([newer, older]);
    expect(res.body.data.submissions[0].deliveries).toEqual([expect.objectContaining({ connection_id: conn, status: "success" })]);
    expect(res.body.data.submissions[1].deliveries).toEqual([]);
  });

  it("searches email and name, treating LIKE wildcards literally", async () => {
    const { owner, site, popup } = await setup();
    await seedSubmission(site.id, popup, { email: "alice@l.test", name: "Alice" });
    await seedSubmission(site.id, popup, { email: "bob@l.test", name: "Bob_100%" });

    const byName = await api("GET", `${base(site.id, popup)}/submissions`, { token: owner.token, query: { search: "alice" } });
    expect(byName.body.data.submissions.map((s: { email: string }) => s.email)).toEqual(["alice@l.test"]);
    // `%` would match everything if passed through as a wildcard.
    const literal = await api("GET", `${base(site.id, popup)}/submissions`, { token: owner.token, query: { search: "%" } });
    expect(literal.body.data.submissions.map((s: { email: string }) => s.email)).toEqual(["bob@l.test"]);
  });

  it("pages with limit and offset", async () => {
    const { owner, site, popup } = await setup();
    for (let i = 0; i < 3; i++) await seedSubmission(site.id, popup, { createdAt: new Date(Date.now() - i * 1000) });
    const res = await api("GET", `${base(site.id, popup)}/submissions`, { token: owner.token, query: { limit: 2, offset: 2 } });
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.submissions).toHaveLength(1);
  });

  it("rejects an out-of-range query with 400 and a non-uuid form with 404", async () => {
    const { owner, site, popup } = await setup();
    expect((await api("GET", `${base(site.id, popup)}/submissions`, { token: owner.token, query: { limit: 1000 } })).status).toBe(400);
    expect((await api("GET", `${base(site.id, popup)}/submissions`, { token: owner.token, query: { offset: -1 } })).status).toBe(400);
    expect((await api("GET", `${base(site.id, "not-a-uuid")}/submissions`, { token: owner.token })).status).toBe(404);
  });

  it("lets a viewer read", async () => {
    const { viewer, site, popup } = await setup();
    await seedSubmission(site.id, popup);
    const res = await api("GET", `${base(site.id, popup)}/submissions`, { token: viewer.token });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  it("requires a session", async () => {
    const { site, popup } = await setup();
    expect((await api("GET", `${base(site.id, popup)}/submissions`)).status).toBe(401);
    expect((await api("GET", `/api/v1/leads/${site.id}/summary`)).status).toBe(401);
    expect((await api("GET", `${base(site.id, popup)}/submissions.csv`)).status).toBe(401);
  });

  it("refuses another account's site", async () => {
    const { site, popup } = await setup();
    await seedSubmission(site.id, popup);
    const stranger = await seedUser();
    for (const path of [`${base(site.id, popup)}/submissions`, `${base(site.id, popup)}/summary`, `${base(site.id, popup)}/submissions.csv`, `/api/v1/leads/${site.id}/summary`]) {
      const res = await api("GET", path, { token: stranger.token });
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });

  it("cannot read another site's form through one's own site id", async () => {
    // The automation id belongs to site B; the caller is owner of site A only.
    const a = await setup();
    const b = await setup();
    await seedSubmission(b.site.id, b.popup, { email: "secret@b.test" });
    const res = await api("GET", `${base(a.site.id, b.popup)}/submissions`, { token: a.owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ submissions: [], total: 0 });
  });
});

describe("summaries", () => {
  it("summarises one form: totals, recent windows, prizes and variants", async () => {
    const { owner, site, popup } = await setup();
    await seedSubmission(site.id, popup, { variant: "a" });
    await seedSubmission(site.id, popup, { variant: "a" });
    await seedSubmission(site.id, popup, { variant: "b", createdAt: new Date(Date.now() - 10 * 86_400_000) });
    await sql`UPDATE form_submissions SET prize = '{"id":"0","label":"x","coupon_code":null}'::jsonb
              WHERE website_id = ${site.id}::uuid AND variant = 'b'`;

    const res = await api("GET", `${base(site.id, popup)}/summary`, { token: owner.token });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total: 3,
      last_7_days: 2,
      last_30_days: 3,
      with_prize: 1,
      by_variant: [{ variant: "a", count: 2 }, { variant: "b", count: 1 }],
    });
  });

  it("summarises the whole site across forms and unattributed leads", async () => {
    const { viewer, site, popup } = await setup();
    await seedSubmission(site.id, popup);
    await seedSubmission(site.id, null);
    await seedSubmission(site.id, null, { createdAt: new Date(Date.now() - 40 * 86_400_000) });

    const res = await api("GET", `/api/v1/leads/${site.id}/summary`, { token: viewer.token });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.last_7_days).toBe(2);
  });
});

describe("GET .../submissions.csv", () => {
  it("exports a form's submissions as an attachment, extra fields as sorted columns", async () => {
    const { viewer, site, popup } = await setup();
    await seedSubmission(site.id, popup, { email: "a@l.test", name: "Ann", fields: { zeta: "z", alpha: 1 } });

    const res = await api("GET", `${base(site.id, popup)}/submissions.csv`, { token: viewer.token });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [header, row] = res.text.trim().split("\r\n");
    expect(header).toBe("submitted_at,email,name,phone,consent,variant,prize,coupon_code,page_url,referrer,alpha,zeta");
    expect(row).toContain("a@l.test,Ann");
    expect(row!.endsWith(",1,z")).toBe(true);
  });

  it("neutralises spreadsheet formulas a visitor typed into a lead", async () => {
    // A lead's name is attacker-controlled and the owner opens the export in Excel.
    const { owner, site, popup } = await setup();
    await seedSubmission(site.id, popup, { email: "f@l.test", name: '=HYPERLINK("http://evil.test","x")', fields: { note: "+1+1", at: "@SUM(A1)", dash: "-2" } });

    const res = await api("GET", `${base(site.id, popup)}/submissions.csv`, { token: owner.token });

    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
    expect(res.text).toContain("'+1+1");
    expect(res.text).toContain("'@SUM(A1)");
    expect(res.text).toContain("'-2");
    expect(res.text).not.toMatch(/(^|,)[=+@]/m);
  });

  it("exports nothing of another site's form", async () => {
    const a = await setup();
    const b = await setup();
    await seedSubmission(b.site.id, b.popup, { email: "secret@b.test" });
    const res = await api("GET", `${base(a.site.id, b.popup)}/submissions.csv`, { token: a.owner.token });
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("secret@b.test");
  });
});

describe("DELETE .../submissions/:id", () => {
  it("lets a member erase a submission, cancelling its pending deliveries and blanking sent ones", async () => {
    const { member, site, popup } = await setup();
    const id = await seedSubmission(site.id, popup);
    const pending = await seedConnection(site.id);
    const sent = await seedConnection(site.id);
    await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload, status) VALUES
              (${pending}::uuid, ${site.id}::uuid, ${id}::uuid, '{"email":"x"}'::jsonb, 'pending'),
              (${sent}::uuid, ${site.id}::uuid, ${id}::uuid, '{"email":"x"}'::jsonb, 'success')`;

    const res = await api("DELETE", `${base(site.id, popup)}/submissions/${id}`, { token: member.token });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id });
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${id}::uuid`).toHaveLength(0);
    const left = await sql<{ status: string; payload: unknown }[]>`SELECT status, payload FROM integration_deliveries WHERE submission_id = ${id}::uuid`;
    expect([...left]).toEqual([{ status: "success", payload: null }]);
  });

  it("refuses a viewer with 403 and keeps the submission", async () => {
    const { viewer, site, popup } = await setup();
    const id = await seedSubmission(site.id, popup);
    const res = await api("DELETE", `${base(site.id, popup)}/submissions/${id}`, { token: viewer.token });
    expect(res.status).toBe(403);
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${id}::uuid`).toHaveLength(1);
  });

  it("requires a session and refuses a stranger", async () => {
    const { site, popup } = await setup();
    const id = await seedSubmission(site.id, popup);
    expect((await api("DELETE", `${base(site.id, popup)}/submissions/${id}`)).status).toBe(401);
    const stranger = await seedUser();
    expect((await api("DELETE", `${base(site.id, popup)}/submissions/${id}`, { token: stranger.token })).status).toBe(403);
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${id}::uuid`).toHaveLength(1);
  });

  it("cannot erase another site's submission through one's own site, nor under the wrong form", async () => {
    const a = await setup();
    const b = await setup();
    const theirs = await seedSubmission(b.site.id, b.popup);
    const otherForm = await seedPopup(b.site.id, b.owner.id);

    expect((await api("DELETE", `${base(a.site.id, b.popup)}/submissions/${theirs}`, { token: a.owner.token })).status).toBe(404);
    expect((await api("DELETE", `${base(b.site.id, otherForm)}/submissions/${theirs}`, { token: b.owner.token })).status).toBe(404);
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${theirs}::uuid`).toHaveLength(1);
  });

  it("answers 404 for an unknown or malformed id", async () => {
    const { owner, site, popup } = await setup();
    expect((await api("DELETE", `${base(site.id, popup)}/submissions/${randomUUID()}`, { token: owner.token })).status).toBe(404);
    expect((await api("DELETE", `${base(site.id, popup)}/submissions/nope`, { token: owner.token })).status).toBe(404);
  });
});
