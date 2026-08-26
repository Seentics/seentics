import { describe, it, expect } from "bun:test";
import { InMemoryEventBus } from "../../../infrastructure/events";
import type { Logger } from "../../../platform/lib/logger";

/** Logger that records error lines so tests can assert on swallowed failures. */
function makeLogger(): { logger: Logger; errors: Record<string, unknown>[] } {
  const errors: Record<string, unknown>[] = [];
  const logger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error(fields) {
      errors.push(fields);
    },
    child() {
      return logger;
    },
  };
  return { logger, errors };
}

function makeBus() {
  const { logger, errors } = makeLogger();
  return { bus: new InMemoryEventBus(logger), errors };
}

const websitePayload = {
  websiteId: "11111111-1111-1111-1111-111111111111",
  siteId: "site_abc",
  ownerId: "user_1",
  url: "example.com",
  occurredAt: new Date("2026-01-01T00:00:00Z"),
};

describe("InMemoryEventBus", () => {
  it("delivers a published event to a subscriber", async () => {
    const { bus } = makeBus();
    const received: unknown[] = [];

    bus.subscribe("website.created", (payload) => {
      received.push(payload);
    });
    await bus.publish("website.created", websitePayload);

    expect(received).toEqual([websitePayload]);
  });

  it("delivers to every subscriber of the same event", async () => {
    const { bus } = makeBus();
    const calls: string[] = [];

    bus.subscribe("website.created", () => {
      calls.push("first");
    });
    bus.subscribe("website.created", () => {
      calls.push("second");
    });
    await bus.publish("website.created", websitePayload);

    expect(calls).toEqual(["first", "second"]);
  });

  it("awaits async handlers before publish resolves", async () => {
    const { bus } = makeBus();
    let finished = false;

    bus.subscribe("website.created", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      finished = true;
    });
    await bus.publish("website.created", websitePayload);

    expect(finished).toBe(true);
  });

  it("does not deliver to subscribers of other events", async () => {
    const { bus } = makeBus();
    let called = false;

    bus.subscribe("website.deleted", () => {
      called = true;
    });
    await bus.publish("website.created", websitePayload);

    expect(called).toBe(false);
  });

  it("is a no-op when nothing is subscribed", async () => {
    const { bus } = makeBus();
    await expect(bus.publish("website.created", websitePayload)).resolves.toBeUndefined();
  });

  // The central resilience guarantee: a broken consumer must not be able to
  // fail the publisher, because the fact has already happened.
  it("does not reject publish when a handler throws", async () => {
    const { bus, errors } = makeBus();

    bus.subscribe("website.created", () => {
      throw new Error("consumer exploded");
    });

    await expect(bus.publish("website.created", websitePayload)).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      msg: "handler_failed",
      event: "website.created",
      err: "consumer exploded",
    });
  });

  it("runs remaining handlers after one throws", async () => {
    const { bus } = makeBus();
    const calls: string[] = [];

    bus.subscribe("website.created", () => {
      calls.push("before");
    });
    bus.subscribe("website.created", () => {
      throw new Error("boom");
    });
    bus.subscribe("website.created", () => {
      calls.push("after");
    });
    await bus.publish("website.created", websitePayload);

    expect(calls).toEqual(["before", "after"]);
  });

  it("swallows rejected async handlers too", async () => {
    const { bus, errors } = makeBus();

    bus.subscribe("website.created", async () => {
      throw new Error("async boom");
    });

    await expect(bus.publish("website.created", websitePayload)).resolves.toBeUndefined();
    expect(errors[0]?.err).toBe("async boom");
  });

  describe("unsubscribe", () => {
    it("stops delivery", async () => {
      const { bus } = makeBus();
      let calls = 0;

      const off = bus.subscribe("website.created", () => {
        calls += 1;
      });
      await bus.publish("website.created", websitePayload);
      off();
      await bus.publish("website.created", websitePayload);

      expect(calls).toBe(1);
    });

    it("leaves sibling subscribers intact", async () => {
      const { bus } = makeBus();
      const calls: string[] = [];

      const off = bus.subscribe("website.created", () => {
        calls.push("removed");
      });
      bus.subscribe("website.created", () => {
        calls.push("kept");
      });

      off();
      await bus.publish("website.created", websitePayload);

      expect(calls).toEqual(["kept"]);
    });

    it("is idempotent", async () => {
      const { bus } = makeBus();
      const off = bus.subscribe("website.created", () => {});

      off();
      off();

      expect(bus.subscriberCount("website.created")).toBe(0);
    });

    // Guards the snapshot in publish(): mutating the live handler set while
    // iterating it would otherwise skip or double-deliver.
    it("takes effect on the next publish when called from inside a handler", async () => {
      const { bus } = makeBus();
      const calls: string[] = [];

      const off = bus.subscribe("website.created", () => {
        calls.push("self-removing");
        off();
      });
      bus.subscribe("website.created", () => {
        calls.push("sibling");
      });

      await bus.publish("website.created", websitePayload);
      await bus.publish("website.created", websitePayload);

      // Both run on the first publish; only the sibling on the second.
      expect(calls).toEqual(["self-removing", "sibling", "sibling"]);
    });

    it("delivers to a handler subscribed during dispatch only on later publishes", async () => {
      const { bus } = makeBus();
      const calls: string[] = [];

      bus.subscribe("website.created", () => {
        calls.push("outer");
        bus.subscribe("website.created", () => {
          calls.push("added-during-dispatch");
        });
      });

      await bus.publish("website.created", websitePayload);
      expect(calls).toEqual(["outer"]);
    });
  });

  describe("subscriberCount", () => {
    it("reports zero for an event with no subscribers", () => {
      const { bus } = makeBus();
      expect(bus.subscriberCount("website.created")).toBe(0);
    });

    it("counts registered handlers", () => {
      const { bus } = makeBus();
      bus.subscribe("website.created", () => {});
      bus.subscribe("website.created", () => {});
      expect(bus.subscriberCount("website.created")).toBe(2);
    });

    it("dedupes the same handler reference", () => {
      const { bus } = makeBus();
      const handler = () => {};
      bus.subscribe("website.created", handler);
      bus.subscribe("website.created", handler);
      expect(bus.subscriberCount("website.created")).toBe(1);
    });
  });
});
