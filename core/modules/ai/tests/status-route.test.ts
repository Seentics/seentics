import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    const user = c.req.header("x-test-user");
    if (!user) return c.json({ error: "Authorization required" }, 401);
    c.set("userId", user);
    return next();
  },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createAiRoutes } = await import("../routes");

const app = (configured: boolean) =>
  new Hono().route("/ai", createAiRoutes({ configured } as any));

describe("GET /ai/status", () => {
  it("says whether a model provider is configured", async () => {
    for (const configured of [true, false]) {
      const res = await app(configured).request("/ai/status", { headers: { "x-test-user": "u1" } });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ data: { configured } });
    }
  });

  it("needs a signed-in user", async () => {
    expect((await app(true).request("/ai/status")).status).toBe(401);
  });
});
