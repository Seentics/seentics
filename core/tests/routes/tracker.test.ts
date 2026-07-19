import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";
import type { WebsiteTrackerRow } from "../../lib/website-for-tracker";

// ─── Mocks — must be declared before dynamic import ─────────────────────────

const mockResolveWebsite = mock(async (_id: string): Promise<WebsiteTrackerRow | null> => null);
const mockListGoals      = mock(async () => []);
const mockBuildConfig    = mock(async () => ({ website_id: "w1", goals: [], replay_enabled: false }));
const mockHandleEvents     = mock(() => {});
const mockHandleFunnels    = mock(() => {});
const mockHandleAutomations = mock(() => {});
const mockHandleRecordings  = mock(() => {});
const mockHandleHeatmaps    = mock(() => {});
const mockFunnelActive     = mock(async () => []);
const mockAutoActive       = mock(async () => []);
const mockAutoEvaluate     = mock(async () => ({ matched: false, actions: [] }));
const mockCapture          = mock(async () => {});

mock.module("../../lib/website-for-tracker", () => ({
  resolveWebsiteForTracker: mockResolveWebsite,
  listTrackerGoals: mockListGoals,
  buildPublicTrackerConfig: mockBuildConfig,
}));

mock.module("../../services/ingest.service", () => ({
  handleEvents: mockHandleEvents,
  handleFunnels: mockHandleFunnels,
  handleAutomations: mockHandleAutomations,
  handleRecordings: mockHandleRecordings,
  handleHeatmaps: mockHandleHeatmaps,
}));

mock.module("../../services/funnels.service", () => ({
  activeForTracker: mockFunnelActive,
}));

mock.module("../../services/automations.service", () => ({
  activeForTracker: mockAutoActive,
}));

mock.module("../../services/automations-evaluate.service", () => ({
  evaluate: mockAutoEvaluate,
}));

mock.module("../../services/heatmap-playwright.service", () => ({
  captureHeatmapScreenshot: mockCapture,
}));

mock.module("../../lib/logger", () => ({
  log: { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) },
}));

// dev environment → empty origin always passes, localhost always passes
mock.module("../../config", () => ({
  env: () => ({
    environment: "development",
    trustProxy: false,
    isProduction: false,
    diagnosticLog: false,
  }),
}));

mock.module("../../lib/analytics-ingest-meta", () => ({
  buildAnalyticsIngestMeta: mock(() => ({
    country: "US", region: "CA", city: "SF",
    browser: "Chrome", device: "desktop", os: "macOS",
    languageHint: "en",
  })),
}));

// ─── Test helpers ────────────────────────────────────────────────────────────

const ACTIVE_WEBSITE: WebsiteTrackerRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  site_id: "site_abc",
  user_id: "user1",
  url: "https://example.com",
  is_active: true,
  funnel_enabled: true,
  heatmap_enabled: true,
  heatmap_include_patterns: null,
  heatmap_exclude_patterns: null,
  heatmap_layout_enabled: false,
  replay_enabled: true,
  replay_sampling_rate: 1.0,
  replay_include_patterns: null,
  replay_exclude_patterns: null,
  automation_enabled: true,
};

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return { path, method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } };
}

function get(path: string) {
  return { path, method: "GET" };
}

// ─── Load route module after mocks ───────────────────────────────────────────

let app: { request: (path: string, init?: RequestInit) => Promise<Response> };

beforeAll(async () => {
  const mod = await import("../../routes/tracker");
  app = mod.trackerRoutes as any;
});

beforeEach(() => {
  mockResolveWebsite.mockClear();
  mockListGoals.mockClear();
  mockBuildConfig.mockClear();
  mockHandleEvents.mockClear();
  mockFunnelActive.mockClear();
  mockAutoActive.mockClear();
  mockAutoEvaluate.mockClear();
  mockCapture.mockClear();
  // Default: website not found
  mockResolveWebsite.mockResolvedValue(null);
});

// ─── GET /init/:website_id ───────────────────────────────────────────────────

describe("GET /init/:website_id", () => {
  it("returns 404 when website is not found", async () => {
    const res = await app.request("/init/unknown_id");
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toBeDefined();
  });

  it("returns 404 when website is inactive", async () => {
    mockResolveWebsite.mockResolvedValue({ ...ACTIVE_WEBSITE, is_active: false });
    const res = await app.request("/init/site_abc");
    expect(res.status).toBe(404);
  });

  it("returns 403 when origin does not match registered domain (production env would block)", async () => {
    // Switch to production just for this test via mockResolveWebsite returning a website
    // with a domain that won't match the sent origin
    mockResolveWebsite.mockResolvedValue({ ...ACTIVE_WEBSITE, url: "https://example.com" });
    // In development, origin mismatch with a non-loopback host → 403
    const res = await app.request("/init/site_abc", {
      headers: { Origin: "https://evil.com" },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain("domain");
  });

  it("returns 200 with config, funnels, automations for a valid request", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    mockBuildConfig.mockResolvedValue({ website_id: "w1", goals: [], replay_enabled: true });
    mockFunnelActive.mockResolvedValue([{ id: "f1", name: "Checkout" }]);
    mockAutoActive.mockResolvedValue([{ id: "a1", name: "Exit popup", definition: { trigger: "exit" } }]);

    const res = await app.request("/init/site_abc");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.config).toBeDefined();
    expect(Array.isArray(body.funnels)).toBe(true);
    expect(Array.isArray(body.automations)).toBe(true);
  });

  it("sets Cache-Control header on success", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/init/site_abc");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("returns empty funnels and automations when services fail (silent fallback)", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    mockFunnelActive.mockRejectedValue(new Error("DB down"));
    mockAutoActive.mockRejectedValue(new Error("DB down"));

    const res = await app.request("/init/site_abc");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.funnels).toEqual([]);
    expect(body.automations).toEqual([]);
  });
});

// ─── GET /config/:website_id ─────────────────────────────────────────────────

describe("GET /config/:website_id", () => {
  it("returns 404 when website is not found", async () => {
    const res = await app.request("/config/unknown");
    expect(res.status).toBe(404);
  });

  it("returns 404 when website is inactive", async () => {
    mockResolveWebsite.mockResolvedValue({ ...ACTIVE_WEBSITE, is_active: false });
    const res = await app.request("/config/site_abc");
    expect(res.status).toBe(404);
  });

  it("returns 200 with config on success", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    mockBuildConfig.mockResolvedValue({ website_id: "w1", goals: [], replay_enabled: false });

    const res = await app.request("/config/site_abc");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.website_id).toBe("w1");
  });

  it("sets Cache-Control header on success", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/config/site_abc");
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
  });
});

// ─── POST /collect ───────────────────────────────────────────────────────────

describe("POST /collect", () => {
  it("returns 400 for invalid JSON body", async () => {
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json }",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when website_id is missing", async () => {
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [{ type: "pageview" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when website_id is empty string", async () => {
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "  " }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 200 'nothing to process' when all arrays are empty", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "site_abc", events: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.message).toBe("nothing to process");
    expect(mockResolveWebsite).not.toHaveBeenCalled();
  });

  it("returns 404 when website is not found", async () => {
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "unknown", events: [{ type: "pageview" }] }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when origin does not match", async () => {
    mockResolveWebsite.mockResolvedValue({ ...ACTIVE_WEBSITE, url: "https://example.com" });
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.com" },
      body: JSON.stringify({ website_id: "site_abc", events: [{ type: "pageview" }] }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 and enqueues events for a valid collect payload", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: "site_abc",
        events: [{ type: "pageview", url: "/home", ts: Date.now() }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.queued).toBe(1);
    expect(mockHandleEvents).toHaveBeenCalledTimes(1);
  });

  it("queued count reflects total items across all arrays", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: "site_abc",
        events: [{ type: "pageview" }, { type: "custom" }],
        funnels: [{}],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.queued).toBe(3);
  });

  it("rejects body over 8MB via Content-Length header", async () => {
    const res = await app.request("/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(9 * 1024 * 1024),
      },
      body: JSON.stringify({ website_id: "site_abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("uses body.ua as UA when User-Agent is a server runtime (Bun)", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    await app.request("/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Bun/1.0.0",
      },
      body: JSON.stringify({
        website_id: "site_abc",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
        events: [{ type: "pageview" }],
      }),
    });
    // Just assert it didn't crash — the UA override path was exercised
    expect(mockHandleEvents).toHaveBeenCalledTimes(1);
  });
});

// ─── POST /request-screenshot ────────────────────────────────────────────────

describe("POST /request-screenshot", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when website_id is missing", async () => {
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_url: "https://example.com/p", page_path: "/p" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when page_url is missing", async () => {
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "site_abc", page_path: "/p" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid page_url", async () => {
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "site_abc", page_url: "not-a-url", page_path: "/p" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when page_url is an internal host (SSRF guard)", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: "site_abc",
        page_url: "http://localhost/admin",
        page_path: "/admin",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when page_url is on a different domain than the website (SSRF guard)", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: "site_abc",
        page_url: "https://evil.com/page",
        page_path: "/page",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when website is not found", async () => {
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: "missing",
        page_url: "https://example.com/page",
        page_path: "/page",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 202 and fires Playwright capture for a valid request", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    const res = await app.request("/request-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: "site_abc",
        page_url: "https://example.com/home",
        page_path: "/home",
      }),
    });
    expect(res.status).toBe(202);
    const body = await res.json() as any;
    expect(body.status).toBe("queued");
  });
});

// ─── POST /automations/evaluate ──────────────────────────────────────────────

describe("POST /automations/evaluate", () => {
  const validBody = {
    website_id: "site_abc",
    anonymous_id: "anon_1",
    session_id: "sess_1",
    trigger: { type: "exit_intent" },
  };

  it("returns 400 for invalid JSON", async () => {
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when website_id is missing", async () => {
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymous_id: "a", session_id: "s", trigger: { type: "exit" } }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when anonymous_id or session_id is missing", async () => {
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "site_abc", trigger: { type: "exit" } }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when trigger is missing", async () => {
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website_id: "site_abc", anonymous_id: "a", session_id: "s" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when trigger has no type", async () => {
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, trigger: {} }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when website is not found", async () => {
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when origin does not match", async () => {
    mockResolveWebsite.mockResolvedValue({ ...ACTIVE_WEBSITE, url: "https://example.com" });
    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.com" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with matched and actions on success", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    mockAutoEvaluate.mockResolvedValue({ matched: true, actions: [{ type: "show_modal", payload: {} }] });

    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.matched).toBe(true);
    expect(body.actions).toHaveLength(1);
  });

  it("returns 500 when evaluation throws", async () => {
    mockResolveWebsite.mockResolvedValue(ACTIVE_WEBSITE);
    mockAutoEvaluate.mockRejectedValue(new Error("DB timeout"));

    const res = await app.request("/automations/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(500);
  });
});
