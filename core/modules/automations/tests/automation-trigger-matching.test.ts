import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "./helpers/fake-db";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

let triggerConfigMatches: typeof import("../services/automation-evaluation.service").triggerConfigMatches;
beforeAll(async () => {
  ({ triggerConfigMatches } = await import("../services/automation-evaluation.service"));
});

/**
 * Trigger settings. Matching used to stop at the type, so every one of these was ignored:
 * a /pricing page-view automation fired on every page, "75%" at 25%, "60 seconds" at 15.
 */
describe("trigger configuration", () => {
  it("page_view honours path and match type", () => {
    const t = (path: string, match_type?: string) => ({ type: "page_view", path, match_type });
    expect(triggerConfigMatches(t("/pricing", "exact"), { path: "/pricing" })).toBe(true);
    expect(triggerConfigMatches(t("/pricing", "exact"), { path: "/pricing/team" })).toBe(false);
    expect(triggerConfigMatches(t("/pricing", "exact"), { path: "/" })).toBe(false);
    expect(triggerConfigMatches(t("/blog", "starts_with"), { path: "/blog/post" })).toBe(true);
    expect(triggerConfigMatches(t("/blog", "starts_with"), { path: "/x/blog" })).toBe(false);
    expect(triggerConfigMatches(t("check"), { path: "/checkout" })).toBe(true); // default: contains
    expect(triggerConfigMatches(t("^/app/\\d+$", "regex"), { path: "/app/42" })).toBe(true);
    expect(triggerConfigMatches(t("^/app/\\d+$", "regex"), { path: "/app/x" })).toBe(false);
    expect(triggerConfigMatches(t("([", "regex"), { path: "/" }), "invalid regex never matches").toBe(false);
    expect(triggerConfigMatches({ type: "page_view" }, { path: "/anything" }), "no path: every page").toBe(true);
  });

  it("click matches only its own selector", () => {
    expect(triggerConfigMatches({ type: "click", selector: "#buy" }, { selector: "#buy" })).toBe(true);
    expect(triggerConfigMatches({ type: "click", selector: "#buy" }, { selector: ".other" })).toBe(false);
  });

  it("scroll_depth, time_on_page and inactivity match their exact threshold", () => {
    expect(triggerConfigMatches({ type: "scroll_depth", depth: 75 }, { depth: 75 })).toBe(true);
    expect(triggerConfigMatches({ type: "scroll_depth", depth: 75 }, { depth: 25 })).toBe(false);
    expect(triggerConfigMatches({ type: "time_on_page", seconds: 60 }, { seconds: 60 })).toBe(true);
    expect(triggerConfigMatches({ type: "time_on_page", seconds: 60 }, { seconds: 15 })).toBe(false);
    expect(triggerConfigMatches({ type: "inactivity", seconds: 120 }, { seconds: 120 })).toBe(true);
    expect(triggerConfigMatches({ type: "inactivity", seconds: 120 }, { seconds: 30 })).toBe(false);
  });

  it("custom_event matches its event name", () => {
    expect(triggerConfigMatches({ type: "custom_event", name: "signup" }, { name: "signup" })).toBe(true);
    expect(triggerConfigMatches({ type: "custom_event", name: "signup" }, { name: "purchase" })).toBe(false);
    expect(triggerConfigMatches({ type: "custom_event" }, { name: "anything" })).toBe(true);
  });

  it("triggers without settings match any event of their type", () => {
    for (const type of ["exit_intent", "rage_click", "form_abandon", "js_error", "tab_hidden", "tab_visible", "identify"]) {
      expect(triggerConfigMatches({ type }, {})).toBe(true);
    }
  });
});
