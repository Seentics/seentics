import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { websiteAccessHandler } from "../routes";

/**
 * `/website-access` is what Observe's access check calls. It used to call the
 * user-facing `/websites/:id`, which behind the gateway also requires an analytics
 * permission header only the gateway sets — so every Observe project was a 403.
 *
 * The handler is tested on its own; the service-key middleware in front of it is the
 * one every internal route shares.
 */

const roles: Record<string, string> = { "site-1:owner-1": "owner", "site-1:member-1": "viewer" };

const app = new Hono().get(
  "/website-access",
  websiteAccessHandler({
    getById: async (id: string) => (id === "site-1" ? ({ id, ownerId: "owner-1" } as never) : null),
    listOwnedBy: async () => [],
    getRole: async (websiteId: string, userId: string) => (roles[`${websiteId}:${userId}`] ?? null) as never,
  }),
);

const get = (qs: string) => app.request(`/website-access?${qs}`);

describe("GET /website-access", () => {
  it("returns the owner and the caller's role", async () => {
    const res = await get("website_id=site-1&user_id=member-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { owner_id: "owner-1", role: "viewer" } });
  });

  it("answers role null for a user without access, so the caller can refuse", async () => {
    expect(await (await get("website_id=site-1&user_id=stranger")).json()).toEqual({
      data: { owner_id: "owner-1", role: null },
    });
  });

  it("answers data null for a website that does not exist", async () => {
    expect(await (await get("website_id=nope&user_id=owner-1")).json()).toEqual({ data: null });
  });

  it("requires both ids", async () => {
    expect((await get("website_id=site-1")).status).toBe(400);
  });
});
