import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import postgres from "postgres";
import { buildFunnelProgressQuery, type FunnelProgressStep } from "../lib/funnel-progress-sql";

/**
 * The funnel query against a real Postgres, since what it means to "reach a step" is a property
 * of the SQL:  FUNNEL_TEST_DATABASE_URL=postgres://… bun test modules/analytics/tests/funnel-progress.db.test.ts
 *
 * Creates its own table in a schema of its own and drops it afterwards.
 */
const url = process.env.FUNNEL_TEST_DATABASE_URL;
const SITE = "site_a";
const day = (d: number, minute = 0) => new Date(Date.UTC(2026, 0, d, 12, minute)).toISOString();
const START = day(1);
const END = day(30);

describe.skipIf(!url)("funnel progress, counted from events", () => {
  const sql = postgres(url ?? "", { max: 2, onnotice: () => {}, connection: { search_path: "funnel_probe" } });

  const view = (visitor: string | null, path: string, at: string, over: Record<string, unknown> = {}) =>
    ({ website_id: SITE, event_type: "pageview", page: path, visitor_id: visitor, session_id: `s-${visitor ?? "none"}`, occurred_at: at, properties: null, ...over });
  const custom = (visitor: string | null, name: string, at: string, over: Record<string, unknown> = {}) =>
    ({ website_id: SITE, event_type: "custom", page: "/", visitor_id: visitor, session_id: `s-${visitor ?? "none"}`, occurred_at: at, properties: { name }, ...over });

  async function counts(steps: FunnelProgressStep[], rows: Record<string, unknown>[], windowHours: number | null = null) {
    await sql`TRUNCATE analytics_events`;
    for (const r of rows) {
      await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at, properties)
                VALUES (${r.website_id as string}, ${r.event_type as string}, ${r.page as string}, ${r.visitor_id as string | null}, ${r.session_id as string}, ${r.occurred_at as string}, ${r.properties ? sql.json(r.properties as never) : null})`;
    }
    const { text, params } = buildFunnelProgressQuery(SITE, steps, START, END, windowHours);
    const out = await sql.unsafe<Array<{ step_order: number; cnt: number }>>(text, params as never[]);
    return out.sort((a, b) => a.step_order - b.step_order).map((r) => r.cnt);
  }

  const page = (path: string, match: "exact" | "contains" | "starts_with" | "regex" = "exact"): FunnelProgressStep => ({ kind: "page", path, match });
  const HOME_DOCS_APPLY = [page("/"), page("/docs"), page("/apply")];

  beforeAll(async () => {
    await sql.unsafe(`DROP SCHEMA IF EXISTS funnel_probe CASCADE; CREATE SCHEMA funnel_probe;
      CREATE TABLE funnel_probe.analytics_events (id uuid DEFAULT gen_random_uuid(), website_id text NOT NULL, event_type varchar(64) NOT NULL,
        page text, visitor_id text, session_id text, properties jsonb, occurred_at timestamptz NOT NULL)`);
  });
  afterAll(async () => {
    await sql.unsafe("DROP SCHEMA IF EXISTS funnel_probe CASCADE");
    await sql.end();
  });

  it("counts each visitor at the furthest step they reached, in order", async () => {
    const rows = [
      view("full", "/", day(2, 0)), view("full", "/docs", day(2, 1)), view("full", "/apply", day(2, 2)),
      view("half", "/", day(2, 0)), view("half", "/docs", day(2, 1)),
      view("first", "/", day(2, 0)),
    ];
    expect(await counts(HOME_DOCS_APPLY, rows)).toEqual([3, 2, 1]);
  });

  it("does not count steps taken out of order", async () => {
    const rows = [view("backwards", "/apply", day(2, 0)), view("backwards", "/docs", day(2, 1)), view("backwards", "/", day(2, 2))];
    expect(await counts(HOME_DOCS_APPLY, rows)).toEqual([1, 0, 0]);
  });

  it("does not let one event serve two steps", async () => {
    // One visit to /docs matches both "contains /" and "exact /docs".
    const steps = [page("/", "contains"), page("/docs")];
    expect(await counts(steps, [view("v", "/docs", day(2))])).toEqual([1, 0]);
    expect(await counts(steps, [view("v", "/docs", day(2, 0)), view("v", "/docs", day(2, 1))])).toEqual([1, 1]);
  });

  it("follows a visitor who has not consented through the day's anonymous id", async () => {
    const rows = [view("h-abc", "/", day(2, 0)), view("h-abc", "/docs", day(2, 1)), view("h-abc", "/apply", day(2, 2))];
    expect(await counts(HOME_DOCS_APPLY, rows)).toEqual([1, 1, 1]);
  });

  it("falls back to the session when there is no visitor id, and keeps people apart", async () => {
    const rows = [
      view(null, "/", day(2, 0), { session_id: "sess-1" }), view(null, "/docs", day(2, 1), { session_id: "sess-1" }),
      view(null, "/", day(2, 0), { session_id: "sess-2" }),
    ];
    expect(await counts([page("/"), page("/docs")], rows)).toEqual([2, 1]);
  });

  it("reads the path, not the URL: query strings, fragments, trailing slashes and hosts do not matter", async () => {
    const rows = [view("v", "https://example.com/?utm=x", day(2, 0)), view("v", "/docs/?a=1#top", day(2, 1))];
    expect(await counts([page("/"), page("/docs")], rows)).toEqual([1, 1]);
  });

  it("matches by contains, starts with and regex", async () => {
    const rows = [view("v", "/blog/2026/post", day(2, 0)), view("v", "/shop/cart", day(2, 1)), view("v", "/checkout/step-2", day(2, 2))];
    expect(await counts([page("blog", "contains"), page("/shop", "starts_with"), page("^/checkout/step-[0-9]+$", "regex")], rows)).toEqual([1, 1, 1]);
    expect(await counts([page("blog", "contains"), page("/shop", "starts_with"), page("^/checkout/step-[0-9]{3}$", "regex")], rows)).toEqual([1, 1, 0]);
  });

  it("counts an event step, under its own name or as a custom event", async () => {
    const steps: FunnelProgressStep[] = [page("/"), { kind: "event", event: "purchase" }];
    expect(await counts(steps, [view("a", "/", day(2, 0)), custom("a", "purchase", day(2, 1))])).toEqual([1, 1]);
    expect(await counts(steps, [view("b", "/", day(2, 0)), { ...custom("b", "x", day(2, 1)), event_type: "purchase", properties: null }])).toEqual([1, 1]);
    expect(await counts(steps, [view("c", "/", day(2, 0)), custom("c", "something_else", day(2, 1))])).toEqual([1, 0]);
  });

  it("ignores other websites and events outside the range", async () => {
    const rows = [
      view("v", "/", day(2, 0)), view("v", "/docs", day(2, 1)),
      view("other", "/", day(2, 0), { website_id: "site_b" }), view("other", "/docs", day(2, 1), { website_id: "site_b" }),
      view("old", "/", "2025-12-01T00:00:00Z"), view("late", "/", "2026-02-15T00:00:00Z"),
    ];
    expect(await counts([page("/"), page("/docs")], rows)).toEqual([1, 1]);
  });

  it("counts a visitor who repeats the journey once", async () => {
    const rows = [view("v", "/", day(2, 0)), view("v", "/docs", day(2, 1)), view("v", "/", day(3, 0)), view("v", "/docs", day(3, 1))];
    expect(await counts([page("/"), page("/docs")], rows)).toEqual([1, 1]);
  });

  it("takes the earliest first step, so a later journey is not lost behind it", async () => {
    const rows = [view("v", "/", day(2, 0)), view("v", "/", day(5, 0)), view("v", "/docs", day(5, 1))];
    expect(await counts([page("/"), page("/docs")], rows)).toEqual([1, 1]);
  });

  it("rejects a regex Postgres cannot read, as an error rather than a silent zero", async () => {
    await expect(counts([page("(unclosed", "regex")], [view("v", "/", day(2))])).rejects.toThrow();
  });

  describe("the time allowed between steps", () => {
    const hours = (h: number) => new Date(Date.UTC(2026, 0, 2, 12) + h * 3_600_000).toISOString();
    const two = [page("/"), page("/docs")];

    it("counts a step reached inside the window, and not one reached after it", async () => {
      const rows = [
        view("quick", "/", hours(0)), view("quick", "/docs", hours(0.5)),
        view("slow", "/", hours(0)), view("slow", "/docs", hours(3)),
      ];
      expect(await counts(two, rows, 1)).toEqual([2, 1]);
      expect(await counts(two, rows, 4)).toEqual([2, 2]);
      expect(await counts(two, rows, null)).toEqual([2, 2]);
    });

    it("measures each step from the one before it, not from the first", async () => {
      const rows = [view("v", "/", hours(0)), view("v", "/docs", hours(1)), view("v", "/apply", hours(2))];
      // Two hours from start to finish, but never more than an hour between steps.
      expect(await counts(HOME_DOCS_APPLY, rows, 1)).toEqual([1, 1, 1]);
      expect(await counts(HOME_DOCS_APPLY, [view("v", "/", hours(0)), view("v", "/docs", hours(1)), view("v", "/apply", hours(3))], 1)).toEqual([1, 1, 0]);
    });

    it("counts a step exactly at the edge of the window", async () => {
      expect(await counts(two, [view("v", "/", hours(0)), view("v", "/docs", hours(1))], 1)).toEqual([1, 1]);
    });

    it("still takes the earliest match, so a quick second visit is found after a slow first one", async () => {
      const rows = [view("v", "/", hours(0)), view("v", "/docs", hours(10)), view("v", "/docs", hours(0.5))];
      expect(await counts(two, rows, 1)).toEqual([1, 1]);
    });
  });

  describe("regular expressions", () => {
    const accepts = async (pattern: string) => {
      try { await sql`SELECT '' ~ ${pattern} AS ok`; return true; }
      catch (error) { if ((error as { code?: string }).code === "2201B") return false; throw error; }
    };

    it("tells a pattern the database can run from one it cannot", async () => {
      expect(await accepts("^/checkout/[0-9]+$")).toBe(true);
      expect(await accepts("(unclosed")).toBe(false);
      expect(await accepts("[a-")).toBe(false);
      // Valid in a browser, not here.
      expect(await accepts("/(?<id>[0-9]+)")).toBe(false);
    });
  });
});
