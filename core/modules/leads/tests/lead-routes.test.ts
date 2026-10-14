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
  });
  return new Hono().route("/leads", routes);
}

const req = (method: string, path: string, user = "owner") =>
  app().request(`/leads/${SITE}${path}`, { method, headers: { "x-test-user": user } });

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

  it("has no site-wide inbox any more", async () => {
    expect((await req("GET", "/contacts")).status).toBe(404);
    expect((await req("GET", "/stats")).status).toBe(404);
    expect((await req("GET", "/export")).status).toBe(404);
  });
});
