import { describe, expect, it } from "bun:test";
import type { SessionSummaryInput } from "../../recordings/interfaces";
import type { LlmClient } from "../interfaces/llm-client.interface";
import { buildSessionBrief, clock } from "../sessions/brief";
import { normaliseOutcome, parseSessionSummary } from "../sessions/output";
import { ruleOutcome, ruleSummary, stageOf, worthModel } from "../../../platform/heuristics";
import { SessionSummaryService } from "../sessions/summarizer";

/** The broken-coupon session: a product page, then rage and error clicks on /cart. */
function input(over: Partial<SessionSummaryInput> = {}): SessionSummaryInput {
  return {
    websiteId: "11111111-1111-4111-8111-111111111111",
    sessionId: "s1",
    device: "Desktop",
    browser: "Chrome",
    os: "macOS",
    country: "DE",
    score: 76,
    counts: { error_click: 1, rage_click: 1 },
    signals: [
      { type: "error_click", atMs: 32_409, page: "/cart", label: 'button "Apply"', count: 6, detail: "JavaScript error" },
      { type: "rage_click", atMs: 34_281, page: "/cart", label: 'button "Apply"', count: 5 },
    ],
    timeline: {
      durationMs: 40_001,
      pages: [
        { path: "/", atMs: 0, dwellMs: 11_244 },
        { path: "/products/trailhead-32l", atMs: 11_244, dwellMs: 13_085 },
        { path: "/cart", atMs: 24_329, dwellMs: 15_672 },
      ],
      clicks: [
        { atMs: 20_748, page: "/products/trailhead-32l", label: 'button "Add to cart"' },
        { atMs: 29_211, page: "/cart", label: 'field "Discount code"' },
      ],
      errors: [{ atMs: 32_421, page: "/cart", message: "Cannot read properties of undefined (reading 'amount')" }],
      errorCount: 6,
      failedRequests: 6,
      fieldsTouched: 1,
      goal: { reached: false },
    },
    ...over,
  };
}

const answer = (o: Record<string, unknown>) => JSON.stringify(o);

describe("the brief", () => {
  it("lists pages, clicks, signals and errors at player timestamps, and registers each timestamp", () => {
    const brief = buildSessionBrief(input());
    expect(brief.text).toContain("[0:24] /cart (16s)");
    expect(brief.text).toContain('[0:32] error_click on /cart: button "Apply" x6 (JavaScript error)');
    expect(brief.text).toContain("javascript errors (6 in total");
    expect(brief.times.get("0:34")).toBe(34_281);
    expect(brief.text).toContain("goal-like page reached: no");
  });

  it("masks anything personal that reached it", () => {
    const brief = buildSessionBrief(input({
      signals: [{ type: "dead_click", atMs: 1000, page: "/users/ada@example.com", label: 'button "Email ada@example.com"' }],
    }));
    expect(brief.text).not.toContain("ada@example.com");
    expect(brief.text).toContain("/users/:email");
  });

  it("formats offsets as the player does", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(65_400)).toBe("1:05");
    expect(clock(3_725_000)).toBe("1:02:05");
  });
});

describe("parsing the model's answer", () => {
  const brief = buildSessionBrief(input());
  const fallback = { intent: "Unclear", outcome: "struggled" as const };

  it("keeps a good answer and maps moments to the brief's offsets", () => {
    const { summary, dropped } = parseSessionSummary(answer({
      summary: "The visitor added a bag to the cart, then tried a discount code on /cart. The Apply button threw an error each time and they rage-clicked it before leaving.",
      intent: "Buy the backpack with a discount",
      outcome: "abandoned",
      moments: [{ at: "0:34", label: "Rage clicks on Apply" }, { at: "0:32", label: "First error after Apply" }],
    }), brief, fallback);
    expect(summary.outcome).toBe("abandoned");
    expect(summary.moments).toEqual([
      { atMs: 32_409, label: "First error after Apply" },
      { atMs: 34_281, label: "Rage clicks on Apply" },
    ]);
    expect(dropped).toEqual([]);
  });

  it("drops a moment at a time the brief never mentioned, and keeps the rest", () => {
    const { summary, dropped } = parseSessionSummary(answer({
      summary: "The visitor struggled with the Apply button on /cart and left.",
      outcome: "struggled",
      moments: [{ at: "0:50", label: "Invented" }, { at: "[0:24]", label: "Arrives at the cart" }],
    }), brief, fallback);
    expect(summary.moments).toEqual([{ atMs: 24_329, label: "Arrives at the cart" }]);
    expect(dropped).toContain("moment at 0:50 not in the brief");
  });

  it("refuses a summary that states a number the brief does not contain", () => {
    expect(() => parseSessionSummary(answer({ summary: "The visitor clicked Apply 47 times on /cart before giving up." }), brief, fallback)).toThrow("numbers not in the brief");
  });

  it("refuses a summary that reads like personal data", () => {
    expect(() => parseSessionSummary(answer({ summary: "Ada (ada@example.com) could not apply her coupon on /cart." }), brief, fallback)).toThrow("personal");
  });

  it("fills a missing or unknown intent and outcome from the rules instead of failing", () => {
    const { summary } = parseSessionSummary("```json\n" + answer({ summary: "The visitor hit errors on /cart when applying a coupon.", outcome: "meh" }) + "\n```", brief, fallback);
    expect(summary).toMatchObject({ intent: "Unclear", outcome: "struggled", moments: [] });
  });

  it("refuses something that is not an answer at all", () => {
    expect(() => parseSessionSummary("I cannot help with that.", brief, fallback)).toThrow();
    expect(() => parseSessionSummary(answer({ summary: "Short." }), brief, fallback)).toThrow("too short");
  });

  it("reads common outcome synonyms", () => {
    expect(normaliseOutcome("Success")).toBe("succeeded");
    expect(normaliseOutcome("gave up")).toBe("abandoned");
    expect(normaliseOutcome("frustrated")).toBe("struggled");
    expect(normaliseOutcome(3)).toBeNull();
  });
});

describe("the rule-based summary", () => {
  it("states what happened from the stored fields only", () => {
    const s = ruleSummary(input());
    expect(s.text).toBe(
      'The visitor went from / to /products/trailhead-32l to /cart in 40s. On /cart they hit an error after clicking button "Apply" 6 times, '
      + "then rage-clicked it 5 times. 6 failed requests were recorded. They left from /cart without checking out.",
    );
    expect(s.intent).toBe("Buy something (put items in the cart)");
    expect(s.outcome).toBe("struggled");
    expect(s.moments.map((m) => m.atMs)).toEqual([32_409, 34_281]);
  });

  it("reads success from a goal page, abandonment from an unsent form", () => {
    const quiet = { score: 0, counts: {}, signals: [] };
    expect(ruleOutcome(input({ ...quiet, timeline: { ...input().timeline, goal: { reached: true, page: "/thank-you" } } }))).toBe("succeeded");
    expect(ruleOutcome(input({ score: 20, counts: { form_abandon: 1 } }))).toBe("abandoned");
    const calm = { ...quiet, timeline: { ...input().timeline, errors: [], errorCount: 0, failedRequests: 0, pages: [{ path: "/docs/setup", atMs: 0, dwellMs: 40_000 }] } };
    expect(ruleSummary(input(calm)).text).toContain("Nothing in the recording suggests they ran into problems.");
  });
});

describe("the template's reading of a visit", () => {
  it("reads what the visitor was after from the deepest kind of page they reached", () => {
    expect(stageOf("/checkout/payment")).toBe("checkout");
    expect(stageOf("/en/pricing")).toBe("pricing");
    expect(stageOf("/products/:id")).toBe("product");
    expect(stageOf("/about")).toBeNull();
    const pages = (...paths: string[]) => ({ ...input().timeline, pages: paths.map((path, i) => ({ path, atMs: i * 1000, dwellMs: 1000 })) });
    expect(ruleSummary(input({ timeline: pages("/blog/x", "/pricing", "/signup") })).intent).toBe("Sign up");
    expect(ruleSummary(input({ timeline: pages("/docs/setup") })).intent).toBe("Find an answer in the docs");
  });

  it("tells a converted visit and an unsent form by how they ended", () => {
    const quiet = { score: 0, counts: {}, signals: [] };
    const won = ruleSummary(input({ ...quiet, timeline: { ...input().timeline, errorCount: 0, failedRequests: 0, goal: { reached: true, page: "/thank-you" } } }));
    expect(won.text).toContain("They reached /thank-you, so the visit ended in a conversion.");
    expect(won.text).toContain('They clicked button "Add to cart" on /products/trailhead-32l.');
    const form = ruleSummary(input({ score: 30, counts: { form_abandon: 1 }, signals: [{ type: "form_abandon", atMs: 5000, page: "/contact" }], timeline: { ...input().timeline, fieldsTouched: 3 } }));
    expect(form.text).toContain("They typed into 3 form fields but never submitted.");
    expect(form.text).not.toContain("without submitting it");
  });

  it("asks the model only when there is a story to read", () => {
    expect(worthModel(input())).toBe(true);
    const calm = { score: 0, counts: {}, signals: [], timeline: { ...input().timeline, errorCount: 0, failedRequests: 0 } };
    expect(worthModel(input(calm))).toBe(false);
    const bounce = { timeline: { ...input().timeline, durationMs: 9000, pages: [{ path: "/", atMs: 0, dwellMs: 9000 }] } };
    expect(worthModel(input(bounce))).toBe(false);
  });
});

describe("SessionSummaryService", () => {
  const model = { name: "claude-haiku-5-5", inputCostPerToken: 0.0000001, outputCostPerToken: 0.0000005 };
  const llm = (content: string | Error): LlmClient & { prompts: string[] } => {
    const prompts: string[] = [];
    return {
      prompts,
      complete: async (_system, user) => {
        prompts.push(user);
        if (content instanceof Error) throw content;
        return { content, inputTokens: 1000, outputTokens: 200 };
      },
      classify: async () => "",
    };
  };

  it("returns the model's summary with what it cost", async () => {
    const client = llm(answer({ summary: "The visitor tried a discount code on /cart and the Apply button kept failing.", intent: "Apply a discount", outcome: "struggled", moments: [{ at: "0:32", label: "Apply fails" }] }));
    const result = await new SessionSummaryService({ llm: client, model }).summarize(input());
    expect(result).toMatchObject({ source: "ai", model: "claude-haiku-5-5", inputTokens: 1000, outputTokens: 200 });
    expect(result.costUsd).toBeCloseTo(0.0002, 10);
    expect(client.prompts[0]).toContain("/cart");
  });

  it("falls back to the rules, unbilled and marked retryable, when the model is unreachable", async () => {
    const result = await new SessionSummaryService({ llm: llm(new Error("timeout")), model }).summarize(input());
    expect(result).toMatchObject({ source: "rules", model: null, costUsd: 0 });
    expect(result.summary.text).toContain("/cart");
  });

  it("falls back to the rules, but records the spend, when the answer fails the checks", async () => {
    const result = await new SessionSummaryService({ llm: llm(answer({ summary: "They clicked 99 times." })), model }).summarize(input());
    expect(result).toMatchObject({ source: "rules", model: "claude-haiku-5-5", inputTokens: 1000 });
  });

  it("uses the rules without calling anything when no model is configured", async () => {
    const result = await new SessionSummaryService({ llm: null, model: null }).summarize(input());
    expect(result).toMatchObject({ source: "rules", model: null, inputTokens: 0 });
  });
});
