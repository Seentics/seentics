import { beforeAll, describe, expect, it } from "bun:test";

/**
 * `drizzle(sql)` swaps the shared client's date serializers for pass-throughs, which
 * made every raw query given a Date throw — the retention sweep among them, so aged data
 * was never deleted. db/index.ts puts a Date-aware serializer back.
 */
let serializers: Record<number, (value: unknown) => unknown>;
beforeAll(async () => {
  // The client connects lazily: a placeholder address is enough to inspect it.
  process.env.DATABASE_URL ??= "postgres://unused@127.0.0.1:1/unused";
  ({ sql: { options: { serializers } } } = await import("./index") as never);
});

describe("raw queries can bind a Date", () => {
  it("sends a Date as ISO text, and leaves Drizzle's strings alone", () => {
    for (const oid of [1082, 1114, 1184]) {
      const serialize = serializers[oid]!;
      expect(serialize(new Date("2026-10-01T04:15:00.000Z"))).toBe("2026-10-01T04:15:00.000Z");
      expect(serialize("2026-10-01 04:15:00+00")).toBe("2026-10-01 04:15:00+00");
    }
  });
});
