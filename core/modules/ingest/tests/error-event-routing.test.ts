import { describe, expect, it } from "bun:test";
import type { ErrorTrackerEvent } from "../../errors/interfaces";
import type { IngestQueue } from "../interfaces";
import type { WebsiteTrackerRow } from "../../websites/interfaces";
import { routeErrorEvents } from "../services/error-event-routing.service";
import type { TrackerBatchRoutingContext } from "../services/tracker-event-normalization.service";

const SITE = "11111111-1111-4111-8111-111111111111";

function route(errors: unknown[], website: Partial<WebsiteTrackerRow> = {}) {
  const queued: ErrorTrackerEvent[] = [];
  const queue: IngestQueue = {
    enqueue(lane: string, _websiteId: string, rows: readonly unknown[]) {
      if (lane === "errors") queued.push(...(rows as ErrorTrackerEvent[]));
      return { accepted: rows.length, dropped: 0 };
    },
  } as IngestQueue;
  const ctx = {
    body: { website_id: SITE, errors },
    website: { id: SITE, ...website } as WebsiteTrackerRow,
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/130",
    queue,
  } as unknown as TrackerBatchRoutingContext;
  routeErrorEvents(ctx);
  return queued;
}

describe("routeErrorEvents", () => {
  it("stores nothing for a site with error tracking switched off", () => {
    const error = { type: "error", kind: "error", ts: Date.now(), url: "https://x.test/", sid: "s", vid: "v", message: "boom" };
    expect(route([error], { errors_enabled: false })).toEqual([]);
    expect(route([error], { errors_enabled: true })).toHaveLength(1);
  });

  // Regression: the shared normalizer kept only the fields every tracker event has, so
  // each error arrived without its message and the ingest service discarded it.
  it("keeps what the tracker reports about the error", () => {
    const [row] = route([{
      type: "error",
      kind: "error",
      ts: Date.now(),
      url: "https://shop.test/checkout",
      sid: "s-1",
      vid: "v-1",
      message: "Acme checkout crashed",
      source: "https://shop.test/app.js",
      line_no: 12,
      col_no: 7,
      stack: "Error: Acme checkout crashed\n    at pay (app.js:12:7)",
    }]);

    expect(row).toMatchObject({
      websiteId: SITE,
      kind: "error",
      message: "Acme checkout crashed",
      source: "https://shop.test/app.js",
      line_no: 12,
      col_no: 7,
      url: "https://shop.test/checkout",
      sid: "s-1",
    });
    expect(row!.stack).toContain("at pay");
  });

  it("drops non-numeric positions and non-string text rather than trusting them", () => {
    const [row] = route([{ type: "error", ts: Date.now(), url: "/", sid: "s", message: 42, line_no: "12" }]);
    expect(row!.message).toBeUndefined();
    expect(row!.line_no).toBeUndefined();
  });

  it("stays aligned when junk entries are mixed in", () => {
    const rows = route([null, "x", { type: "error", ts: Date.now(), url: "/", sid: "s", message: "second" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message).toBe("second");
  });
});
