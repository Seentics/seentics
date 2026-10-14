import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("../../../platform/observability/logger", () => {
  const logger: Record<string, unknown> = { debug: mock(() => {}), info: mock(() => {}), warn: mock(() => {}), error: mock(() => {}) };
  logger.child = () => logger;
  return { log: logger };
});
const unused = async () => { throw new Error("not used by this test"); };
// Complete on purpose: a mock.module stub must export everything the real module does.
mock.module("../repositories/delivery.repository", () => ({
  LEASE_SECONDS: 60, PAYLOAD_RETENTION_DAYS: 30, claimDue: async () => [],
  completeAttempt: unused, enqueueDeliveries: unused, requeueFailed: unused, recentDeliveries: unused,
  deliveriesOfSubmissions: unused, forgetSubmissions: unused, purgeDeliveries: unused,
}));

const { DeliveryWorker, BATCH_SIZE, MAX_CONCURRENT_ATTEMPTS } = await import("../services/delivery-worker.service");

const delivery = (n: number) => ({ id: `d${n}` }) as any;
const batch = (from: number, count: number) => Array.from({ length: count }, (_, i) => delivery(from + i));
const flush = () => new Promise((r) => setTimeout(r, 5));

let ran: string[];
let claims: number[];
let queue: any[][];
const claim = async (limit: number) => { claims.push(limit); return queue.shift() ?? []; };
const attempts = (impl?: (d: any) => Promise<void>) => ({ run: async (d: any) => { ran.push(d.id); await impl?.(d); } });

beforeEach(() => { ran = []; claims = []; queue = []; });

describe("DeliveryWorker.tick", () => {
  it("attempts every claimed delivery and stops when nothing is due", async () => {
    queue = [batch(1, 3)];
    await new DeliveryWorker(attempts(), claim).tick();
    expect(ran.sort()).toEqual(["d1", "d2", "d3"]);
    expect(claims).toEqual([BATCH_SIZE]);
  });

  it("keeps claiming while rounds come back full", async () => {
    queue = [batch(1, BATCH_SIZE), batch(100, 2)];
    await new DeliveryWorker(attempts(), claim).tick();
    expect(ran).toHaveLength(BATCH_SIZE + 2);
    expect(claims).toHaveLength(2);
  });

  it("runs at most the concurrency limit at once", async () => {
    let live = 0, peak = 0;
    queue = [batch(1, BATCH_SIZE)];
    await new DeliveryWorker(attempts(async () => { live++; peak = Math.max(peak, live); await flush(); live--; }), claim).tick();
    expect(peak).toBe(MAX_CONCURRENT_ATTEMPTS);
    expect(ran).toHaveLength(BATCH_SIZE);
  });

  it("isolates a failing attempt from the rest", async () => {
    queue = [batch(1, 4)];
    await new DeliveryWorker(attempts(async (d) => { if (d.id === "d2") throw new Error("boom"); }), claim).tick();
    expect(ran.sort()).toEqual(["d1", "d2", "d3", "d4"]);
  });
});

describe("DeliveryWorker lifecycle", () => {
  it("does nothing until started, and a kick before start is ignored", async () => {
    queue = [batch(1, 1)];
    const w = new DeliveryWorker(attempts(), claim, 60_000);
    w.kick();
    await flush();
    expect(ran).toEqual([]);
  });

  it("works on start and on kick, and a kick during a tick makes it go round again", async () => {
    const w = new DeliveryWorker(attempts(), claim, 60_000);
    queue = [batch(1, 1)];
    w.start();
    await flush();
    expect(ran).toEqual(["d1"]);

    queue = [batch(2, 1)];
    w.kick();
    w.kick();
    await flush();
    expect(ran).toEqual(["d1", "d2"]);
    await w.stop();
  });

  it("survives a claim that throws", async () => {
    let calls = 0;
    const w = new DeliveryWorker(attempts(), async () => { calls++; if (calls === 1) throw new Error("db down"); return queue.shift() ?? []; }, 60_000);
    w.start();
    await flush();
    queue = [batch(1, 1)];
    w.kick();
    await flush();
    expect(ran).toEqual(["d1"]);
    await w.stop();
  });

  it("stop waits for the attempt in flight and then stays stopped", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    queue = [batch(1, 1)];
    const w = new DeliveryWorker(attempts(() => gate), claim, 60_000);
    w.start();
    await flush();
    let stopped = false;
    const stopping = w.stop().then(() => { stopped = true; });
    await flush();
    expect(stopped).toBe(false);
    release();
    await stopping;
    expect(stopped).toBe(true);

    queue = [batch(9, 1)];
    w.kick();
    await flush();
    expect(ran).toEqual(["d1"]);
  });

  it("polls on its timer", async () => {
    const w = new DeliveryWorker(attempts(), claim, 10);
    w.start();
    await new Promise((r) => setTimeout(r, 60));
    await w.stop();
    expect(claims.length).toBeGreaterThanOrEqual(3);
  });
});
