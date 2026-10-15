import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { testConfig } from "../../../app/tests/helpers/test-config";

mock.module("../../../config", () => ({ env: () => testConfig() }));
mock.module("../../../platform/observability/logger", () => {
  const logger: Record<string, unknown> = { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) };
  logger.child = () => logger;
  return { log: logger };
});

const { submitLead } = await import("../controllers/lead-submit.controller");

const SITE = "550e8400-e29b-41d4-a716-446655440000";
const AUTOMATION = "11111111-1111-4111-8111-111111111111";

let website: any;
const captured: any[] = [];
let failCapture = false;
let prizeToReturn: { id: string; label: string; coupon_code: string | null } | null = null;

function app() {
  const routes = new Hono();
  routes.post(
    "/leads",
    submitLead({
      trackerWebsites: { resolve: async () => website, listGoals: async () => [], buildConfig: async () => ({}) },
      capture: {
        capture: async (s) => {
          if (failCapture) throw new Error("db down");
          captured.push(s);
          return { submissionId: "s1", prize: prizeToReturn, queuedFor: 1 };
        },
      },
    }),
  );
  return routes;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  app().request("/leads", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const valid = { website_id: SITE, email: " Jane@Example.com " };

beforeEach(() => {
  captured.length = 0;
  failCapture = false;
  prizeToReturn = null;
  website = { id: SITE, url: "example.com", is_active: true, automation_enabled: true };
});

describe("POST /tracker/leads", () => {
  it("stores a normalised submission", async () => {
    const res = await post({
      ...valid,
      name: " Jane ",
      consent: true,
      automation_id: AUTOMATION,
      variant: "b",
      fields: { company: "Acme", bad: { x: 1 } },
    });
    expect(res.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      websiteId: SITE,
      email: "jane@example.com",
      name: "Jane",
      consent: true,
      automationId: AUTOMATION,
      variant: "b",
      fields: { company: "Acme" },
    });
  });

  it("rejects malformed JSON, bad emails and oversized bodies", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ ...valid, email: "nope" })).status).toBe(400);
    expect((await post({ ...valid, automation_id: "not-a-uuid" })).status).toBe(400);
    expect((await post({ ...valid, name: "x".repeat(20_000) })).status).toBe(413);
    expect(captured).toHaveLength(0);
  });

  // The handler's own check ran after the whole body was buffered, up to the server's 128 MB.
  it("refuses an oversized body at the mounted route before reading it", async () => {
    const { createLeadTrackerRoutes } = await import("../tracker-routes");
    const routes = createLeadTrackerRoutes({
      trackerWebsites: { resolve: async () => website, listGoals: async () => [], buildConfig: async () => ({}) },
      capture: { capture: async (s) => { captured.push(s); return { submissionId: "s1", prize: null, queuedFor: 0 }; } },
    });
    const res = await routes.request("/", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(10 * 1024 * 1024) },
      body: "x".repeat(17 * 1024),
    });
    expect(res.status).toBe(413);
    expect(captured).toHaveLength(0);
  });

  it("acknowledges a honeypot hit without storing", async () => {
    const res = await post({ ...valid, hp: "http://spam" });
    expect(res.status).toBe(200);
    expect(captured).toHaveLength(0);
  });

  it("404s for an unknown or inactive website", async () => {
    website = null;
    expect((await post(valid)).status).toBe(404);
    website = { id: SITE, url: "example.com", is_active: false, automation_enabled: true };
    expect((await post(valid)).status).toBe(404);
  });

  it("refuses a foreign origin", async () => {
    const res = await post(valid, { origin: "https://evil.test" });
    expect(res.status).toBe(403);
    expect(captured).toHaveLength(0);
  });

  it("collects nothing when automations are switched off", async () => {
    website = { ...website, automation_enabled: false };
    expect((await post(valid)).status).toBe(200);
    expect(captured).toHaveLength(0);
  });

  it("returns the prize chosen by the server, and nothing else about the submission", async () => {
    prizeToReturn = { id: "2", label: "10% off", coupon_code: "SAVE10" };
    const res = await post(valid);
    expect(await res.json()).toEqual({ status: "ok", prize: prizeToReturn });
  });

  it("returns a bare ok when the popup pays no prize", async () => {
    expect(await (await post(valid)).json()).toEqual({ status: "ok" });
  });

  it("reports a storage or queueing failure as 500, so the visitor can try again", async () => {
    failCapture = true;
    expect((await post(valid)).status).toBe(500);
  });

  it("rate-limits one visitor per website, still answering ok", async () => {
    // A website of its own: the limiter is process-wide, so the other tests' submissions
    // would otherwise already have spent part of this budget.
    website = { ...website, id: "99999999-9999-4999-8999-999999999999" };
    for (let i = 0; i < 8; i++) {
      const res = await post({ ...valid, email: `u${i}@example.com` });
      expect(res.status).toBe(200);
    }
    expect(captured).toHaveLength(5);
  });
});
