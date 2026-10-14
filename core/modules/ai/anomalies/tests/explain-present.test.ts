import { describe, expect, it } from "bun:test";
import { detectErrorSurge, detectTrafficDrop, lastHours } from "../detect";
import { AnomalyExplainer, buildBrief, checkModelSentence, maskContext, ruleExplanation } from "../explain";
import { askPromptFor, buildAlertNotice, changePct, presentAlert } from "../present";
import type { StoredAnomaly } from "../types";

const NOW = new Date("2026-10-14T14:15:00Z");
const drop = detectTrafficDrop({
  window: lastHours(NOW, 3),
  pageviews: { observed: 150, baseline: [400, 420, 380, 410] },
  visitors: { observed: 40, baseline: [200, 210, 190, 205] },
  sensitivity: "normal",
});
const ctx = {
  pages: [{ name: "/account/jane@example.com/settings", cur: 5, ref: 90 }, { name: "/", cur: 80, ref: 100 }],
  sources: [{ name: "google", cur: 10, ref: 240 }],
};

describe("explanation", () => {
  it("masks every page and source before it is used", () => {
    const masked = maskContext(ctx);
    expect(masked.pages[0]!.name).toBe("/account/:email/settings");
    expect(buildBrief(drop, masked, null).text).not.toContain("jane@example.com");
  });

  it("words the biggest mover in the anomaly's direction", () => {
    expect(ruleExplanation(drop, maskContext(ctx))).toBe("The biggest fall is in traffic from google: 10 against 240 at the same time a week earlier.");
    expect(ruleExplanation(drop, null)).toBeNull();
  });

  it("accepts a model sentence only with the brief's numbers and no personal data", () => {
    const brief = buildBrief(drop, maskContext(ctx), null);
    expect(checkModelSentence('{"explanation":"Search traffic from google fell to 10 from 240."}', brief.numbers).text).toBe("Search traffic from google fell to 10 from 240.");
    expect(checkModelSentence('{"explanation":"Google traffic fell by 9,999 visits overnight."}', brief.numbers).why).toContain("9999");
    expect(checkModelSentence('{"explanation":"Ask jane@example.com what changed on the site."}', brief.numbers).why).toBe("looks like personal data");
    expect(checkModelSentence("not json", brief.numbers).text).toBeNull();
    expect(checkModelSentence('{"explanation":"ok"}', brief.numbers).why).toBe("too short");
  });

  it("does not call a model when none is configured, or for an outage", async () => {
    const e = await new AnomalyExplainer({ llm: null, model: null }).explain(drop, ctx);
    expect(e).toMatchObject({ source: "rules", model: null, inputTokens: 0 });
  });

  it("keeps the rule's sentence when the model fails", async () => {
    const failing = { complete: async () => { throw new Error("down"); }, classify: async () => "" };
    const e = await new AnomalyExplainer({ llm: failing, model: { name: "m", inputCostPerToken: 0, outputCostPerToken: 0 } }).explain(drop, ctx);
    expect(e.source).toBe("rules");
    expect(e.text).toContain("google");
  });

  it("explains a new error by its (masked) page", () => {
    const d = detectErrorSurge({
      window: lastHours(NOW, 1),
      series: { fingerprint: "f", message: "boom", pagePath: "/orders/123456", firstSeen: NOW.toISOString(), observed: 100, sessions: 30, baseline: [0, 0, 0, 0] },
      sensitivity: "normal",
      now: NOW,
    });
    expect(ruleExplanation(d, null)).toBe("A new error, thrown mostly on /orders/:id: likely a recent release.");
  });
});

const stored = (over: Partial<StoredAnomaly> = {}): StoredAnomaly => ({
  id: "00000000-0000-4000-8000-000000000001",
  websiteId: "11111111-1111-4111-8111-111111111111",
  type: "traffic_drop",
  subject: "",
  status: "open",
  severity: "high",
  metric: "visitors",
  observed: 40,
  expected: 203,
  score: -8,
  windowStart: "2026-10-14T11:00:00.000Z",
  windowEnd: "2026-10-14T14:00:00.000Z",
  title: "Visitors down 80% from usual",
  summary: "40 visitors between 11:00 and 14:00 UTC, against about 203 on a usual Wednesday at this time.",
  explanation: "",
  explanationSource: null,
  path: "",
  facts: {},
  detectedAt: "2026-10-14T14:15:00.000Z",
  lastSeenAt: "2026-10-14T14:15:00.000Z",
  resolvedAt: null,
  resolution: null,
  notifiedAt: null,
  notifyStatus: null,
  resolvedNotifiedAt: null,
  ...over,
});

describe("presentation", () => {
  it("gives the dashboard the change and a question for the assistant", () => {
    const v = presentAlert(stored());
    expect(v.changePct).toBe(-80);
    expect(v.askPrompt).toBe("Why did visitors drop between 11:00 and 14:00 UTC on Oct 14 compared with the same time in previous weeks? Compare sources, pages and devices.");
    expect(changePct(5, 0)).toBeNull();
    expect(askPromptFor(stored({ type: "conversion_drop", metric: "conversions", facts: { goal: "Signup" }, windowStart: "2026-10-13T00:00:00.000Z", windowEnd: "2026-10-14T00:00:00.000Z" })))
      .toBe('Why did completions of the "Signup" goal drop on Oct 13 (UTC) compared with previous weeks? Compare traffic, sources and pages.');
  });

  it("never hands out a path the dashboard should not link", () => {
    expect(presentAlert(stored({ path: "settings/tracking" })).path).toBe("settings/tracking");
    expect(presentAlert(stored({ path: "https://evil.test" })).path).toBe("");
    expect(presentAlert(stored({ path: "../x" })).path).toBe("");
  });

  it("builds the gateway notice to its contract: null for an empty explanation, deduped recipients", () => {
    const site = { id: "11111111-1111-4111-8111-111111111111", name: "Acme", domain: "acme.test", userIds: ["u1", "u1", "u2", ""] };
    const n = buildAlertNotice(stored(), site, "open")!;
    expect(n).toMatchObject({
      kind: "anomaly_alert", state: "open", websiteName: "Acme", websiteDomain: "acme.test", userIds: ["u1", "u2"],
      explanation: null, path: "", windowStart: "2026-10-14T11:00:00.000Z",
    });
    expect(n.metrics).toEqual([
      { label: "Visitors", value: "40", change: "-80%" },
      { label: "Usual for this time", value: "203", change: null },
    ]);
    expect(buildAlertNotice(stored(), { ...site, userIds: [] }, "open")).toBeNull();
  });
});
