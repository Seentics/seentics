import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectFrustration, scoreFrom, splitReplayStream } from "../services/frustration/frustration-detection";

/**
 * Frustration signals from synthetic recordings shaped like what storage holds: tracker
 * envelopes around rrweb events, plus the error and network sidecars.
 *
 * Each signal gets a case that fires it and at least one near miss that must not, because
 * a detector that flags ordinary clicking makes the score meaningless.
 */

const T0 = 1_790_000_000_000;
const SITE = "https://shop.test";

type Row = Record<string, unknown>;

const rr = (at: number, url: string, type: number, data: Row): Row => ({
  type: "rrweb",
  ts: T0 + at,
  url: `${SITE}${url}`,
  sid: "s1",
  data: { type, timestamp: T0 + at, data },
});

const el = (id: number, tagName: string, attributes: Row, childNodes: Row[] = []) => ({ type: 2, id, tagName, attributes, childNodes });
const txt = (id: number, textContent: string) => ({ type: 3, id, textContent });

/** One page: a button, a link, plain text, a sign-up form and a search box. */
function page(at: number, url: string): Row[] {
  const doc = {
    type: 0,
    id: 1,
    childNodes: [
      el(2, "html", {}, [
        el(3, "body", {}, [
          el(10, "button", { class: "btn" }, [txt(11, "Apply coupon")]),
          el(20, "a", { href: "/pricing" }, [txt(21, "Pricing")]),
          el(30, "div", {}, [txt(31, "Some paragraph text")]),
          el(40, "form", { id: "signup" }, [
            el(41, "input", { type: "email", placeholder: "Work email", value: "typed@example.com" }),
            el(42, "input", { type: "text", name: "company" }),
            el(43, "button", { type: "submit" }, [txt(44, "Sign up")]),
          ]),
          el(50, "input", { type: "search", name: "q" }),
          el(51, "input", { type: "text", placeholder: "Search products" }),
          el(60, "button", { "aria-label": "Contact ada@example.com" }),
          el(99, "span", {}, [txt(98, "status")]),
        ]),
      ]),
    ],
  };
  return [rr(at, url, 4, { href: `${SITE}${url}`, width: 1280, height: 800 }), rr(at + 5, url, 2, { node: doc, initialOffset: { top: 0, left: 0 } })];
}

const click = (at: number, url: string, id: number, x = 100, y = 100) => rr(at, url, 3, { source: 2, type: 2, id, x, y });
const mutation = (at: number, url: string) => rr(at, url, 3, { source: 0, texts: [{ id: 98, value: `t${at}` }], attributes: [], removes: [], adds: [] });
const typing = (at: number, url: string, id: number) => rr(at, url, 3, { source: 5, id, text: "secret value 4111", isChecked: false });
const scroll = (at: number, url: string, y: number) => rr(at, url, 3, { source: 3, id: 1, x: 0, y });
const move = (at: number, url: string) => rr(at, url, 3, { source: 1, positions: [{ x: 1, y: 1, id: 3, timeOffset: 0 }] });
const jsError = (at: number, url: string, message = "Cannot read properties of undefined") => ({ type: "session_error", ts: T0 + at, url: `${SITE}${url}`, data: { message } });
const request = (at: number, url: string, status: number) => ({ type: "network_event", ts: T0 + at, url: `${SITE}${url}`, data: { method: "POST", url: `${SITE}/api/x`, status, duration: 20, startTs: T0 + at } });

/** Keeps the session going past every window, so "the session ended" never explains a result. */
const tail = (at: number, url: string) => [move(at, url)];

const types = (rows: Row[]) => detectFrustration(rows).signals.map((s) => s.type);

describe("an ordinary session", () => {
  it("finds nothing in clicks that worked, reading and a normal scroll", () => {
    const rows = [
      ...page(0, "/"),
      click(1000, "/", 10),
      mutation(1300, "/"),
      scroll(2000, "/", 200),
      scroll(2500, "/", 600),
      scroll(3000, "/", 1200),
      scroll(6000, "/", 900),
      click(8000, "/", 20),
      ...page(9500, "/pricing"),
      click(12_000, "/pricing", 30),
      ...tail(30_000, "/pricing"),
    ];
    const result = detectFrustration(rows);
    expect(result.signals).toEqual([]);
    expect(result.score).toBe(0);
    expect(result.timeline.pages.map((p) => p.path)).toEqual(["/", "/pricing"]);
    expect(result.timeline.pages[0]).toMatchObject({ atMs: 0, dwellMs: 9500 });
  });

  it("measures time from the first rrweb event, as the player does", () => {
    const result = detectFrustration([...page(0, "/"), click(4200, "/", 10), mutation(4300, "/"), ...tail(9000, "/")]);
    expect(result.timeline.clicks[0]).toMatchObject({ atMs: 4200, page: "/", label: 'button "Apply coupon"' });
    expect(result.timeline.durationMs).toBe(9000);
  });

  it("returns nothing to analyse for a stream without rrweb events", () => {
    const result = detectFrustration([jsError(0, "/")]);
    expect(result.rrwebEvents).toBe(0);
    expect(result.timeline.errorCount).toBe(1);
  });
});

describe("rage clicks", () => {
  it("flags 3+ clicks within a second in one spot, as one signal with the count", () => {
    const rows = [...page(0, "/"), ...[0, 150, 300, 450].map((d) => click(2000 + d, "/", 10, 200 + d / 50, 300)), mutation(2100, "/"), ...tail(9000, "/")];
    const s = detectFrustration(rows).signals;
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ type: "rage_click", atMs: 2000, page: "/", label: 'button "Apply coupon"', count: 4 });
  });

  it("does not flag clicks spread out in time or space", () => {
    expect(types([...page(0, "/"), ...[0, 700, 1400].map((d) => click(2000 + d, "/", 10)), mutation(2100, "/"), mutation(2800, "/"), mutation(3500, "/"), ...tail(9000, "/")])).toEqual([]);
    expect(types([...page(0, "/"), click(2000, "/", 30, 10, 10), click(2200, "/", 30, 300, 10), click(2400, "/", 30, 600, 10), ...tail(9000, "/")])).toEqual([]);
  });

  it("scores one rage cluster in the middle of the scale", () => {
    const result = detectFrustration([...page(0, "/"), ...[0, 100, 200].map((d) => click(2000 + d, "/", 30)), ...tail(9000, "/")]);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(60);
  });
});

describe("dead clicks", () => {
  it("flags a button that produced no change, navigation, input or request", () => {
    const s = detectFrustration([...page(0, "/"), click(2000, "/", 10), ...tail(9000, "/")]).signals;
    expect(s).toEqual([{ type: "dead_click", atMs: 2000, page: "/", label: 'button "Apply coupon"', count: 1 }]);
  });

  it("does not flag a click the page responded to", () => {
    expect(types([...page(0, "/"), click(2000, "/", 10), mutation(2400, "/"), ...tail(9000, "/")])).toEqual([]);
    expect(types([...page(0, "/"), click(2000, "/", 10), request(2100, "/", 200), ...tail(9000, "/")])).toEqual([]);
  });

  it("counts a response from the mousedown just before the click", () => {
    expect(types([...page(0, "/"), mutation(1900, "/"), click(2000, "/", 10), ...tail(9000, "/")])).toEqual([]);
  });

  it("does not flag a link that led to a slow page", () => {
    expect(types([...page(0, "/"), click(2000, "/", 20), ...page(4500, "/pricing"), ...tail(9000, "/pricing")])).toEqual([]);
  });

  it("ignores clicks on text and fields, which routinely change nothing", () => {
    expect(types([...page(0, "/"), click(2000, "/", 31), click(4000, "/", 41), ...tail(9000, "/")])).toEqual([]);
  });

  it("ignores a click at the very end of the session", () => {
    expect(types([...page(0, "/"), click(2000, "/", 10), move(2500, "/")])).toEqual([]);
  });

  it("merges repeated dead clicks on the same target", () => {
    const s = detectFrustration([...page(0, "/"), click(2000, "/", 10), click(3500, "/", 10), ...tail(9000, "/")]).signals;
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ type: "dead_click", count: 2 });
  });
});

describe("error clicks", () => {
  it("flags a JavaScript error right after a click", () => {
    const s = detectFrustration([...page(0, "/"), click(2000, "/", 10), mutation(2050, "/"), jsError(2300, "/"), ...tail(9000, "/")]).signals;
    expect(s).toEqual([{ type: "error_click", atMs: 2000, page: "/", label: 'button "Apply coupon"', count: 1, detail: "JavaScript error" }]);
  });

  it("flags a failed request right after a click", () => {
    const s = detectFrustration([...page(0, "/"), click(2000, "/", 10), request(2100, "/", 503), ...tail(9000, "/")]).signals;
    expect(s[0]).toMatchObject({ type: "error_click", detail: "request failed" });
  });

  it("does not tie a later error, or a successful request, to the click", () => {
    expect(types([...page(0, "/"), click(2000, "/", 10), mutation(2050, "/"), jsError(4000, "/"), ...tail(9000, "/")])).toEqual([]);
    expect(types([...page(0, "/"), click(2000, "/", 10), request(2100, "/", 404), ...tail(9000, "/")])).toEqual([]);
  });

  it("keeps the error message, masked, in the timeline", () => {
    const result = detectFrustration([...page(0, "/"), jsError(1000, "/", "Failed for ada@example.com"), ...tail(9000, "/")]);
    expect(result.timeline.errors).toEqual([{ atMs: 1000, page: "/", message: "Failed for [email]" }]);
  });
});

describe("U-turns", () => {
  it("flags a page left within seconds for the one before it", () => {
    const s = detectFrustration([...page(0, "/pricing"), ...page(5000, "/checkout"), ...page(8000, "/pricing"), ...tail(20_000, "/pricing")]).signals;
    expect(s).toEqual([{ type: "u_turn", atMs: 8000, page: "/checkout", detail: "back to /pricing after 3s" }]);
  });

  it("does not flag a visitor who stayed and read", () => {
    expect(types([...page(0, "/pricing"), ...page(5000, "/checkout"), ...page(40_000, "/pricing"), ...tail(50_000, "/pricing")])).toEqual([]);
  });

  it("follows single-page navigation, which emits no Meta event", () => {
    const rows = [...page(0, "/a"), mutation(3000, "/b"), mutation(5000, "/a"), ...tail(20_000, "/a")];
    expect(detectFrustration(rows).timeline.pages.map((p) => p.path)).toEqual(["/a", "/b", "/a"]);
    expect(types(rows)).toEqual(["u_turn"]);
  });
});

describe("form abandonment", () => {
  const filled = [...page(0, "/signup"), typing(2000, "/signup", 41), typing(4000, "/signup", 42)];

  it("flags two fields typed into, then the page left without submitting", () => {
    const s = detectFrustration([...filled, ...page(12_000, "/"), ...tail(20_000, "/")]).signals;
    expect(s).toEqual([{ type: "form_abandon", atMs: 4000, page: "/signup", label: "form", count: 2, detail: "2 fields filled, not submitted" }]);
  });

  it("does not flag a form that was submitted", () => {
    expect(types([...filled, click(6000, "/signup", 43), mutation(6100, "/signup"), ...page(7000, "/thanks"), ...tail(20_000, "/thanks")])).toEqual([]);
  });

  it("does not flag a page left right after typing (Enter to submit)", () => {
    expect(types([...filled, ...page(5000, "/welcome"), ...tail(20_000, "/welcome")])).toEqual([]);
  });

  it("ignores search boxes", () => {
    expect(types([...page(0, "/"), typing(1000, "/", 50), typing(1500, "/", 51), ...page(9000, "/x"), ...tail(20_000, "/x")])).toEqual([]);
  });

  it("never stores what was typed, or a field's value attribute", () => {
    const json = JSON.stringify(detectFrustration([...filled, ...page(12_000, "/"), ...tail(20_000, "/")]));
    expect(json).not.toContain("secret value");
    expect(json).not.toContain("4111");
    expect(json).not.toContain("typed@example.com");
  });
});

describe("scroll thrash", () => {
  it("flags fast back-and-forth scrolling", () => {
    const ys = [0, 600, 100, 700, 50, 650];
    const rows = [...page(0, "/"), ...ys.map((y, i) => scroll(1000 + i * 500, "/", y)), ...tail(9000, "/")];
    const s = detectFrustration(rows).signals;
    expect(s.map((x) => x.type)).toEqual(["scroll_thrash"]);
  });

  it("does not flag reading down a page, with the odd small scroll back", () => {
    const ys = [0, 300, 600, 550, 900, 1200, 1150, 1500, 1800];
    expect(types([...page(0, "/"), ...ys.map((y, i) => scroll(1000 + i * 400, "/", y)), ...tail(9000, "/")])).toEqual([]);
  });
});

describe("labels", () => {
  it("masks personal data in an element label", () => {
    const s = detectFrustration([...page(0, "/"), click(2000, "/", 60), ...tail(9000, "/")]).signals;
    expect(s[0]!.label).toBe('button "Contact [email]"');
  });

  it("masks ids in page routes", () => {
    const result = detectFrustration([...page(0, "/orders/884213"), ...tail(9000, "/orders/884213")]);
    expect(result.timeline.pages[0]!.path).toBe("/orders/:id");
  });

  it("reads bare rrweb events as well as envelopes", () => {
    const bare = page(0, "/").map((r) => (r.data as Row));
    expect(splitReplayStream(bare).rr).toHaveLength(2);
  });
});

describe("score", () => {
  it("is 0 with nothing found, bounded at 100, and grows with evidence", () => {
    expect(scoreFrom({}, 0)).toBe(0);
    const one = scoreFrom({ rage_click: 1 }, 0);
    const two = scoreFrom({ rage_click: 1, error_click: 1 }, 1);
    expect(two).toBeGreaterThan(one);
    expect(scoreFrom({ rage_click: 50, error_click: 50, dead_click: 50, u_turn: 50, form_abandon: 50, scroll_thrash: 50 }, 50)).toBeLessThanOrEqual(100);
  });
});

/** The demo recording is a real rrweb capture: a coupon button that throws, clicked repeatedly. */
const DEMO = join(import.meta.dir, "../../../../web/public/demo/replay-session.json");
describe.if(existsSync(DEMO))("the demo recording", () => {
  it("finds the broken coupon button: an error click and a rage cluster on /cart", () => {
    const result = detectFrustration(JSON.parse(readFileSync(DEMO, "utf8")) as unknown[]);
    expect(result.counts).toEqual({ error_click: 1, rage_click: 1 });
    for (const s of result.signals) expect(s).toMatchObject({ page: "/cart", label: 'button "Apply"' });
    expect(result.timeline.pages.map((p) => p.path)).toEqual(["/", "/products/trailhead-32l", "/cart"]);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });
});
