import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set("userId", c.req.header("x-test-user") ?? "");
    return next();
  },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createErrorRoutes } = await import("../routes");

const WEBSITE = "11111111-1111-4111-8111-111111111111";
const FP = "a".repeat(64);

let listed: unknown[] = [];
let group: unknown = null;
let statusUpdated: boolean = true;
const setStatusCalls: Array<{ websiteId: string; fingerprint: string; status: string }> = [];

/** Membership: any user except "stranger" belongs to the site. */
const websites = { getRole: async (_id: string, userId: string) =>
  (userId === "stranger" ? null : "owner") } as any;

function app() {
  const routes = createErrorRoutes({
    queries: {
      listGroups: async () => ({ groups: listed as any }),
      getGroup: async () => ({ group: group as any, samples: [] }),
    },
    mutations: {
      setStatus: async (websiteId, fingerprint, status) => {
        setStatusCalls.push({ websiteId, fingerprint, status });
        return statusUpdated;
      },
    },
    websites,
  });
  return new Hono().route("/errors", routes);
}

const get = (path: string, user = "u1") =>
  app().request(`/errors${path}`, { headers: { "x-test-user": user } });

const patch = (path: string, body: unknown, user = "u1") =>
  app().request(`/errors${path}`, {
    method: "PATCH",
    headers: { "x-test-user": user, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("error routes", () => {
  beforeEach(() => {
    listed = [];
    group = { fingerprint: FP, message: "boom" };
    statusUpdated = true;
    setStatusCalls.length = 0;
  });

  describe("access", () => {
    it("refuses an anonymous caller", async () => {
      const res = await get(`/${WEBSITE}/groups`, "");
      expect(res.status).toBe(403);
    });

    it("refuses a user who is not a member of the site", async () => {
      // The fingerprint is guessable, so membership is the only thing standing between
      // one tenant and another's faults.
      const res = await get(`/${WEBSITE}/groups`, "stranger");
      expect(res.status).toBe(403);
    });

    it("refuses a non-member on the detail route too", async () => {
      const res = await get(`/${WEBSITE}/groups/${FP}`, "stranger");
      expect(res.status).toBe(403);
    });

    it("refuses a non-member on the status route", async () => {
      const res = await patch(`/${WEBSITE}/groups/${FP}`, { status: "resolved" }, "stranger");
      expect(res.status).toBe(403);
      expect(setStatusCalls).toHaveLength(0);
    });
  });

  describe("listing", () => {
    it("returns the groups", async () => {
      listed = [{ fingerprint: FP }];
      const res = await get(`/${WEBSITE}/groups`);
      expect(res.status).toBe(200);
      expect((await res.json() as any).groups).toHaveLength(1);
    });

    it("rejects an unknown status instead of answering with an empty list", async () => {
      // Matching nothing would read as "no errors", the most misleading answer this
      // endpoint can give.
      const res = await get(`/${WEBSITE}/groups?status=nonsense`);
      expect(res.status).toBe(400);
    });

    it("accepts each real status", async () => {
      for (const s of ["unresolved", "resolved", "ignored"]) {
        expect((await get(`/${WEBSITE}/groups?status=${s}`)).status).toBe(200);
      }
    });

    it("treats an absent status as every status", async () => {
      expect((await get(`/${WEBSITE}/groups`)).status).toBe(200);
    });
  });

  describe("detail", () => {
    it("404s for a fingerprint that is not this site's", async () => {
      group = null;
      const res = await get(`/${WEBSITE}/groups/${FP}`);
      expect(res.status).toBe(404);
    });

    it("returns the group when it exists", async () => {
      const res = await get(`/${WEBSITE}/groups/${FP}`);
      expect(res.status).toBe(200);
      expect((await res.json() as any).group.fingerprint).toBe(FP);
    });
  });

  describe("status changes", () => {
    it("updates and echoes the new status", async () => {
      const res = await patch(`/${WEBSITE}/groups/${FP}`, { status: "resolved" });
      expect(res.status).toBe(200);
      expect(setStatusCalls[0]).toEqual({
        websiteId: WEBSITE, fingerprint: FP, status: "resolved",
      });
    });

    it("rejects an unknown status", async () => {
      const res = await patch(`/${WEBSITE}/groups/${FP}`, { status: "wontfix" });
      expect(res.status).toBe(400);
      expect(setStatusCalls).toHaveLength(0);
    });

    it("rejects a missing status", async () => {
      const res = await patch(`/${WEBSITE}/groups/${FP}`, {});
      expect(res.status).toBe(400);
    });

    it("rejects a malformed body rather than throwing", async () => {
      const res = await patch(`/${WEBSITE}/groups/${FP}`, "not json");
      expect(res.status).toBe(400);
    });

    it("404s when the group does not belong to this site", async () => {
      statusUpdated = false;
      const res = await patch(`/${WEBSITE}/groups/${FP}`, { status: "resolved" });
      expect(res.status).toBe(404);
    });
  });
});
