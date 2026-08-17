import { describe, it, expect } from "bun:test";
import { trackerCollectSchema } from "../validators/tracker.schema";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    website_id: "site_abc123",
    ...overrides,
  };
}

describe("trackerCollectSchema", () => {
  describe("website_id", () => {
    it("accepts a valid website_id", () => {
      expect(trackerCollectSchema.safeParse(valid()).success).toBe(true);
    });

    it("rejects missing website_id", () => {
      expect(trackerCollectSchema.safeParse({}).success).toBe(false);
    });

    it("rejects empty string website_id", () => {
      expect(trackerCollectSchema.safeParse(valid({ website_id: "" })).success).toBe(false);
    });

    it("rejects website_id longer than 64 chars", () => {
      expect(trackerCollectSchema.safeParse(valid({ website_id: "a".repeat(65) })).success).toBe(false);
    });

    it("accepts website_id exactly 64 chars", () => {
      expect(trackerCollectSchema.safeParse(valid({ website_id: "a".repeat(64) })).success).toBe(true);
    });

    it("trims whitespace from website_id", () => {
      const res = trackerCollectSchema.safeParse(valid({ website_id: "  site123  " }));
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.website_id).toBe("site123");
    });
  });

  describe("events array", () => {
    it("accepts up to 2000 events", () => {
      const events = Array.from({ length: 2000 }, () => ({ type: "pageview" }));
      expect(trackerCollectSchema.safeParse(valid({ events })).success).toBe(true);
    });

    it("rejects more than 2000 events", () => {
      const events = Array.from({ length: 2001 }, () => ({ type: "pageview" }));
      expect(trackerCollectSchema.safeParse(valid({ events })).success).toBe(false);
    });

    it("accepts unknown event shapes (array of unknown)", () => {
      const events = [{ type: "custom", data: { foo: "bar" } }, 42, null];
      expect(trackerCollectSchema.safeParse(valid({ events })).success).toBe(true);
    });

    it("accepts absent events field", () => {
      expect(trackerCollectSchema.safeParse(valid()).success).toBe(true);
    });
  });

  describe("session array", () => {
    it("accepts up to 5000 session entries", () => {
      const session = Array.from({ length: 5000 }, () => ({}));
      expect(trackerCollectSchema.safeParse(valid({ session })).success).toBe(true);
    });

    it("rejects more than 5000 session entries", () => {
      const session = Array.from({ length: 5001 }, () => ({}));
      expect(trackerCollectSchema.safeParse(valid({ session })).success).toBe(false);
    });
  });

  describe("heatmaps array", () => {
    const validHeatmap = {
      type: "heatmap_click" as const,
      data: { nx: 0.5, ny: 0.3 },
      ts: Date.now(),
      url: "/home",
      sid: "sess_abc",
    };

    it("accepts a valid heatmap_click event", () => {
      expect(trackerCollectSchema.safeParse(valid({ heatmaps: [validHeatmap] })).success).toBe(true);
    });

    it("accepts a valid heatmap_scroll event", () => {
      const scrollEvent = { ...validHeatmap, type: "heatmap_scroll" as const, data: { depth: 0.7 } };
      expect(trackerCollectSchema.safeParse(valid({ heatmaps: [scrollEvent] })).success).toBe(true);
    });

    it("rejects heatmap with invalid type", () => {
      const bad = { ...validHeatmap, type: "heatmap_unknown" };
      expect(trackerCollectSchema.safeParse(valid({ heatmaps: [bad] })).success).toBe(false);
    });

    it("rejects nx out of [0,1] range", () => {
      const bad = { ...validHeatmap, data: { nx: 1.5 } };
      expect(trackerCollectSchema.safeParse(valid({ heatmaps: [bad] })).success).toBe(false);
    });

    it("rejects url longer than 2048 chars", () => {
      const bad = { ...validHeatmap, url: "/".padEnd(2049, "x") };
      expect(trackerCollectSchema.safeParse(valid({ heatmaps: [bad] })).success).toBe(false);
    });

    it("rejects more than 2000 heatmap events", () => {
      const heatmaps = Array.from({ length: 2001 }, () => validHeatmap);
      expect(trackerCollectSchema.safeParse(valid({ heatmaps })).success).toBe(false);
    });
  });

  describe("heatmap_screenshot array", () => {
    const validShot = {
      type: "heatmap_screenshot" as const,
      data: { image: "base64data" },
      ts: Date.now(),
      url: "/home",
      sid: "sess_abc",
    };

    it("accepts a valid screenshot event", () => {
      expect(trackerCollectSchema.safeParse(valid({ heatmap_screenshot: [validShot] })).success).toBe(true);
    });

    it("rejects more than 5 screenshots", () => {
      const heatmap_screenshot = Array.from({ length: 6 }, () => validShot);
      expect(trackerCollectSchema.safeParse(valid({ heatmap_screenshot })).success).toBe(false);
    });
  });

  describe("funnels / automations arrays", () => {
    it("accepts up to 500 funnel entries", () => {
      const funnels = Array.from({ length: 500 }, () => ({}));
      expect(trackerCollectSchema.safeParse(valid({ funnels })).success).toBe(true);
    });

    it("rejects more than 500 funnel entries", () => {
      const funnels = Array.from({ length: 501 }, () => ({}));
      expect(trackerCollectSchema.safeParse(valid({ funnels })).success).toBe(false);
    });

    it("accepts up to 500 automation entries", () => {
      const automations = Array.from({ length: 500 }, () => ({}));
      expect(trackerCollectSchema.safeParse(valid({ automations })).success).toBe(true);
    });
  });

  describe("passthrough", () => {
    it("preserves unknown top-level keys", () => {
      const res = trackerCollectSchema.safeParse(valid({ ua: "Mozilla/5.0", extra_field: true }));
      expect(res.success).toBe(true);
      if (res.success) {
        expect((res.data as any).ua).toBe("Mozilla/5.0");
        expect((res.data as any).extra_field).toBe(true);
      }
    });
  });
});
