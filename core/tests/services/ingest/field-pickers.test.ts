import { describe, it, expect } from "bun:test";
import { pickStr, pickInt, pickUtmColumns } from "../../../services/ingest/field-pickers";

describe("pickStr", () => {
  it("returns undefined for undefined map", () => {
    expect(pickStr(undefined, ["key"])).toBeUndefined();
  });

  it("returns undefined when no keys match", () => {
    expect(pickStr({ a: "hello" }, ["b", "c"])).toBeUndefined();
  });

  it("returns first matching key value", () => {
    expect(pickStr({ a: "first", b: "second" }, ["a", "b"])).toBe("first");
  });

  it("skips empty strings and moves to next key", () => {
    expect(pickStr({ a: "", b: "found" }, ["a", "b"])).toBe("found");
  });

  it("skips non-string values", () => {
    expect(pickStr({ a: 42, b: "ok" }, ["a", "b"])).toBe("ok");
  });

  it("skips null values", () => {
    expect(pickStr({ a: null, b: "ok" } as Record<string, unknown>, ["a", "b"])).toBe("ok");
  });

  it("returns undefined when all keys exist but are non-string", () => {
    expect(pickStr({ a: true, b: 0 } as Record<string, unknown>, ["a", "b"])).toBeUndefined();
  });
});

describe("pickInt", () => {
  it("returns undefined for undefined map", () => {
    expect(pickInt(undefined, ["key"])).toBeUndefined();
  });

  it("returns undefined when no keys match", () => {
    expect(pickInt({ a: 5 }, ["b"])).toBeUndefined();
  });

  it("returns first matching integer value", () => {
    expect(pickInt({ sw: 1920, sh: 1080 }, ["sw", "sh"])).toBe(1920);
  });

  it("truncates decimal numbers", () => {
    expect(pickInt({ v: 3.9 }, ["v"])).toBe(3);
  });

  it("truncates negative decimals toward zero", () => {
    expect(pickInt({ v: -3.7 }, ["v"])).toBe(-3);
  });

  it("skips Infinity", () => {
    expect(pickInt({ a: Infinity, b: 10 }, ["a", "b"])).toBe(10);
  });

  it("skips NaN", () => {
    expect(pickInt({ a: NaN, b: 5 }, ["a", "b"])).toBe(5);
  });

  it("skips string values", () => {
    expect(pickInt({ a: "1920", b: 1080 }, ["a", "b"])).toBe(1080);
  });

  it("returns zero as a valid value", () => {
    expect(pickInt({ v: 0 }, ["v"])).toBe(0);
  });
});

describe("pickUtmColumns", () => {
  it("returns nulls for undefined map", () => {
    const r = pickUtmColumns(undefined);
    expect(r).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null });
  });

  it("returns nulls when no utm fields present", () => {
    const r = pickUtmColumns({ page: "/home" });
    expect(r).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null });
  });

  it("picks flat utm_source / utm_medium / utm_campaign", () => {
    const r = pickUtmColumns({ utm_source: "google", utm_medium: "cpc", utm_campaign: "summer" });
    expect(r).toEqual({ utmSource: "google", utmMedium: "cpc", utmCampaign: "summer" });
  });

  it("picks camelCase flat variants", () => {
    const r = pickUtmColumns({ utmSource: "fb", utmMedium: "social", utmCampaign: "q4" });
    expect(r).toEqual({ utmSource: "fb", utmMedium: "social", utmCampaign: "q4" });
  });

  it("picks from nested utm object", () => {
    const r = pickUtmColumns({ utm: { source: "bing", medium: "email", campaign: "launch" } });
    expect(r).toEqual({ utmSource: "bing", utmMedium: "email", utmCampaign: "launch" });
  });

  it("flat fields take precedence over nested utm object", () => {
    const r = pickUtmColumns({
      utm_source: "flat-source",
      utm: { source: "nested-source", medium: "nested-medium" },
    });
    expect(r.utmSource).toBe("flat-source");
    expect(r.utmMedium).toBe("nested-medium");
  });

  it("ignores utm field if it is an array", () => {
    const r = pickUtmColumns({ utm: ["not", "an", "object"] } as Record<string, unknown>);
    expect(r).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null });
  });

  it("nested utm_source alias also works", () => {
    const r = pickUtmColumns({ utm: { utm_source: "alias" } });
    expect(r.utmSource).toBe("alias");
  });
});
