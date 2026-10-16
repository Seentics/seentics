import { describe, expect, it } from "bun:test";
import type { ConversionTrackerRow } from "../../integrations/interfaces";
import type { IngestQueue } from "../interfaces";
import type { WebsiteTrackerRow } from "../../websites/interfaces";
import { routeConversionEvents } from "../services/conversion-event-routing.service";
import type { TrackerBatchRoutingContext } from "../services/tracker-event-normalization.service";

const SITE = "11111111-1111-4111-8111-111111111111";

function route(body: Record<string, unknown>) {
  const queued: ConversionTrackerRow[] = [];
  const queue = {
    enqueue(lane: string, _w: string, rows: readonly unknown[]) {
      if (lane === "conversions") queued.push(...(rows as ConversionTrackerRow[]));
      return { accepted: rows.length, dropped: 0 };
    },
  } as IngestQueue;
  const ctx = {
    body: { website_id: SITE, ...body },
    website: { id: SITE } as WebsiteTrackerRow,
    userAgent: "Mozilla/5.0 (iPhone)",
    queue,
    clientIp: "203.0.113.9",
  } as unknown as TrackerBatchRoutingContext & { clientIp: string };
  routeConversionEvents(ctx);
  return queued;
}

describe("routeConversionEvents", () => {
  it("queues custom events with the request's IP and browser and the batch's ad context; nothing else", () => {
    const rows = route({
      batch_id: "b1",
      ad: { clk: { fbclid: { v: "IwAR3", ts: 1 } } },
      events: [
        { type: "pageview", ts: 1, url: "https://shop.test/", sid: "s", vid: "v" },
        { type: "custom", ts: 2, url: "https://shop.test/thanks", sid: "s", vid: "v", data: { name: "purchase", value: 40, order_id: "1042" } },
        { type: "custom", ts: 3, url: "https://shop.test/", sid: "s", vid: "v", data: { name: "  " } },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      websiteId: SITE, fallbackId: "b1:1", name: "purchase", url: "https://shop.test/thanks", visitorId: "v",
      ip: "203.0.113.9", userAgent: "Mozilla/5.0 (iPhone)", ad: { clk: { fbclid: { v: "IwAR3", ts: 1 } } },
    });
    expect(rows[0]!.properties).toMatchObject({ value: 40, order_id: "1042" });
  });

  it("queues nothing for a batch without custom events", () => {
    expect(route({ events: [{ type: "pageview", ts: 1, url: "/", sid: "s" }] })).toEqual([]);
  });
});
