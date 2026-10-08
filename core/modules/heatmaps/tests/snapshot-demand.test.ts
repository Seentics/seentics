import { describe, expect, it } from "bun:test";
import {
  HeatmapSnapshotDemandService,
  SNAPSHOT_CLAIM_MS,
  SNAPSHOT_FRESH_MS,
} from "../services/heatmap-snapshot-demand.service";

const SITE = "550e8400-e29b-41d4-a716-446655440000";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile";

/** A service over a fake clock and a fake freshness table. */
function setup(stored: Record<string, number> = {}) {
  let now = 1_000_000_000_000;
  const reads: string[] = [];
  const service = new HeatmapSnapshotDemandService(
    async (_site, path, device) => {
      reads.push(`${path}|${device}`);
      const at = stored[`${path}|${device}`];
      return at === undefined ? null : new Date(at);
    },
    () => now,
  );
  return {
    service,
    reads,
    advance: (ms: number) => { now += ms; },
    at: (agoMs: number) => now - agoMs,
  };
}

describe("HeatmapSnapshotDemandService", () => {
  it("asks for a page that has no background", async () => {
    const { service } = setup();
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(true);
  });

  it("gives the page to one visitor at a time while their capture is in flight", async () => {
    const { service, advance } = setup();
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(true);
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(false);
    advance(SNAPSHOT_CLAIM_MS - 1);
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(false);
    // The claimant never sent one (left early): the page is offered again.
    advance(1);
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(true);
  });

  it("gives one claim to visitors who ask at the same moment", async () => {
    const { service } = setup();
    const answers = await Promise.all(
      Array.from({ length: 20 }, () => service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)),
    );
    expect(answers.filter(Boolean)).toHaveLength(1);
  });

  it("asks nobody for a background under a day old, and asks again once it is older", async () => {
    const { service, reads, advance } = setup({ "/pricing|desktop": 1_000_000_000_000 - (SNAPSHOT_FRESH_MS - 120_000) });
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(false);
    // Answered from memory for the next minute: a burst of visitors is one read.
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(false);
    expect(reads).toHaveLength(1);

    advance(120_000); // now a full day old
    expect(await service.snapshotNeeded(SITE, "/pricing", undefined, DESKTOP_UA)).toBe(true);
  });

  it("keeps devices and parameterised pages apart the way snapshots are stored", async () => {
    const { service, reads } = setup();
    expect(await service.snapshotNeeded(SITE, "/orders/123456", undefined, DESKTOP_UA)).toBe(true);
    // Another order is the same page — already claimed.
    expect(await service.snapshotNeeded(SITE, "/orders/987654", undefined, DESKTOP_UA)).toBe(false);
    // The mobile layout is its own background and needs a mobile visitor.
    expect(await service.snapshotNeeded(SITE, "/orders/987654", undefined, MOBILE_UA)).toBe(true);
    expect(reads).toEqual(["/orders/:id|desktop", "/orders/:id|mobile"]);
  });
});
