import { describe, it, expect } from "bun:test";
import { layoutPathSlot, heatmapScreenshotKey, heatmapHtmlSnapshotKey } from "../../../modules/heatmaps/lib/keys";

describe("layoutPathSlot", () => {
  it("returns a string in siteId_hexhash format", () => {
    const slot = layoutPathSlot("site_abc", "/home");
    expect(slot).toMatch(/^site_abc_[0-9a-f]{24}$/);
  });

  it("produces exactly 24 hex chars for the hash portion", () => {
    const slot = layoutPathSlot("s", "/");
    const hex = slot.split("_")[1];
    expect(hex).toHaveLength(24);
    expect(hex).toMatch(/^[0-9a-f]{24}$/);
  });

  it("is deterministic — same inputs always produce same output", () => {
    const a = layoutPathSlot("site1", "/about");
    const b = layoutPathSlot("site1", "/about");
    expect(a).toBe(b);
  });

  it("different paths produce different slots", () => {
    const a = layoutPathSlot("site1", "/about");
    const b = layoutPathSlot("site1", "/contact");
    expect(a).not.toBe(b);
  });

  it("different websiteIds produce different slots for same path", () => {
    const a = layoutPathSlot("site1", "/home");
    const b = layoutPathSlot("site2", "/home");
    expect(a).not.toBe(b);
  });

  it("includes the websiteId as a prefix before the underscore separator", () => {
    const slot = layoutPathSlot("my_site_123", "/");
    expect(slot.startsWith("my_site_123_")).toBe(true);
  });

  it("handles empty path", () => {
    const slot = layoutPathSlot("site1", "");
    expect(slot).toMatch(/^site1_[0-9a-f]{24}$/);
  });

  it("handles path with special characters", () => {
    const slot = layoutPathSlot("site1", "/path/:id/nested");
    expect(slot).toMatch(/^site1_[0-9a-f]{24}$/);
  });
});

describe("heatmapScreenshotKey", () => {
  it("returns expected S3 key path for screenshot", () => {
    expect(heatmapScreenshotKey("site_abc", "slot_xyz")).toBe(
      "heatmap-screenshots/site_abc/slot_xyz.jpg"
    );
  });

  it("always uses .jpg extension", () => {
    const key = heatmapScreenshotKey("s", "p");
    expect(key.endsWith(".jpg")).toBe(true);
  });

  it("is deterministic", () => {
    expect(heatmapScreenshotKey("a", "b")).toBe(heatmapScreenshotKey("a", "b"));
  });

  it("different websiteIds produce different keys", () => {
    expect(heatmapScreenshotKey("site1", "slot")).not.toBe(
      heatmapScreenshotKey("site2", "slot")
    );
  });

  it("different pathSlots produce different keys", () => {
    expect(heatmapScreenshotKey("site", "slot1")).not.toBe(
      heatmapScreenshotKey("site", "slot2")
    );
  });
});

describe("heatmapHtmlSnapshotKey", () => {
  it("returns expected S3 key path for HTML snapshot", () => {
    expect(heatmapHtmlSnapshotKey("site_abc", "slot_xyz")).toBe(
      "heatmap-screenshots/site_abc/slot_xyz.html"
    );
  });

  it("always uses .html extension", () => {
    const key = heatmapHtmlSnapshotKey("s", "p");
    expect(key.endsWith(".html")).toBe(true);
  });

  it("screenshot and html keys share the same prefix path", () => {
    const websiteId = "my-site";
    const pathSlot = "abc123";
    const screenshotKey = heatmapScreenshotKey(websiteId, pathSlot);
    const htmlKey = heatmapHtmlSnapshotKey(websiteId, pathSlot);
    const screenshotBase = screenshotKey.replace(/\.jpg$/, "");
    const htmlBase = htmlKey.replace(/\.html$/, "");
    expect(screenshotBase).toBe(htmlBase);
  });

  it("is deterministic", () => {
    expect(heatmapHtmlSnapshotKey("a", "b")).toBe(heatmapHtmlSnapshotKey("a", "b"));
  });
});

describe("layoutPathSlot + key generation (integration)", () => {
  it("produces valid screenshot key from websiteId and path", () => {
    const websiteId = "site_abc";
    const pathSlot = layoutPathSlot(websiteId, "/blog/post");
    const key = heatmapScreenshotKey(websiteId, pathSlot);
    expect(key).toMatch(/^heatmap-screenshots\/site_abc\/site_abc_[0-9a-f]{24}\.jpg$/);
  });

  it("produces valid html snapshot key from websiteId and path", () => {
    const websiteId = "site_abc";
    const pathSlot = layoutPathSlot(websiteId, "/blog/post");
    const key = heatmapHtmlSnapshotKey(websiteId, pathSlot);
    expect(key).toMatch(/^heatmap-screenshots\/site_abc\/site_abc_[0-9a-f]{24}\.html$/);
  });
});
