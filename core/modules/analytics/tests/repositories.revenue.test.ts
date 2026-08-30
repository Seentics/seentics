import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * Revenue reporting.
 *
 * Money, so the rounding is part of the contract rather than a presentation detail:
 * currency amounts to the cent, revenue-per-session to four places because it is
 * routinely under a cent, and share percentages to one. The other thing worth pinning
 * is the conditional keys — `refund_total` and `new_customer_revenue_pct` are omitted
 * rather than zeroed, which a client distinguishes from "zero refunds".
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

/* eslint-disable @typescript-eslint/no-explicit-any */
let getRevenueDashboard: any;

beforeAll(async () => {
  ({ getRevenueDashboard } = await import("../repositories/revenue.repository"));
});

beforeEach(resetDb);

const SITE = "site_1";

/** The single wide row the CTE chain returns. */
function revenueRow(over: Record<string, unknown> = {}) {
  queueRows([
    {
      summary: {
        total_revenue: 0,
        orders: 0,
        orders_with_value: 0,
        unique_customers: 0,
        new_cust_revenue: null,
      },
      refund_total: null,
      prior: { prior_revenue: 0, prior_orders: 0 },
      sessions: null,
      unique_visitors: null,
      dominant_currency: null,
      daily: null,
      by_source: null,
      by_medium: null,
      by_campaign: null,
      by_product: null,
      by_country: null,
      recent_transactions: null,
      ...over,
    },
  ]);
}

function summary(over: Record<string, unknown> = {}) {
  return {
    summary: {
      total_revenue: 1000,
      orders: 8,
      orders_with_value: 8,
      unique_customers: 6,
      new_cust_revenue: null,
      ...(over.summary as object),
    },
    ...over,
  };
}

describe("getRevenueDashboard", () => {
  it("answers in a single round trip", async () => {
    revenueRow();
    await getRevenueDashboard(SITE, {});
    expect(sqlCalls).toHaveLength(1);
  });

  it("defaults to a thirty-day window", async () => {
    revenueRow();
    expect((await getRevenueDashboard(SITE, {})).days).toBe(30);
  });

  it("reports the clamped window, not the raw parameter", async () => {
    revenueRow();
    expect((await getRevenueDashboard(SITE, { days: "-5" })).days).toBe(30);
    resetDb();
    revenueRow();
    expect((await getRevenueDashboard(SITE, { days: "90" })).days).toBe(90);
  });

  it("sanitises the timezone before bucketing daily revenue", async () => {
    revenueRow();
    await getRevenueDashboard(SITE, { timezone: "'; DROP TABLE x; --" });
    expect(sqlCalls[0]!.values).toContain("UTC");
  });

  // ─── Derived rates ────────────────────────────────────────────────────────

  describe("summary arithmetic", () => {
    it("computes average order value as revenue over orders", async () => {
      revenueRow(summary({ summary: { total_revenue: 1000, orders: 8, orders_with_value: 8, unique_customers: 6, new_cust_revenue: null } }));
      expect((await getRevenueDashboard(SITE, {})).summary.aov).toBe(125);
    });

    it("rounds AOV to the cent", async () => {
      // 1000/3 = 333.333… → 333.33
      revenueRow(summary({ summary: { total_revenue: 1000, orders: 3, orders_with_value: 3, unique_customers: 3, new_cust_revenue: null } }));
      expect((await getRevenueDashboard(SITE, {})).summary.aov).toBe(333.33);
    });

    it("computes revenue per session to four decimal places", async () => {
      // A per-session figure is routinely a fraction of a cent, so two places would
      // round most real values to zero and make the metric useless.
      revenueRow({ ...summary({ summary: { total_revenue: 100, orders: 4, orders_with_value: 4, unique_customers: 4, new_cust_revenue: null } }), sessions: 30000 });
      expect((await getRevenueDashboard(SITE, {})).summary.revenue_per_session).toBe(0.0033);
    });

    it("computes ARPU over unique visitors, not customers", async () => {
      // "Per user" means everyone who visited, including those who never bought —
      // dividing by customers would just restate AOV per customer.
      revenueRow({
        ...summary({ summary: { total_revenue: 1000, orders: 8, orders_with_value: 8, unique_customers: 5, new_cust_revenue: null } }),
        unique_visitors: 400,
      });
      expect((await getRevenueDashboard(SITE, {})).summary.arpu).toBe(2.5);
    });

    it("returns zero rather than Infinity for every rate when the divisor is zero", async () => {
      revenueRow(summary({ summary: { total_revenue: 500, orders: 0, orders_with_value: 0, unique_customers: 0, new_cust_revenue: null }, sessions: 0, unique_visitors: 0 }));
      const s = (await getRevenueDashboard(SITE, {})).summary;
      for (const v of [s.aov, s.revenue_per_session, s.arpu]) {
        expect(v).toBe(0);
        expect(Number.isFinite(v)).toBe(true);
      }
    });

    it("rounds the revenue total to the cent", async () => {
      revenueRow(summary({ summary: { total_revenue: 1234.5678, orders: 1, orders_with_value: 1, unique_customers: 1, new_cust_revenue: null } }));
      expect((await getRevenueDashboard(SITE, {})).summary.total_revenue).toBe(1234.57);
    });

    it("defaults the currency to USD when no purchase carried one", async () => {
      revenueRow();
      expect((await getRevenueDashboard(SITE, {})).summary.currency).toBe("USD");
    });

    it("reports the dominant currency when the data has one", async () => {
      revenueRow({ dominant_currency: "EUR" });
      expect((await getRevenueDashboard(SITE, {})).summary.currency).toBe("EUR");
    });
  });

  describe("period comparison", () => {
    it("expresses the change as a percentage of prior revenue, to one decimal", async () => {
      revenueRow({
        ...summary({ summary: { total_revenue: 1500, orders: 8, orders_with_value: 8, unique_customers: 6, new_cust_revenue: null } }),
        prior: { prior_revenue: 1000, prior_orders: 5 },
      });
      const prior = (await getRevenueDashboard(SITE, {})).summary.prior_period;
      expect(prior).toEqual({ total_revenue: 1000, orders: 5, change_pct: 50 });
    });

    it("keeps a decline negative", async () => {
      revenueRow({
        ...summary({ summary: { total_revenue: 750, orders: 3, orders_with_value: 3, unique_customers: 3, new_cust_revenue: null } }),
        prior: { prior_revenue: 1000, prior_orders: 5 },
      });
      expect((await getRevenueDashboard(SITE, {})).summary.prior_period.change_pct).toBe(-25);
    });

    it("returns 0 rather than Infinity when the prior period had no revenue", async () => {
      revenueRow({
        ...summary({ summary: { total_revenue: 900, orders: 3, orders_with_value: 3, unique_customers: 3, new_cust_revenue: null } }),
        prior: { prior_revenue: 0, prior_orders: 0 },
      });
      const pct = (await getRevenueDashboard(SITE, {})).summary.prior_period.change_pct;
      expect(pct).toBe(0);
      expect(Number.isFinite(pct)).toBe(true);
    });

    it("survives a null prior block", async () => {
      revenueRow({ ...summary(), prior: null });
      expect((await getRevenueDashboard(SITE, {})).summary.prior_period).toEqual({
        total_revenue: 0,
        orders: 0,
        change_pct: 0,
      });
    });
  });

  // ─── Data quality ─────────────────────────────────────────────────────────

  describe("data quality", () => {
    it("reports no_revenue with guidance when there are no orders", async () => {
      revenueRow();
      const out = await getRevenueDashboard(SITE, {});
      expect(out.data_quality).toBe("no_revenue");
      expect(out.data_note).toContain("seentics.track('purchase'");
    });

    it("reports partial when some purchases carried no numeric value", async () => {
      // The distinction matters: a partial total under-reports revenue, and the client
      // has to be able to say so rather than presenting it as complete.
      revenueRow(summary({ summary: { total_revenue: 500, orders: 10, orders_with_value: 6, unique_customers: 5, new_cust_revenue: null } }));
      const out = await getRevenueDashboard(SITE, {});
      expect(out.data_quality).toBe("partial");
      expect(out.data_note).toContain("missing a numeric `value`");
    });

    it("reports full and omits the note when every order carried a value", async () => {
      revenueRow(summary());
      const out = await getRevenueDashboard(SITE, {});
      expect(out.data_quality).toBe("full");
      expect(out).not.toHaveProperty("data_note");
    });

    it("treats one valueless order out of many as partial", async () => {
      revenueRow(summary({ summary: { total_revenue: 500, orders: 10, orders_with_value: 9, unique_customers: 5, new_cust_revenue: null } }));
      expect((await getRevenueDashboard(SITE, {})).data_quality).toBe("partial");
    });
  });

  // ─── Conditional keys ─────────────────────────────────────────────────────

  describe("conditional summary keys", () => {
    it("omits refund_total when there were no refunds", async () => {
      revenueRow(summary({ refund_total: 0 }));
      expect((await getRevenueDashboard(SITE, {})).summary).not.toHaveProperty("refund_total");
    });

    it("includes refund_total, rounded, when refunds occurred", async () => {
      revenueRow(summary({ refund_total: 12.345 }));
      expect((await getRevenueDashboard(SITE, {})).summary.refund_total).toBe(12.35);
    });

    it("omits the new-customer share when the query did not compute one", async () => {
      revenueRow(summary());
      expect((await getRevenueDashboard(SITE, {})).summary).not.toHaveProperty(
        "new_customer_revenue_pct",
      );
    });

    it("reports the new-customer share as a percentage of total revenue", async () => {
      revenueRow(summary({ summary: { total_revenue: 1000, orders: 8, orders_with_value: 8, unique_customers: 6, new_cust_revenue: 250 } }));
      expect((await getRevenueDashboard(SITE, {})).summary.new_customer_revenue_pct).toBe(25);
    });

    it("omits the new-customer share when total revenue is zero", async () => {
      // 0/0 would be NaN, which serialises to null and reads as "no data" rather than
      // "not applicable".
      revenueRow(summary({ summary: { total_revenue: 0, orders: 2, orders_with_value: 0, unique_customers: 1, new_cust_revenue: 0 } }));
      expect((await getRevenueDashboard(SITE, {})).summary).not.toHaveProperty(
        "new_customer_revenue_pct",
      );
    });
  });

  // ─── Attribution dimensions ───────────────────────────────────────────────

  describe("attribution breakdowns", () => {
    const dims = ["by_source", "by_medium", "by_campaign", "by_product", "by_country"] as const;

    it("computes each row's share of total revenue to one decimal", async () => {
      revenueRow({
        ...summary({ summary: { total_revenue: 1000, orders: 8, orders_with_value: 8, unique_customers: 6, new_cust_revenue: null } }),
        by_source: [
          { name: "google", revenue: 600, orders: 5 },
          { name: "newsletter", revenue: 333.333, orders: 3 },
        ],
      });
      const rows = (await getRevenueDashboard(SITE, {})).by_source;
      expect(rows[0]).toEqual({ name: "google", revenue: 600, orders: 5, share_pct: 60 });
      expect(rows[1]).toEqual({ name: "newsletter", revenue: 333.33, orders: 3, share_pct: 33.3 });
    });

    it("returns a zero share rather than NaN when there is no revenue to divide", async () => {
      revenueRow({ by_source: [{ name: "google", revenue: 0, orders: 0 }] });
      expect((await getRevenueDashboard(SITE, {})).by_source[0].share_pct).toBe(0);
    });

    it("coerces string amounts from the driver's numeric columns", async () => {
      revenueRow({
        ...summary({ summary: { total_revenue: 100, orders: 1, orders_with_value: 1, unique_customers: 1, new_cust_revenue: null } }),
        by_product: [{ name: "Pro", revenue: "50.005", orders: "2" }],
      });
      const row = (await getRevenueDashboard(SITE, {})).by_product[0];
      expect(row.revenue).toBe(50.01);
      expect(row.orders).toBe(2);
    });

    for (const dim of dims) {
      it(`returns ${dim} as an empty list when the aggregate was null`, async () => {
        revenueRow();
        expect((await getRevenueDashboard(SITE, {}))[dim]).toEqual([]);
      });
    }

    it("gives every dimension the same row shape", async () => {
      const rows = [{ name: "x", revenue: 10, orders: 1 }];
      revenueRow({
        ...summary(),
        by_source: rows,
        by_medium: rows,
        by_campaign: rows,
        by_product: rows,
        by_country: rows,
      });
      const out = await getRevenueDashboard(SITE, {});
      const shapes = dims.map((d) => Object.keys(out[d][0]).sort().join(","));
      expect(new Set(shapes).size).toBe(1);
      expect(shapes[0]).toBe("name,orders,revenue,share_pct");
    });
  });

  // ─── Daily series ─────────────────────────────────────────────────────────

  describe("daily series", () => {
    it("renames the day bucket to `date` and rounds revenue to the cent", async () => {
      revenueRow({ ...summary(), daily: [{ day: "2026-03-01", revenue: 123.456, orders: 3 }] });
      expect((await getRevenueDashboard(SITE, {})).daily).toEqual([
        { date: "2026-03-01", revenue: 123.46, orders: 3 },
      ]);
    });

    it("returns an empty series when the aggregate was null", async () => {
      revenueRow();
      expect((await getRevenueDashboard(SITE, {})).daily).toEqual([]);
    });
  });

  // ─── Transactions ─────────────────────────────────────────────────────────

  describe("recent transactions", () => {
    const tx = {
      id: "tx1",
      occurred_at: "2026-03-01T10:00:00.000Z",
      value: 99.999,
      currency: "EUR",
      product_name: "Pro",
      order_id: "ord-1",
      source: "google",
      medium: "cpc",
      campaign: "spring",
      country: "US",
      user_type: "new",
      items: [{ sku: "a" }],
    };

    it("rounds the amount to the cent and keeps every populated field", async () => {
      revenueRow({ ...summary(), recent_transactions: [tx] });
      expect((await getRevenueDashboard(SITE, {})).recent_transactions[0]).toEqual({
        id: "tx1",
        occurred_at: "2026-03-01T10:00:00.000Z",
        value: 100,
        currency: "EUR",
        product_name: "Pro",
        order_id: "ord-1",
        source: "google",
        medium: "cpc",
        campaign: "spring",
        country: "US",
        user_type: "new",
        items: [{ sku: "a" }],
      });
    });

    it("omits optional fields the transaction did not carry", async () => {
      // Absent rather than empty-string, so a table can skip the column instead of
      // rendering a blank cell that looks like a missing value.
      revenueRow({
        ...summary(),
        recent_transactions: [
          { id: "tx2", occurred_at: "2026-03-01T10:00:00.000Z", value: 10, currency: "USD" },
        ],
      });
      const out = (await getRevenueDashboard(SITE, {})).recent_transactions[0];
      expect(Object.keys(out).sort()).toEqual(["currency", "id", "occurred_at", "value"]);
    });

    it("defaults a blank currency to USD", async () => {
      revenueRow({ ...summary(), recent_transactions: [{ ...tx, currency: "" }] });
      expect((await getRevenueDashboard(SITE, {})).recent_transactions[0].currency).toBe("USD");
    });

    it("drops a user_type outside the known set rather than passing it through", async () => {
      revenueRow({ ...summary(), recent_transactions: [{ ...tx, user_type: "mystery" }] });
      expect((await getRevenueDashboard(SITE, {})).recent_transactions[0]).not.toHaveProperty(
        "user_type",
      );
    });

    it("accepts `returning` as well as `new`", async () => {
      revenueRow({ ...summary(), recent_transactions: [{ ...tx, user_type: "returning" }] });
      expect((await getRevenueDashboard(SITE, {})).recent_transactions[0].user_type).toBe(
        "returning",
      );
    });

    it("drops a non-array items payload", async () => {
      revenueRow({ ...summary(), recent_transactions: [{ ...tx, items: "not-an-array" }] });
      expect((await getRevenueDashboard(SITE, {})).recent_transactions[0]).not.toHaveProperty(
        "items",
      );
    });

    it("returns an empty list when the aggregate was null", async () => {
      revenueRow();
      expect((await getRevenueDashboard(SITE, {})).recent_transactions).toEqual([]);
    });
  });

  // ─── Empty dashboard ──────────────────────────────────────────────────────

  describe("when the query returns no row at all", () => {
    it("answers the fully-formed empty dashboard", async () => {
      queueRows([]);
      const out = await getRevenueDashboard(SITE, { days: "14" });

      expect(out.website_id).toBe(SITE);
      expect(out.days).toBe(14);
      expect(out.data_quality).toBe("no_revenue");
      expect(out.summary).toEqual({
        total_revenue: 0,
        currency: "USD",
        orders: 0,
        aov: 0,
        sessions: 0,
        revenue_per_session: 0,
        arpu: 0,
        unique_customers: 0,
        prior_period: { total_revenue: 0, orders: 0, change_pct: 0 },
      });
      expect(out.daily).toEqual([]);
      expect(out.recent_transactions).toEqual([]);
    });

    it("carries the same top-level keys as a populated dashboard", async () => {
      // A client that reads `by_country` must not have to branch on emptiness.
      queueRows([]);
      const empty = await getRevenueDashboard(SITE, {});

      resetDb();
      revenueRow(summary());
      const full = await getRevenueDashboard(SITE, {});

      const emptyKeys = Object.keys(empty).sort();
      const fullKeys = Object.keys(full).sort();
      // `data_note` is present only when there is something to say about the data.
      expect(fullKeys.filter((k) => k !== "data_note")).toEqual(
        emptyKeys.filter((k) => k !== "data_note"),
      );
    });

    it("survives a row whose summary block is null", async () => {
      revenueRow({ summary: null });
      const out = await getRevenueDashboard(SITE, {});
      expect(out.summary.total_revenue).toBe(0);
      expect(out.data_quality).toBe("no_revenue");
    });
  });
});
