import { describe, expect, it, mock } from "bun:test";

const purges: any[] = [];
const unused = async () => { throw new Error("not used by this test"); };
// Complete on purpose: a mock.module stub must export everything the real module does.
mock.module("../repositories/delivery.repository", () => ({
  LEASE_SECONDS: 60, PAYLOAD_RETENTION_DAYS: 30,
  purgeDeliveries: async (...a: unknown[]) => { purges.push(a); return { deleted: 5, expired: 2, scrubbed: 1 }; },
  enqueueDeliveries: unused, claimDue: unused, completeAttempt: unused, requeueFailed: unused,
  recentDeliveries: unused, deliveriesOfSubmissions: unused, forgetSubmissions: unused,
}));

const { IntegrationsRetentionPurge } = await import("../services/retention-purge.service");

describe("IntegrationsRetentionPurge", () => {
  it("ages out history with the automation cut-off and clears undelivered payloads after 30 days", async () => {
    const funnelAutomation = new Date("2026-07-01T00:00:00Z");
    const out = await new IntegrationsRetentionPurge(() => Date.parse("2026-10-13T00:00:00Z")).purge(
      { websiteId: "w1" }, { funnelAutomation } as never, {} as never,
    );
    expect(out).toEqual({ integrationDeliveryRows: 5, integrationDeliveriesExpired: 2, integrationPayloadsCleared: 1 });
    expect(purges[0][0]).toBe("w1");
    expect(purges[0][1]).toBe(funnelAutomation);
    expect((purges[0][2] as Date).toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });
});
