import { describe, expect, it } from "bun:test";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { seedConnection, seedPopup, seedSubmission, submit } from "./helpers/leads";

/** An owner, their site, one popup, and a viewer on it. */
async function setup() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  const popup = await seedPopup(site.id, owner.id);
  const viewer = await seedUser();
  await addMember(site.id, viewer.id, "viewer");
  return { owner, site, popup, viewer };
}

const L = (siteId: string) => `/api/v1/leads/${siteId}`;

describe("contacts made by submissions", () => {
  it("creates a contact on the first submission and refreshes it on the next, without overwriting edits", async () => {
    const { owner, site, popup } = await setup();
    const first = await submit({
      website_id: site.id, email: " Jane@Example.com ", name: "Jane", automation_id: popup, anonymous_id: "v1",
      page_url: "https://shop.test/?utm_source=facebook&utm_medium=cpc&utm_campaign=spring", referrer: "",
    });
    expect(first.status).toBe(200);

    let list = await api("GET", `${L(site.id)}/contacts`, { token: owner.token });
    expect(list.body.data.total).toBe(1);
    const contact = list.body.data.contacts[0];
    expect(contact).toMatchObject({
      email: "jane@example.com", name: "Jane", status: "new", source: "form", submission_count: 1,
      first_channel: "paid", first_page_url: "https://shop.test/?utm_source=facebook&utm_medium=cpc&utm_campaign=spring",
    });

    // The owner corrects the name; a later submission with a phone fills the phone only.
    await api("PATCH", `${L(site.id)}/contacts/${contact.id}`, { token: owner.token, body: { name: "Jane Doe", status: "contacted" } });
    await submit({ website_id: site.id, email: "jane@example.com", name: "J", phone: "+8801700000000", automation_id: popup, page_url: "https://shop.test/b" });

    list = await api("GET", `${L(site.id)}/contacts`, { token: owner.token });
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.contacts[0]).toMatchObject({
      name: "Jane Doe", phone: "+8801700000000", status: "contacted", submission_count: 2,
      // First touch stays the first one.
      first_channel: "paid",
    });
  });

  it("opens a contact with their submissions, newest first, each with its form and channel", async () => {
    const { owner, site, popup } = await setup();
    await submit({ website_id: site.id, email: "a@l.test", automation_id: popup, page_url: "https://shop.test/x", referrer: "https://www.google.com/" });
    await submit({ website_id: site.id, email: "a@l.test", page_url: "https://shop.test/y" });
    const [c] = await sql<{ id: string }[]>`SELECT id::text FROM contacts WHERE website_id = ${site.id}::uuid`;

    const res = await api("GET", `${L(site.id)}/contacts/${c!.id}`, { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data.contact.first_channel).toBe("organic");
    expect(res.body.data.submissions.map((s: { page_url: string }) => s.page_url)).toEqual(["https://shop.test/y", "https://shop.test/x"]);
    expect(res.body.data.submissions[1]).toMatchObject({ form_name: "Popup", channel: "organic", contact_id: c!.id, has_replay: false });
  });
});

describe("managing contacts", () => {
  it("adds one by hand, refuses a duplicate with its id, and lists by status, tag and source", async () => {
    const { owner, site, viewer } = await setup();
    const add = await api("POST", `${L(site.id)}/contacts`, {
      token: owner.token, body: { email: "Walk.In@Shop.test", name: "Walk-in", status: "qualified", tags: ["store", " store ", "vip"] },
    });
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({ email: "walk.in@shop.test", source: "manual", status: "qualified", tags: ["store", "vip"], submission_count: 0, first_channel: null });

    const dup = await api("POST", `${L(site.id)}/contacts`, { token: owner.token, body: { email: "walk.in@shop.test" } });
    expect(dup.status).toBe(409);
    expect(dup.body.contact_id).toBe(add.body.data.id);

    expect((await api("POST", `${L(site.id)}/contacts`, { token: viewer.token, body: { email: "x@y.test" } })).status).toBe(403);

    await seedSubmission(site.id, null, { email: "form@l.test" });
    await sql`INSERT INTO contacts (website_id, email) VALUES (${site.id}::uuid, 'form@l.test')`;
    const tags = await api("GET", `${L(site.id)}/contacts/tags`, { token: viewer.token });
    expect(tags.body.data).toEqual([{ tag: "store", count: 1 }, { tag: "vip", count: 1 }]);
    const byTag = await api("GET", `${L(site.id)}/contacts`, { token: viewer.token, query: { tag: "vip" } });
    expect(byTag.body.data.contacts.map((c: { email: string }) => c.email)).toEqual(["walk.in@shop.test"]);
    const bySource = await api("GET", `${L(site.id)}/contacts`, { token: viewer.token, query: { source: "form" } });
    expect(bySource.body.data.contacts.map((c: { email: string }) => c.email)).toEqual(["form@l.test"]);
    // Status counts ignore the status filter itself, so each chip says what picking it shows.
    const qualified = await api("GET", `${L(site.id)}/contacts`, { token: viewer.token, query: { status: "qualified" } });
    expect(qualified.body.data.total).toBe(1);
    expect(qualified.body.data.statuses).toMatchObject({ qualified: 1, new: 1 });
  });

  it("changes status and tags in bulk, and only on this site's contacts", async () => {
    const { owner, site } = await setup();
    const other = await seedWebsite(owner.id);
    const mine = await sql<{ id: string }[]>`
      INSERT INTO contacts (website_id, email, tags) VALUES (${site.id}::uuid, 'a@x.test', '{old}'), (${site.id}::uuid, 'b@x.test', '{}') RETURNING id::text`;
    const [theirs] = await sql<{ id: string }[]>`INSERT INTO contacts (website_id, email) VALUES (${other.id}::uuid, 'c@x.test') RETURNING id::text`;

    const res = await api("POST", `${L(site.id)}/contacts/bulk`, {
      token: owner.token, body: { ids: [...mine.map((r) => r.id), theirs!.id], status: "customer", add_tags: ["paid"], remove_tags: ["old"] },
    });
    expect(res.body.data.updated).toBe(2);
    const rows = await sql<{ email: string; status: string; tags: string[] }[]>`
      SELECT email, status, tags FROM contacts WHERE website_id IN (${site.id}::uuid, ${other.id}::uuid) ORDER BY email`;
    expect([...rows]).toEqual([
      { email: "a@x.test", status: "customer", tags: ["paid"] },
      { email: "b@x.test", status: "customer", tags: ["paid"] },
      { email: "c@x.test", status: "new", tags: [] },
    ]);
  });

  it("deletes contacts, and with their submissions takes those and their queued deliveries too", async () => {
    const { owner, site, popup } = await setup();
    const conn = await seedConnection(site.id);
    const sub = await seedSubmission(site.id, popup, { email: "gone@l.test" });
    await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, status, payload)
              VALUES (${conn}::uuid, ${site.id}::uuid, ${sub}::uuid, 'pending', '{"email":"gone@l.test"}'::jsonb)`;
    const kept = await seedSubmission(site.id, popup, { email: "keep@l.test" });
    const [gone] = await sql<{ id: string }[]>`INSERT INTO contacts (website_id, email) VALUES (${site.id}::uuid, 'gone@l.test') RETURNING id::text`;
    const [keep] = await sql<{ id: string }[]>`INSERT INTO contacts (website_id, email) VALUES (${site.id}::uuid, 'keep@l.test') RETURNING id::text`;

    // Without submissions: the contact goes, the submission stays to age out.
    await api("POST", `${L(site.id)}/contacts/delete`, { token: owner.token, body: { ids: [keep!.id] } });
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${kept}::uuid`).toHaveLength(1);

    const res = await api("POST", `${L(site.id)}/contacts/delete`, { token: owner.token, body: { ids: [gone!.id], with_submissions: true } });
    expect(res.body.data.deleted).toBe(1);
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${sub}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM integration_deliveries WHERE submission_id = ${sub}::uuid AND status = 'pending'`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM contacts WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("imports a file: new emails are created, existing ones skipped or updated, bad rows reported", async () => {
    const { owner, site } = await setup();
    await sql`INSERT INTO contacts (website_id, email, name, status, tags) VALUES (${site.id}::uuid, 'old@x.test', 'Old', 'contacted', '{a}')`;
    const rows = [
      { email: "OLD@x.test", name: "", status: "customer", tags: ["b"] },
      { email: "new@x.test", name: "New", tags: ["vip"] },
      { email: "nope" },
    ];

    const skip = await api("POST", `${L(site.id)}/contacts/import`, { token: owner.token, body: { rows } });
    expect(skip.body.data).toEqual({ created: 1, updated: 0, skipped: 1, errors: [{ row: 3, reason: "Not an email address: nope" }] });
    let old = await sql<{ name: string; status: string; tags: string[]; source: string }[]>`SELECT name, status, tags, source FROM contacts WHERE website_id = ${site.id}::uuid AND email = 'old@x.test'`;
    expect(old[0]).toEqual({ name: "Old", status: "contacted", tags: ["a"], source: "form" });

    const update = await api("POST", `${L(site.id)}/contacts/import`, { token: owner.token, body: { rows, update_existing: true } });
    expect(update.body.data).toMatchObject({ created: 0, updated: 2, skipped: 0 });
    old = await sql`SELECT name, status, tags, source FROM contacts WHERE website_id = ${site.id}::uuid AND email = 'old@x.test'`;
    // An empty cell keeps the stored value; tags are added, not replaced.
    expect(old[0]).toEqual({ name: "Old", status: "customer", tags: ["a", "b"], source: "form" });
    const fresh = await sql<{ source: string; tags: string[] }[]>`SELECT source, tags FROM contacts WHERE website_id = ${site.id}::uuid AND email = 'new@x.test'`;
    expect(fresh[0]).toEqual({ source: "import", tags: ["vip"] });
  });
});

describe("the site-wide inbox", () => {
  it("lists every form's submissions with filters, and the forms that have them", async () => {
    const { owner, site, popup, viewer } = await setup();
    const second = await seedPopup(site.id, owner.id);
    await seedSubmission(site.id, popup, { email: "a@l.test", createdAt: new Date("2026-01-10T00:00:00Z") });
    await seedSubmission(site.id, second, { email: "b@l.test", createdAt: new Date("2026-01-20T00:00:00Z") });
    await seedSubmission((await seedWebsite(owner.id)).id, null, { email: "elsewhere@l.test" });

    const all = await api("GET", `${L(site.id)}/submissions`, { token: viewer.token });
    expect(all.body.data.submissions.map((s: { email: string }) => s.email)).toEqual(["b@l.test", "a@l.test"]);
    const one = await api("GET", `${L(site.id)}/submissions`, { token: viewer.token, query: { form: popup } });
    expect(one.body.data.submissions.map((s: { email: string }) => s.email)).toEqual(["a@l.test"]);
    const range = await api("GET", `${L(site.id)}/submissions`, { token: viewer.token, query: { from: "2026-01-15T00:00:00Z", to: "2026-02-01T00:00:00Z" } });
    expect(range.body.data.submissions.map((s: { email: string }) => s.email)).toEqual(["b@l.test"]);

    const forms = await api("GET", `${L(site.id)}/forms`, { token: viewer.token });
    expect(forms.body.data).toEqual(expect.arrayContaining([{ id: popup, name: "Popup", count: 1 }, { id: second, name: "Popup", count: 1 }]));
  });

  it("deletes a submission from any form, but not another site's", async () => {
    const { owner, site, popup } = await setup();
    const sub = await seedSubmission(site.id, popup);
    const otherSite = await seedWebsite(owner.id);
    const theirs = await seedSubmission(otherSite.id, null);
    expect((await api("DELETE", `${L(site.id)}/submissions/${theirs}`, { token: owner.token })).status).toBe(404);
    expect((await api("DELETE", `${L(site.id)}/submissions/${sub}`, { token: owner.token })).status).toBe(200);
    expect(await sql`SELECT 1 FROM form_submissions WHERE id = ${sub}::uuid`).toHaveLength(0);
  });
});

describe("a visitor's data request", () => {
  it("exports and erases the contact their submissions made", async () => {
    const { owner, site } = await setup();
    await submit({ website_id: site.id, email: "visitor@l.test", anonymous_id: "vis-1", session_id: "ses-1" });
    expect(await sql`SELECT 1 FROM contacts WHERE website_id = ${site.id}::uuid AND email = 'visitor@l.test'`).toHaveLength(1);

    const exported = await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { visitor_id: "vis-1" } });
    expect(exported.status).toBe(200);
    expect(JSON.stringify(exported.body)).toContain("visitor@l.test");
    expect(exported.body.data.contacts).toEqual(expect.arrayContaining([expect.objectContaining({ email: "visitor@l.test" })]));

    const erased = await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { visitor_id: "vis-1" } });
    expect(erased.status).toBeLessThan(300);
    expect(await sql`SELECT 1 FROM contacts WHERE website_id = ${site.id}::uuid AND email = 'visitor@l.test'`).toHaveLength(0);
  });
});
