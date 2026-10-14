import { describe, expect, it } from "bun:test";
import { splitName, toLeadPayload } from "../lib/lead-payload";

describe("splitName", () => {
  it("takes the first word as the first name and the rest as the last", () => {
    expect(splitName("Jane van Doe")).toEqual({ firstName: "Jane", lastName: "van Doe" });
    expect(splitName("  Madonna ")).toEqual({ firstName: "Madonna", lastName: "" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("toLeadPayload", () => {
  it("flattens a queued submission for providers and for the outbox", () => {
    const payload = toLeadPayload({
      submissionId: "s1", submittedAt: "2026-01-01T00:00:00.000Z",
      prize: { id: "1", label: "10% off", coupon_code: "SAVE10" },
      submission: {
        websiteId: "w", email: "a@b.co", name: "Jane Doe", phone: "123", consent: true, fields: { company: "Acme" },
        anonymousId: "anon", sessionId: "sess", automationId: "a1", variant: "b", pageUrl: "/p", referrer: "r",
      },
    });
    expect(payload).toEqual({
      submissionId: "s1", email: "a@b.co", name: "Jane Doe", firstName: "Jane", lastName: "Doe", phone: "123", consent: true,
      fields: { company: "Acme" }, prize: { label: "10% off", coupon_code: "SAVE10" }, popupId: "a1", variant: "b",
      pageUrl: "/p", referrer: "r", submittedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("does not carry the browser's identifiers into what is sent on", () => {
    const json = JSON.stringify(toLeadPayload({
      submissionId: "s1", submittedAt: "x", prize: null,
      submission: { websiteId: "w", email: "a@b.co", name: "", phone: "", consent: false, fields: {}, anonymousId: "anon-1", sessionId: "sess-1", automationId: null, variant: null, pageUrl: "", referrer: "" },
    }));
    expect(json).not.toContain("anon-1");
    expect(json).not.toContain("sess-1");
  });
});
