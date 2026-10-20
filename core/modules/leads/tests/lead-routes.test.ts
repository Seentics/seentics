import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set("userId", c.req.header("x-test-user") ?? "");
    return next();
  },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createLeadRoutes } = await import("../routes");

const SITE = "11111111-1111-4111-8111-111111111111";
const FORM = "33333333-3333-4333-8333-333333333333";
const SUB = "22222222-2222-4222-8222-222222222222";

const roles: Record<string, string | null> = { owner: "owner", viewer: "viewer", stranger: null };
const calls: string[] = [];
let exists = true;

const stored = {
  id: SUB, email: "jane@example.com", name: "=Jane", phone: "", consent: true, fields: { company: "Acme" },
  prize: { id: "1", label: "10% off", coupon_code: "SAVE10" }, variant: "b", page_url: "/p", referrer: "", created_at: "2026-01-01T00:00:00.000Z",
};

const CONTACT = "44444444-4444-4444-8444-444444444444";
const siteRow = {
  ...stored, deliveries: [], automation_id: FORM, form_name: "Get 10% off", session_id: "s1", has_replay: true,
  channel: "paid" as const, utm_source: "facebook", utm_campaign: "spring", contact_id: CONTACT,
};
const contact = {
  id: CONTACT, email: "jane@example.com", name: "Jane", phone: "", status: "new" as const, tags: ["vip"], notes: "",
  source: "form" as const, submission_count: 1, first_seen_at: "2026-01-01T00:00:00.000Z", last_activity_at: "2026-01-02T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z", first_channel: "paid" as const,
  first_page_url: "/p", first_referrer: null, first_campaign: null,
};

function app() {
  const routes = createLeadRoutes({
    websites: { getRole: async (_s: string, u: string) => roles[u] ?? null } as any,
    queries: {
      listSubmissions: async (_s, f, q) => { calls.push(`list:${f}:${q.limit}:${q.offset}:${q.search}`); return { submissions: [{ ...stored, deliveries: [] }], total: 1 }; },
      summary: async (_s, f) => { calls.push(`summary:${f}`); return { total: 1, last_7_days: 1, last_30_days: 1, with_prize: 1, by_variant: [] }; },
      websiteSummary: async () => ({ total: 4, last_7_days: 2, this_month: 3 }),
      exportSubmissions: async (_s, f, limit) => { calls.push(`export:${f}:${limit}`); return [stored]; },
    },
    mutations: { deleteSubmission: async (_s, f, id) => { calls.push(`delete:${f}:${id}`); return exists; } },
    site: {
      listSubmissions: async (_s, q) => { calls.push(`site-list:${q.form}:${q.search}:${q.limit}:${q.delivery}`); return { submissions: [siteRow], total: 1 }; },
      exportSubmissions: async () => [siteRow],
      forms: async () => [{ id: FORM, name: "Get 10% off", count: 3 }],
      listContacts: async (_s, q) => { calls.push(`contacts:${q.status}:${q.tag}:${q.sort}:${q.channel}:${q.campaign}`); return { contacts: [contact], total: 1, statuses: { new: 1, contacted: 0, qualified: 0, customer: 0, lost: 0 } }; },
      exportContacts: async () => [contact],
      contact: async (_s, id) => (id === CONTACT ? { contact, submissions: [siteRow] } : null),
      tags: async () => [{ tag: "vip", count: 2 }],
      overview: async (_s, days) => {
        calls.push(`overview:${days}`);
        return { days, submissions: 12, new_contacts: 5, customers: 1, by_channel: [{ channel: "paid", count: 8 }], by_campaign: [{ campaign: "eid", count: 6 }], failed_deliveries: 2 };
      },
    },
    contacts: {
      create: async (_s, input) => { calls.push(`create:${input.email}:${input.status}`); return input.email === "taken@example.com" ? { exists: CONTACT } : { contact }; },
      update: async (_s, id, patch) => { calls.push(`update:${id}:${JSON.stringify(patch)}`); return id === CONTACT ? contact : null; },
      bulk: async (_s, ids, change) => { calls.push(`bulk:${ids.length}:${change.status}`); return ids.length; },
      remove: async (_s, ids, withSubs) => { calls.push(`remove:${ids.length}:${withSubs}`); return ids.length; },
      import: async (_s, rows, update) => { calls.push(`import:${rows.length}:${update}`); return { created: rows.length, updated: 0, skipped: 0, errors: [] }; },
      deleteSubmission: async (_s, id) => { calls.push(`site-delete:${id}`); return exists; },
    },
  });
  return new Hono().route("/leads", routes);
}

const req = (method: string, path: string, user = "owner", body?: unknown) =>
  app().request(`/leads/${SITE}${path}`, {
    method,
    headers: { "x-test-user": user, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

beforeEach(() => { calls.length = 0; exists = true; });

describe("form submission routes", () => {
  it("requires a session and membership", async () => {
    expect((await req("GET", `/forms/${FORM}/submissions`, "")).status).toBe(401);
    expect((await req("GET", `/forms/${FORM}/submissions`, "stranger")).status).toBe(403);
    expect((await req("GET", "/summary", "stranger")).status).toBe(403);
  });

  it("lists one form's submissions, with paging and search", async () => {
    const res = await req("GET", `/forms/${FORM}/submissions?limit=10&offset=20&search=jane`, "viewer");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(1);
    expect(body.data.submissions[0]).toMatchObject({ id: SUB, email: "jane@example.com", deliveries: [] });
    expect(calls).toEqual([`list:${FORM}:10:20:jane`]);
  });

  it("validates the query and the ids", async () => {
    expect((await req("GET", `/forms/${FORM}/submissions?limit=0`)).status).toBe(400);
    expect((await req("GET", `/forms/${FORM}/submissions?limit=500`)).status).toBe(400);
    expect((await req("GET", "/forms/not-a-uuid/submissions")).status).toBe(404);
    expect((await req("GET", "/forms/not-a-uuid/summary")).status).toBe(404);
    expect((await req("GET", "/forms/not-a-uuid/submissions.csv")).status).toBe(404);
    expect((await req("DELETE", `/forms/${FORM}/submissions/nope`)).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("summarises a form and the website", async () => {
    expect((await (await req("GET", `/forms/${FORM}/summary`, "viewer")).json()).data).toMatchObject({ total: 1, with_prize: 1 });
    expect((await (await req("GET", "/summary", "viewer")).json()).data).toEqual({ total: 4, last_7_days: 2, this_month: 3 });
  });

  it("exports CSV that cannot run as a spreadsheet formula", async () => {
    const res = await req("GET", `/forms/${FORM}/submissions.csv`, "viewer");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("submissions.csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toBe("submitted_at,email,name,phone,consent,variant,prize,coupon_code,page_url,referrer,company");
    expect(text).toContain("'=Jane");
    expect(calls).toEqual([`export:${FORM}:10000`]);
  });

  it("lets viewers read but not delete", async () => {
    expect((await req("DELETE", `/forms/${FORM}/submissions/${SUB}`, "viewer")).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("deletes a submission on that form, and 404s when it is not there", async () => {
    expect((await req("DELETE", `/forms/${FORM}/submissions/${SUB}`)).status).toBe(200);
    expect(calls).toEqual([`delete:${FORM}:${SUB}`]);
    exists = false;
    expect((await req("DELETE", `/forms/${FORM}/submissions/${SUB}`)).status).toBe(404);
  });

  it("keeps the old contacts-era endpoints gone", async () => {
    expect((await req("GET", "/stats")).status).toBe(404);
    expect((await req("GET", "/export")).status).toBe(404);
  });
});

describe("site-wide inbox routes", () => {
  it("lists every form's submissions, filtered, for any member", async () => {
    const res = await req("GET", `/submissions?form=${FORM}&search=jane&limit=10`, "viewer");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.submissions[0]).toMatchObject({ form_name: "Get 10% off", has_replay: true, channel: "paid", contact_id: CONTACT });
    expect(calls).toEqual([`site-list:${FORM}:jane:10:null`]);
    expect((await req("GET", "/submissions", "stranger")).status).toBe(403);
  });

  it("narrows to submissions a destination could not take", async () => {
    expect((await req("GET", "/submissions?delivery=failed", "viewer")).status).toBe(200);
    expect(calls).toEqual(["site-list:null::25:failed"]);
    expect((await req("GET", "/submissions?delivery=sent")).status).toBe(400);
  });

  it("gives the leads overview over a window, 30 days unless asked", async () => {
    const res = await req("GET", "/overview?days=7", "viewer");
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ days: 7, submissions: 12, failed_deliveries: 2 });
    expect((await req("GET", "/overview", "viewer")).status).toBe(200);
    expect(calls).toEqual(["overview:7", "overview:30"]);
    expect((await req("GET", "/overview?days=0")).status).toBe(400);
    expect((await req("GET", "/overview", "stranger")).status).toBe(403);
  });

  it("rejects a bad form id or date", async () => {
    expect((await req("GET", "/submissions?form=nope")).status).toBe(400);
    expect((await req("GET", "/submissions?from=yesterday-ish")).status).toBe(400);
  });

  it("lists forms for the filter and exports CSV", async () => {
    expect((await (await req("GET", "/forms", "viewer")).json()).data).toEqual([{ id: FORM, name: "Get 10% off", count: 3 }]);
    const res = await req("GET", "/submissions.csv", "viewer");
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("form,channel,utm_source,utm_campaign");
    // Formula-looking values are defused, as in the per-form export.
    expect(text).toContain("'=Jane");
  });

  it("deletes a submission only for members", async () => {
    expect((await req("DELETE", `/submissions/${SUB}`, "viewer")).status).toBe(403);
    expect((await req("DELETE", `/submissions/${SUB}`)).status).toBe(200);
    exists = false;
    expect((await req("DELETE", `/submissions/${SUB}`)).status).toBe(404);
    expect((await req("DELETE", "/submissions/nope")).status).toBe(404);
  });
});

describe("contact routes", () => {
  it("lists contacts with their filters", async () => {
    const res = await req("GET", "/contacts?status=new&tag=vip&sort=created", "viewer");
    expect(res.status).toBe(200);
    expect((await res.json()).data.statuses.new).toBe(1);
    expect(calls).toEqual(["contacts:new:vip:created:null:null"]);
    expect((await req("GET", "/contacts?status=hot")).status).toBe(400);
  });

  it("filters contacts by where they first came from", async () => {
    expect((await req("GET", "/contacts?channel=paid&campaign=eid-sale", "viewer")).status).toBe(200);
    expect(calls).toEqual(["contacts:null:null:last_activity:paid:eid-sale"]);
    expect((await req("GET", "/contacts?channel=billboard")).status).toBe(400);
  });

  it("lists the tags in use, not mistaking the path for a contact id", async () => {
    expect((await (await req("GET", "/contacts/tags", "viewer")).json()).data).toEqual([{ tag: "vip", count: 2 }]);
  });

  it("opens one contact with their submissions, or 404s", async () => {
    expect((await (await req("GET", `/contacts/${CONTACT}`, "viewer")).json()).data.submissions).toHaveLength(1);
    expect((await req("GET", `/contacts/${SUB}`, "viewer")).status).toBe(404);
    expect((await req("GET", "/contacts/nope", "viewer")).status).toBe(404);
  });

  it("adds a contact, lower-casing the email, and says when it exists", async () => {
    const res = await req("POST", "/contacts", "owner", { email: "  New@Example.com ", tags: ["a"] });
    expect(res.status).toBe(201);
    expect(calls).toEqual(["create:new@example.com:new"]);
    const taken = await req("POST", "/contacts", "owner", { email: "taken@example.com" });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: "exists", contact_id: CONTACT });
    expect((await req("POST", "/contacts", "owner", { email: "nope" })).status).toBe(400);
    expect((await req("POST", "/contacts", "viewer", { email: "a@b.co" })).status).toBe(403);
  });

  it("edits a contact but never its email", async () => {
    expect((await req("PATCH", `/contacts/${CONTACT}`, "owner", { status: "customer", notes: "Called" })).status).toBe(200);
    expect(calls).toEqual([`update:${CONTACT}:{"status":"customer","notes":"Called"}`]);
    expect((await req("PATCH", `/contacts/${CONTACT}`, "owner", { email: "other@example.com" })).status).toBe(400);
    expect((await req("PATCH", `/contacts/${SUB}`, "owner", { name: "x" })).status).toBe(404);
    expect((await req("PATCH", `/contacts/${CONTACT}`, "viewer", { name: "x" })).status).toBe(403);
  });

  it("changes, deletes and imports in bulk", async () => {
    expect((await req("POST", "/contacts/bulk", "owner", { ids: [CONTACT], status: "lost" })).status).toBe(200);
    expect((await req("POST", "/contacts/bulk", "owner", { ids: [CONTACT] })).status).toBe(400);
    expect((await req("POST", "/contacts/delete", "owner", { ids: [CONTACT], with_submissions: true })).status).toBe(200);
    expect((await req("POST", "/contacts/import", "owner", { rows: [{ email: "a@b.co" }], update_existing: true })).status).toBe(200);
    expect((await req("POST", "/contacts/import", "owner", { rows: [] })).status).toBe(400);
    expect(calls).toEqual(["bulk:1:lost", "remove:1:true", "import:1:true"]);
  });

  it("exports contacts with the columns an import reads back", async () => {
    const text = await (await req("GET", "/contacts.csv", "viewer")).text();
    expect(text.split("\r\n")[0]).toBe("email,name,phone,status,tags,notes,source,submissions,first_seen_at,last_activity_at,first_channel,first_page_url,first_referrer");
    expect(text).toContain("jane@example.com,Jane,,new,vip");
  });
});
