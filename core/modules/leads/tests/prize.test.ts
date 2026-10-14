import { describe, expect, it } from "bun:test";
import { couponPrize, pickWheelPrize, withoutPrizeFields } from "../lib/prize";

const segs = [
  { label: "A", weight: 1, coupon_code: "A1" },
  { label: "B", weight: 3, coupon_code: "" },
  { label: "C", weight: 0, coupon_code: "C0" },
];

describe("pickWheelPrize", () => {
  it("follows the weights", () => {
    expect(pickWheelPrize(segs, () => 0)).toMatchObject({ id: "0", label: "A", coupon_code: "A1" });
    expect(pickWheelPrize(segs, () => 0.24)).toMatchObject({ id: "0" });
    expect(pickWheelPrize(segs, () => 0.25)).toMatchObject({ id: "1", label: "B", coupon_code: null });
    expect(pickWheelPrize(segs, () => 0.999999)).toMatchObject({ id: "1" });
  });

  it("never lands on a zero-weight slice", () => {
    for (let i = 0; i < 2000; i++) expect(pickWheelPrize(segs)?.id).not.toBe("2");
  });

  it("is roughly proportional over many draws", () => {
    let a = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) if (pickWheelPrize(segs)?.id === "0") a++;
    expect(a / n).toBeGreaterThan(0.21);
    expect(a / n).toBeLessThan(0.29);
  });

  it("returns null when nothing can win", () => {
    expect(pickWheelPrize([{ label: "x", weight: 0, coupon_code: "" }])).toBeNull();
    expect(pickWheelPrize([])).toBeNull();
  });
});

describe("reserved answers", () => {
  it("strips every key with the reserved prefix, in any case", () => {
    expect(withoutPrizeFields({ a: 1, prize: "x", PRIZE_CODE: "y", prizefoo: "z", notprize: "ok" })).toEqual({ a: 1, notprize: "ok" });
  });

  it("describes a fixed coupon", () => {
    expect(couponPrize({ code: "HI", description: "" })).toEqual({ id: "coupon", label: "Your coupon", coupon_code: "HI" });
  });
});
