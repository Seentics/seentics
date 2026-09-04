import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * The generated attribution SQL.
 *
 * The five breakdowns — source, medium, campaign, product, country — used to be written
 * out longhand three times each: as a CTE, as a projection in the final SELECT, and in
 * the response mapping. Fifteen near-identical stanzas, where the CTEs differed only in
 * the expression producing `name`. They are generated from one table now.
 *
 * `repositories.revenue.test.ts` cannot catch a mistake in that generation: it drives the
 * repository through a fake that returns queued rows whatever the query says, so the SQL
 * text is never examined. This file examines it — the fake records each call, and an
 * interpolated `sql.unsafe` fragment arrives as a value it can be read back out of.
 *
 * What is pinned is the shape, not the formatting: the dimension must appear as a CTE,
 * must be projected under its own key, and must aggregate the same way as its four
 * siblings. A dimension added to the table and reaching only two of the three places is
 * the failure this prevents.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

/* eslint-disable @typescript-eslint/no-explicit-any */
let getRevenueDashboard: any;

beforeAll(async () => {
  ({ getRevenueDashboard } = await import("../repositories/revenue.repository"));
});

beforeEach(resetDb);

/** The five keys, in the order the table declares them. */
const DIMENSIONS = ["by_source", "by_medium", "by_campaign", "by_product", "by_country"];

type Fragment = { __fragment: string };
const isFragment = (v: unknown): v is Fragment =>
  !!v && typeof v === "object" && "__fragment" in (v as object);

/** Run the report and return the two generated SQL fragments, in interpolation order. */
async function generatedSql(): Promise<{ ctes: string; projections: string }> {
  queueRows([{}]);
  await getRevenueDashboard("site_1", {});

  const fragments = (sqlCalls[0]?.values ?? []).filter(isFragment).map((f) => f.__fragment);
  expect(fragments).toHaveLength(2);
  return { ctes: fragments[0]!, projections: fragments[1]! };
}

describe("attribution dimension CTEs", () => {
  it("declares every dimension", async () => {
    const { ctes } = await generatedSql();
    for (const key of DIMENSIONS) expect(ctes).toContain(`${key} AS (`);
  });

  it("declares exactly five, with no trailing separator", async () => {
    const { ctes } = await generatedSql();
    expect(ctes.match(/ AS \(/g)).toHaveLength(5);
    // A trailing comma would break the `WITH` list at the point the next clause begins.
    expect(ctes.trimEnd().endsWith(")")).toBe(true);
  });

  it("aggregates every dimension identically", async () => {
    const { ctes } = await generatedSql();
    // The part that must not drift between dimensions: same source, same grouping.
    expect(ctes.match(/FROM enriched GROUP BY 1/g)).toHaveLength(5);
    expect(ctes.match(/COALESCE\(SUM\(raw_value\), 0\)::double precision AS revenue/g))
      .toHaveLength(5);
    expect(ctes.match(/COUNT\(\*\)::int\s+AS orders/g)).toHaveLength(5);
  });

  it("gives each dimension its own name expression", async () => {
    const { ctes } = await generatedSql();
    expect(ctes).toContain("final_source AS name");
    expect(ctes).toContain("final_medium AS name");
    // The three that substitute a label for an empty value, each with its own wording.
    expect(ctes).toContain("COALESCE(NULLIF(final_campaign, ''), '(none)') AS name");
    expect(ctes).toContain("COALESCE(NULLIF(product_name, ''), '(unknown)') AS name");
    expect(ctes).toContain("COALESCE(NULLIF(country, ''), 'Unknown') AS name");
  });
});

describe("attribution projections", () => {
  it("projects every dimension under its own key", async () => {
    const { projections } = await generatedSql();
    for (const key of DIMENSIONS) {
      expect(projections).toContain(`FROM ${key} ORDER BY revenue DESC LIMIT 25`);
      expect(projections).toContain(`AS ${key}`);
    }
  });

  it("caps each breakdown at the same limit", async () => {
    const { projections } = await generatedSql();
    expect(projections.match(/LIMIT 25/g)).toHaveLength(5);
  });

  it("orders every breakdown by revenue", async () => {
    // A breakdown truncated at 25 rows in an arbitrary order would silently drop the
    // rows that matter.
    const { projections } = await generatedSql();
    expect(projections.match(/ORDER BY revenue DESC/g)).toHaveLength(5);
  });
});

describe("CTEs and projections stay in step", () => {
  /**
   * The invariant the three-way duplication kept breaking: a dimension is only usable if
   * it is declared, projected, *and* mapped. The response mapping is generated from the
   * same table, so proving declaration and projection agree is what is left.
   */
  it("projects exactly the dimensions it declares", async () => {
    const { ctes, projections } = await generatedSql();

    const declared = [...ctes.matchAll(/(\w+) AS \(/g)].map((m) => m[1]!);
    const projected = [...projections.matchAll(/\) s\) AS (\w+)/g)].map((m) => m[1]!);

    expect(declared).toEqual(DIMENSIONS);
    expect(projected).toEqual(DIMENSIONS);
  });

  it("returns a breakdown for every dimension in the response", async () => {
    queueRows([{}]);
    const out = await getRevenueDashboard("site_1", {});
    for (const key of DIMENSIONS) expect(out).toHaveProperty(key);
  });
});
