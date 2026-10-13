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
const CONTACT = "22222222-2222-4222-8222-222222222222";

const roles: Record<string, string | null> = { owner: "owner", viewer: "viewer", stranger: null };
const calls: string[] = [];
let contactExists = true;

const contact = {
  id: CONTACT, email: "jane@example.com", name: "=Jane", phone: "", status: "new", consent: true,
  submission_count: 2, first_submitted_at: "2026-01-01", last_submitted_at: "2026-01-02",
};

function app() {
  const routes = createLeadRoutes({
    websites: { getRole: async (_s: string, u: string) => roles[u] ?? null } as any,
    queries: {
      listContacts: async (_s, q) => { calls.push(`list:${q.limit}:${q.status}:${q.search}`); return { contacts: [contact as any], total: 1 }; },
      getContact: async () => (contactExists ? { contact: contact as any, submissions: [] } : null),
      stats: async () => ({ total: 1, last_7_days: 1, by_automation: [] }),
      exportContacts: async () => [contact as any],
    },
    mutations: {
      setStatus: async (_s, id, status) => { calls.push(`status:${id}:${status}`); return contactExists; },
      deleteContact: async (_s, id) => { calls.push(`delete:${id}`); return contactExists; },
    },
  });
  return new Hono().route("/leads", routes);
}

const req = (method: string, path: string, user = "owner", body?: unknown) =>
  app().request(`/leads/${SITE}${path}`, {
    method,
    headers: { "x-test-user": user, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => { calls.length = 0; contactExists = true; });

describe("leads dashboard routes", () => {
  it("requires a session and membership", async () => {
    expect((await req("GET", "/contacts", "")).status).toBe(401);
    expect((await req("GET", "/contacts", "stranger")).status).toBe(403);
  });

  it("lists with validated, defaulted query params", async () => {
    const res = await req("GET", "/contacts?status=new&search=jane");
    expect(res.status).toBe(200);
    expect(calls).toContain("list:25:new:jane");
    expect((await req("GET", "/contacts?status=bogus")).status).toBe(400);
    expect((await req("GET", "/contacts?limit=9999")).status).toBe(400);
  });

  it("returns a contact, or 404 for a malformed or unknown id", async () => {
    expect((await req("GET", `/contacts/${CONTACT}`)).status).toBe(200);
    expect((await req("GET", "/contacts/not-a-uuid")).status).toBe(404);
    contactExists = false;
    expect((await req("GET", `/contacts/${CONTACT}`)).status).toBe(404);
  });

  it("lets viewers read but not change or erase", async () => {
    expect((await req("GET", "/contacts", "viewer")).status).toBe(200);
    expect((await req("PATCH", `/contacts/${CONTACT}`, "viewer", { status: "archived" })).status).toBe(403);
    expect((await req("DELETE", `/contacts/${CONTACT}`, "viewer")).status).toBe(403);
    expect(calls.filter((c) => c.startsWith("status") || c.startsWith("delete"))).toHaveLength(0);
  });

  it("updates status and rejects an unknown one", async () => {
    expect((await req("PATCH", `/contacts/${CONTACT}`, "owner", { status: "contacted" })).status).toBe(200);
    expect(calls).toContain(`status:${CONTACT}:contacted`);
    expect((await req("PATCH", `/contacts/${CONTACT}`, "owner", { status: "nope" })).status).toBe(400);
  });

  it("deletes, and 404s when the contact is not on this site", async () => {
    expect((await req("DELETE", `/contacts/${CONTACT}`)).status).toBe(200);
    contactExists = false;
    expect((await req("DELETE", `/contacts/${CONTACT}`)).status).toBe(404);
  });

  it("exports CSV with formula-looking cells defused", async () => {
    const res = await req("GET", "/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toBe("email,name,phone,status,consent,submissions,first_submitted_at,last_submitted_at");
    expect(text).toContain("'=Jane");
  });
});
