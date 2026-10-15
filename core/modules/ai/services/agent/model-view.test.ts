import { describe, expect, it } from "bun:test";
import { forModel } from "./model-view";

describe("forModel — what a tool result may send to the AI provider", () => {
  it("drops identifiers wherever they are nested, keeps the aggregates", () => {
    const sessions = {
      sessions: [
        { session_id: "s-1", visitor_id: "v-1", device_type: "mobile", country: "DE", duration_seconds: 42, has_errors: true },
      ],
      total: 1,
    };
    expect(forModel(sessions)).toEqual({
      sessions: [{ device_type: "mobile", country: "DE", duration_seconds: 42, has_errors: true }],
      total: 1,
    });
  });

  it("drops free-form property bags and network identifiers", () => {
    expect(forModel({ event: "signup", properties: { email: "a@b.co" }, IP: "1.2.3.4", User_Agent: "x" })).toEqual({ event: "signup" });
  });

  it("keeps names of funnels and automations", () => {
    expect(forModel([{ id: "f1", name: "Checkout", conversion: 0.3 }])).toEqual([{ id: "f1", name: "Checkout", conversion: 0.3 }]);
  });

  it("redacts emails and strips query strings inside text", () => {
    expect(forModel({ message: "TypeError for jane.doe@example.com at https://shop.test/account?token=abc#x" }))
      .toEqual({ message: "TypeError for [email] at https://shop.test/account" });
    expect(forModel({ page_path: "/reset?email=jane%40example.com" })).toEqual({ page_path: "/reset" });
  });

  it("leaves numbers, booleans, null and dates alone", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    expect(forModel({ n: 3, ok: false, none: null, at })).toEqual({ n: 3, ok: false, none: null, at });
  });

  // Slack, Zapier and Discord hooks carry their credential in the path; custom headers are keys.
  it("keeps a webhook's path, header values and named secrets from the provider", () => {
    expect(forModel({ type: "webhook", url: "https://hooks.slack.com/services/T0/B0/xyz", headers: { "X-API-Key": "k" }, method: "POST" }))
      .toEqual({ type: "webhook", url: "https://hooks.slack.com/[hidden]", headers: { "X-API-Key": "[hidden]" }, method: "POST" });
    expect(forModel({ provider: "zapier", token: "t-1", name: "Zap" })).toEqual({ provider: "zapier", token: "[hidden]", name: "Zap" });
  });
});
