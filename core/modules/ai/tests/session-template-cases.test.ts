import { describe, expect, it } from "bun:test";
import type { FrustrationSignal, SessionSummaryInput } from "../../recordings/interfaces";
import { ruleSummary, worthModel } from "../sessions/rules";

/**
 * The template across every combination of route, trouble, errors and ending we can build — a few
 * thousand visits — checked for what must hold whatever the visit: it reads as finished sentences,
 * says nothing the data does not, and leaks nothing personal.
 */

const ROUTES: string[][] = [
  [],
  ["/"],
  ["/blog/:slug"],
  ["/", "/pricing"],
  ["/", "/products/:id", "/cart"],
  ["/", "/products/:id", "/cart", "/checkout"],
  ["/pricing", "/signup", "/welcome"],
  ["/docs/setup", "/docs/api", "/contact"],
  ["/", "/about", "/careers", "/blog", "/blog/:slug", "/contact"],
  ["/login", "/account/settings"],
  ["/users/ada@example.com", "/search"],
];

const SIGNALS: FrustrationSignal[] = [
  { type: "error_click", atMs: 12_000, page: "/cart", label: 'button "Apply"', count: 6, detail: "JavaScript error" },
  { type: "rage_click", atMs: 14_000, page: "/cart", label: 'button "Apply"', count: 5 },
  { type: "dead_click", atMs: 3_000, page: "/pricing", label: 'image "Pro plan"', count: 3 },
  { type: "form_abandon", atMs: 40_000, page: "/contact" },
  { type: "u_turn", atMs: 20_000, page: "/checkout", detail: "back to /cart after 3s" },
  { type: "scroll_thrash", atMs: 8_000, page: "/blog/:slug", count: 7 },
  { type: "dead_click", atMs: 5_000, page: "/users/ada@example.com", label: 'link "Email ada@example.com"' },
];

/** Every subset of up to three signals: 1 + 7 + 21 + 35 = 64. */
function signalSets(): FrustrationSignal[][] {
  const out: FrustrationSignal[][] = [[]];
  const n = SIGNALS.length;
  for (let a = 0; a < n; a++) {
    out.push([SIGNALS[a]!]);
    for (let b = a + 1; b < n; b++) {
      out.push([SIGNALS[a]!, SIGNALS[b]!]);
      for (let c = b + 1; c < n; c++) out.push([SIGNALS[a]!, SIGNALS[b]!, SIGNALS[c]!]);
    }
  }
  return out;
}

function* cases(): Generator<SessionSummaryInput> {
  let i = 0;
  for (const route of ROUTES) {
    for (const signals of signalSets()) {
      for (const errors of [0, 1, 4]) {
        for (const goal of [false, true]) {
          i++;
          const counts: Record<string, number> = {};
          for (const s of signals) counts[s.type] = (counts[s.type] ?? 0) + 1;
          yield {
            websiteId: "w", sessionId: `s${i}`, device: "Mobile", browser: "Safari", os: "iOS", country: "GB",
            score: Math.min(100, signals.length * 30 + errors * 5),
            counts,
            signals,
            timeline: {
              durationMs: [4_000, 45_000, 3_725_000][i % 3]!,
              pages: route.map((path, k) => ({ path, atMs: k * 10_000, dwellMs: 10_000 })),
              clicks: i % 2 ? [{ atMs: 9_000, page: route[0] ?? "/", label: 'button "Add to cart"' }] : [],
              errors: [],
              errorCount: errors,
              failedRequests: i % 4 === 0 ? errors : 0,
              fieldsTouched: i % 5,
              goal: goal ? { reached: true, page: "/thank-you" } : { reached: false },
            },
          };
        }
      }
    }
  }
}

describe("the session template, across every combination", () => {
  const all = [...cases()];

  it("covers thousands of visits", () => {
    expect(all.length).toBeGreaterThan(4000);
  });

  it("always reads as one to four finished sentences, with an intent, an outcome and real moments", () => {
    for (const input of all) {
      const s = ruleSummary(input);
      const where = `${input.sessionId}: ${s.text}`;
      expect(s.text.length, where).toBeGreaterThan(20);
      expect(s.text.length, where).toBeLessThan(700);
      expect(s.text, where).toMatch(/^[A-Z0-9].*[.]$/);
      const sentences = s.text.split(/(?<=\.) (?=[A-Z0-9])/);
      expect(sentences.length, where).toBeGreaterThanOrEqual(1);
      expect(sentences.length, where).toBeLessThanOrEqual(4);
      expect(s.text, where).not.toMatch(/undefined|null|NaN|\[object|  | \.|\.\.|, \.|\bthey they\b/i);
      expect(s.intent.length, where).toBeGreaterThan(3);
      expect(["succeeded", "struggled", "abandoned"]).toContain(s.outcome);
      expect(s.moments.length, where).toBeLessThanOrEqual(3);
      for (const m of s.moments) expect(input.signals.map((x) => x.atMs), where).toContain(m.atMs);
    }
  });

  it("only quotes numbers the visit gave it", () => {
    for (const input of all) {
      const t = input.timeline;
      const allowed = new Set<string>([
        ...input.signals.map((x) => String(x.count ?? "")),
        String(t.errorCount), String(t.failedRequests), String(t.fieldsTouched), String(new Set(t.pages.map((p) => p.path)).size),
      ]);
      // Durations ("45s", "1h 2m") and paths are their own kind of token; the rest must be counts from the data.
      const text = ruleSummary(input).text.replace(/\b\d+[hms]\b/g, "").replace(/\/\S*/g, "");
      for (const n of text.match(/\b\d+\b/g) ?? []) expect(allowed, `${input.sessionId}: ${n} in ${text}`).toContain(n);
    }
  });

  it("never says the visit converted unless a goal page was reached, nor that it was calm when it was not", () => {
    for (const input of all) {
      const text = ruleSummary(input).text;
      if (!input.timeline.goal.reached) expect(text).not.toContain("conversion");
      const troubled = input.signals.length > 0 || input.timeline.errorCount > 0 || input.timeline.failedRequests > 0;
      if (troubled) expect(text).not.toContain("Nothing in the recording suggests");
      expect(worthModel(input)).toBe(troubled && !(input.timeline.pages.length <= 1 && input.timeline.durationMs < 15_000));
    }
  });

  it("never repeats an email address it was given", () => {
    for (const input of all) {
      const s = ruleSummary(input);
      expect(JSON.stringify(s)).not.toContain("ada@example.com");
    }
  });
});
