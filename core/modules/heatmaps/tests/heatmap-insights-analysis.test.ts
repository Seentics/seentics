import { describe, expect, it } from "bun:test";
import {
  analysePage,
  clickStats,
  isInteractive,
  ruleFindings,
  scrollStats,
  tagFromSelector,
  type ClickRow,
  type ScrollRow,
} from "../lib/heatmap-insights";

// The service's default row source is the Postgres repository, which opens `db` at import.
// Every read here goes through an injected source instead.
process.env.DATABASE_URL ??= "postgres://test-not-connected";
const { HeatmapPageAnalysisService } = await import("../services/heatmap-page-analysis.service");

/**
 * Heatmap insights from synthetic rows, shaped as the two grouped reads return them.
 *
 * Desktop: 100 page views, the first screen is the top 25% of the page; 40 never scroll, 30
 * reach half way, 20 three quarters, 10 the bottom. Mobile: 100 views, a 15% first screen, and
 * most stop there. The sign-up link sits 75% down the desktop page, which only 30% reach.
 */

const scroll = (device: string, depth: number, views: number, fold: number | null, viewportPx = 900, documentPx = 3600): ScrollRow =>
  ({ device, depth, views, fold, viewportPx, documentPx });

const click = (device: string, selector: string, y: number, clicks: number, extra: Partial<ClickRow> = {}): ClickRow => ({
  device,
  selector,
  band: Math.min(9, Math.floor(y / 1000)),
  clicks,
  yWeighted: y * clicks,
  tag: tagFromSelector(selector),
  role: null,
  annotated: false,
  pinned: false,
  ...extra,
});

const SCROLL: ScrollRow[] = [
  scroll("desktop", 25, 40, 25),
  scroll("desktop", 50, 30, 25),
  scroll("desktop", 75, 20, 25),
  scroll("desktop", 100, 10, 25),
  scroll("mobile", 15, 60, 15, 700, 4700),
  scroll("mobile", 30, 30, 15, 700, 4700),
  scroll("mobile", 100, 10, 15, 700, 4700),
];

const CLICKS: ClickRow[] = [
  click("desktop", "a#signup", 7500, 40),
  click("desktop", "a.home", 300, 30, { pinned: true }),
  click("desktop", "div.hero-image", 1500, 25),
  click("desktop", "button#menu", 300, 5),
  click("mobile", "a#signup", 9500, 10),
  click("mobile", "div.hero-image", 1200, 20),
];

const desktopScroll = SCROLL.filter((r) => r.device === "desktop");
const desktopClicks = CLICKS.filter((r) => r.device === "desktop");

describe("scrollStats", () => {
  it("reports reach at each quarter, the median stop and the fold", () => {
    const s = scrollStats(desktopScroll)!;
    expect(s.page_views).toBe(100);
    expect(s.reach).toEqual({ p25: 100, p50: 60, p75: 30, p100: 10 });
    expect(s.median_depth).toBe(50);
    expect(s.avg_depth).toBe(50);
    expect(s.fold_pct).toBe(25);
    expect(s.viewport_px).toBe(900);
    expect(s.document_px).toBe(3600);
    // The 40 that stayed at 25% (the fold) never scrolled.
    expect(s.stayed_above_fold_pct).toBe(40);
  });

  it("needs a minimum of page views", () => {
    expect(scrollStats([scroll("desktop", 50, 29, 25)])).toBeNull();
  });

  it("leaves the fold unknown on rows without viewport capture", () => {
    const s = scrollStats([scroll("desktop", 40, 50, null, 0, 0)])!;
    expect(s.fold_pct).toBeNull();
    expect(s.stayed_above_fold_pct).toBeNull();
    expect(s.viewport_px).toBeNull();
  });

  it("does not call a one-screen page 'never scrolled'", () => {
    expect(scrollStats([scroll("desktop", 100, 50, 100)])!.stayed_above_fold_pct).toBeNull();
  });
});

describe("clickStats", () => {
  const s = scrollStats(desktopScroll);
  const c = clickStats(desktopClicks, desktopScroll, s)!;

  it("ranks elements by clicks with their share, position and reach", () => {
    expect(c.clicks).toBe(100);
    expect(c.clicks_per_view).toBe(1);
    expect(c.top.map((t) => t.selector)).toEqual(["a#signup", "a.home", "div.hero-image", "button#menu"]);
    const signup = c.top[0]!;
    expect(signup).toMatchObject({ tag: "a", interactive: true, share: 40, depth_pct: 75, reach_pct: 30, above_fold: false });
    expect(c.top3_share).toBe(95);
  });

  it("treats pinned elements as always visible", () => {
    const home = c.top.find((t) => t.selector === "a.home")!;
    expect(home.pinned).toBe(true);
    expect(home.reach_pct).toBeNull();
    expect(home.above_fold).toBe(true);
  });

  it("counts clicks on non-interactive elements as dead-click candidates", () => {
    expect(c.dead_clicks.clicks).toBe(25);
    expect(c.dead_clicks.share).toBe(25);
    expect(c.dead_clicks.known_share).toBe(100);
    expect(c.dead_clicks.targets.map((t) => t.selector)).toEqual(["div.hero-image"]);
  });

  it("splits clicks into tenths of the page and above the fold", () => {
    expect(c.bands).toHaveLength(10);
    expect(c.bands[0]!.clicks).toBe(35);
    expect(c.bands[1]!.clicks).toBe(25);
    expect(c.bands[7]!.clicks).toBe(40);
    // a.home (pinned), button#menu (3%) and div.hero-image (15%) sit within the 25% fold.
    expect(c.above_fold_share).toBe(60);
  });

  it("lists links and buttons as calls to action", () => {
    expect(c.ctas.map((t) => t.selector)).toEqual(["a#signup", "a.home", "button#menu"]);
  });

  it("places an element by where most of its clicks are, not their average", () => {
    const split = clickStats(
      [click("desktop", "a.cta", 500, 30), click("desktop", "a.cta", 9500, 10)],
      desktopScroll,
      s,
    )!;
    expect(split.top[0]!.depth_pct).toBe(5);
  });
});

describe("element types", () => {
  it("reads the tag from a stored selector", () => {
    expect(tagFromSelector("button#buy")).toBe("button");
    expect(tagFromSelector("span.price.big")).toBe("span");
    expect(tagFromSelector("img")).toBe("img");
    expect(tagFromSelector('[data-testid="x"]')).toBeNull();
  });

  it("knows links, buttons, controls and interactive roles", () => {
    expect(isInteractive("a", null, false)).toBe(true);
    expect(isInteractive("div", "button", false)).toBe(true);
    expect(isInteractive("div", "main", false)).toBe(false);
    expect(isInteractive("span", null, false)).toBe(false);
    // Unknown tag, or an element the site marked itself: no judgement.
    expect(isInteractive(null, null, false)).toBeNull();
    expect(isInteractive("div", null, true)).toBeNull();
  });
});

describe("analysePage", () => {
  const a = analysePage({ pagePath: "/pricing", days: 30, device: "all", scrollRows: SCROLL, clickRows: CLICKS });
  const kinds = a.signals.map((s) => s.kind);
  const byId = new Map(a.signals.map((s) => [s.id, s]));

  it("analyses every device with enough data", () => {
    expect(a.sufficient).toBe(true);
    expect(a.overall.device).toBe("all");
    expect(a.overall.scroll!.page_views).toBe(200);
    expect(a.devices.map((d) => d.device)).toEqual(["desktop", "mobile"]);
  });

  it("finds the signals the data supports, strongest first", () => {
    expect(kinds).toContain("scroll_depth");
    expect(kinds).toContain("fold");
    expect(kinds).toContain("dead_clicks");
    expect(kinds).toContain("cta_reach");
    expect(kinds).toContain("device_gap");
    const scores = a.signals.map((s) => s.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });

  it("compares mobile with desktop", () => {
    const gap = byId.get("gap-scroll")!;
    expect(gap.device).toBe("mobile");
    expect(gap.finding).toBe("On mobile, half of page views stop by 15% of the page, against 50% on desktop.");
    const clicks = byId.get("gap-clicks")!;
    expect(clicks.finding).toBe("Mobile page views get 0.3 clicks each, against 1.0 on desktop.");
  });

  it("states every figure of a finding in its facts", () => {
    for (const s of a.signals) {
      const facts = new Set(s.facts.match(/\d+(?:\.\d+)?/g) ?? []);
      for (const n of `${s.finding} ${s.fix}`.match(/\d+(?:\.\d+)?/g) ?? []) {
        expect({ id: s.id, n, inFacts: facts.has(n) }).toEqual({ id: s.id, n, inFacts: true });
      }
    }
  });

  it("narrows to one device, without per-device comparisons", () => {
    const d = analysePage({ pagePath: "/pricing", days: 30, device: "desktop", scrollRows: SCROLL, clickRows: CLICKS });
    expect(d.devices).toEqual([]);
    expect(d.overall.scroll!.page_views).toBe(100);
    expect(d.signals.find((s) => s.id === "cta-desktop-1")!.finding)
      .toBe("Only 30% of page views on desktop scroll far enough to reach a#signup, 75% down the page, though it takes 40% of clicks.");
    expect(d.signals.some((s) => s.kind === "device_gap")).toBe(false);
  });

  it("says why there is nothing to report on a quiet page", () => {
    const q = analysePage({ pagePath: "/quiet", days: 7, device: "all", scrollRows: [scroll("desktop", 50, 5, 25)], clickRows: [click("desktop", "a", 100, 3)] });
    expect(q.sufficient).toBe(false);
    expect(q.signals).toEqual([]);
    expect(q.reason).toBe("Only 5 page views and 3 clicks in the last 7 days. Insights start at 30 of either.");
  });

  it("does not estimate dead clicks when element types are mostly unknown", () => {
    const legacy = CLICKS.map((r) => ({ ...r, selector: `[data-testid="${r.selector}"]`, tag: null }));
    const l = analysePage({ pagePath: "/p", days: 30, device: "desktop", scrollRows: SCROLL, clickRows: legacy });
    expect(l.signals.some((s) => s.kind === "dead_clicks")).toBe(false);
    expect(l.limits.some((x) => x.startsWith("Element types are known for only 0%"))).toBe(true);
  });

  it("always lists what cannot be measured", () => {
    expect(a.limits.some((l) => l.startsWith("Rage clicks are not in heatmap data"))).toBe(true);
  });

  it("words rule findings from the strongest signals", () => {
    const r = ruleFindings(a.signals);
    expect(r).toHaveLength(4);
    expect(r[0]).toEqual({ signal: a.signals[0]!.id, kind: a.signals[0]!.kind, device: a.signals[0]!.device, finding: a.signals[0]!.finding, fix: a.signals[0]!.fix });
  });
});

describe("HeatmapPageAnalysisService", () => {
  it("normalises the path, defaults to 30 days and reads both aggregates", async () => {
    const calls: string[] = [];
    const svc = new HeatmapPageAnalysisService({
      scroll: async (w, p, d) => { calls.push(`scroll ${w} ${p} ${d}`); return SCROLL; },
      clicks: async (w, p, d) => { calls.push(`clicks ${w} ${p} ${d}`); return CLICKS; },
    });
    const a = await svc.analyzePage("site", "https://x.test/pricing/?utm=1");
    expect(a.page_path).toBe("/pricing");
    expect(a.days).toBe(30);
    expect(calls.sort()).toEqual(["clicks site /pricing 30", "scroll site /pricing 30"]);
  });
});
