import { afterEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import {
  ANALYTICS_FEATURES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  can,
  roleAllows,
  type Permission,
} from "..";

/** Answer `can(permission)` for a request carrying `header` as X-Team-Permissions. */
async function check(permission: Permission, header?: string): Promise<boolean> {
  const app = new Hono();
  app.get("/", (c) => c.json({ ok: can(c, permission) }));
  const res = await app.request("/", { headers: header === undefined ? {} : { "X-Team-Permissions": header } });
  return ((await res.json()) as { ok: boolean }).ok;
}

describe("permission keys", () => {
  it("has a .view and a .manage for every dashboard feature, once each", () => {
    for (const feature of ANALYTICS_FEATURES) {
      expect(PERMISSIONS).toContain(`analytics:${feature}.view` as Permission);
      expect(PERMISSIONS).toContain(`analytics:${feature}.manage` as Permission);
    }
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("keeps the keys that predate the feature list", () => {
    for (const key of [
      "analytics:dashboard.view",
      "analytics:funnels.view",
      "analytics:funnels.manage",
      "analytics:goals.manage",
      "analytics:privacy.manage",
      "analytics:apikeys.manage",
      "analytics:settings.manage",
      "team:agency.manage",
    ]) {
      expect(PERMISSIONS).toContain(key as Permission);
    }
  });
});

describe("ROLE_PERMISSIONS", () => {
  it("gives owner and admin everything", () => {
    expect([...ROLE_PERMISSIONS.owner].sort()).toEqual([...PERMISSIONS].sort());
    expect([...ROLE_PERMISSIONS.admin].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("gives a viewer every .view and nothing else", () => {
    expect([...ROLE_PERMISSIONS.viewer].sort()).toEqual(PERMISSIONS.filter((k) => k.endsWith(".view")).sort());
  });

  it("gives a member every .view and the manage a member's website role already had", () => {
    for (const key of ROLE_PERMISSIONS.viewer) expect(roleAllows("member", key)).toBe(true);
    for (const feature of ["funnels", "goals", "recordings", "heatmaps", "automations", "leads", "conversions", "errors"]) {
      expect(roleAllows("member", `analytics:${feature}.manage` as Permission)).toBe(true);
    }
    for (const key of ["analytics:settings.manage", "analytics:apikeys.manage", "analytics:privacy.manage", "team:agency.manage"] as const) {
      expect(roleAllows("member", key)).toBe(false);
    }
  });
});

describe("can", () => {
  const gateway = process.env.GLOBAL_API_KEY;
  afterEach(() => {
    if (gateway === undefined) delete process.env.GLOBAL_API_KEY;
    else process.env.GLOBAL_API_KEY = gateway;
  });

  it("allows everything with no gateway in front", async () => {
    delete process.env.GLOBAL_API_KEY;
    expect(await check("analytics:settings.manage")).toBe(true);
  });

  it("allows nothing when the gateway sent no header", async () => {
    process.env.GLOBAL_API_KEY = "k";
    expect(await check("analytics:dashboard.view")).toBe(false);
  });

  it("answers an account's team keys exactly as before", async () => {
    expect(await check("analytics:funnels.view", "analytics:dashboard.view")).toBe(false);
    expect(await check("analytics:funnels.manage", "analytics:funnels.view")).toBe(false);
    expect(await check("analytics:apikeys.manage", "analytics:dashboard.view,analytics:funnels.manage")).toBe(false);
    expect(await check("analytics:settings.manage", "analytics:settings.manage")).toBe(true);
    expect(await check("analytics:dashboard.view", "analytics:dashboard.view")).toBe(true);
    expect(await check("analytics:dashboard.view", "")).toBe(false);
  });

  it("reads a page's .manage as including its .view", async () => {
    expect(await check("analytics:goals.view", "analytics:goals.manage")).toBe(true);
    expect(await check("analytics:revenue.view", "analytics:goals.manage")).toBe(false);
  });

  it("lets a caller who may open any page open the website", async () => {
    expect(await check("analytics:dashboard.view", "analytics:revenue.view")).toBe(true);
    expect(await check("analytics:dashboard.view", "analytics:apikeys.manage")).toBe(false);
  });

  it("never reads dashboard.view as any page", async () => {
    expect(await check("analytics:overview.view", "analytics:dashboard.view")).toBe(false);
  });
});
