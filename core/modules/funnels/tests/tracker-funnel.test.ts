import { describe, expect, it } from "bun:test";
import { trackerFunnel } from "../lib/tracker-funnel";

describe("a funnel as every visitor's browser receives it", () => {
  it("keeps the id, name and step rules; drops the owner, the description and the stats", () => {
    const out = trackerFunnel({
      id: "f1", website_id: "w1", user_id: "owner-uuid", name: "Checkout", description: "Internal: Q4 promo test",
      is_active: true, conversion_window_hours: 24, created_at: "x", updated_at: "y",
      steps: [
        { id: "step-0", name: "Cart", order: 0, step_type: "page", page_path: "/cart", match_type: "exact", internal_note: "x" },
        { id: "step-1", name: "Paid", order: 1, step_type: "event", event_type: "purchase", match_type: "exact" },
      ],
      stats: { totalEntries: 120, completions: 30, conversionRate: 25 },
    } as never);
    expect(out).toEqual({
      id: "f1", name: "Checkout",
      steps: [
        { id: "step-0", name: "Cart", order: 0, step_type: "page", page_path: "/cart", match_type: "exact" },
        { id: "step-1", name: "Paid", order: 1, step_type: "event", event_type: "purchase", match_type: "exact" },
      ],
    });
    const raw = JSON.stringify(out);
    for (const secret of ["owner-uuid", "Internal", "120", "conversionRate"]) expect(raw).not.toContain(secret);
  });
});
