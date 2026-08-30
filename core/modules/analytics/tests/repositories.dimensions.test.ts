import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, isIdentifier, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * The single-attribute breakdowns.
 *
 * Each of these is a thin projection over a GROUP BY, so what is tested is the wire
 * contract: which key each row is published under, how a missing dimension value is
 * labelled, and — for geolocation — the percentage denominator, which is the one place
 * these repositories do arithmetic that a client cannot redo for itself.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

type Repo = (site: string, q: Record<string, string | undefined>) => Promise<Record<string, unknown>>;

let getPagesAnalytics: Repo;
let getReferrersAnalytics: Repo;
let getSourcesAnalytics: Repo;
let getCountriesAnalytics: Repo;
let getBrowsersAnalytics: Repo;
let getDevicesAnalytics: Repo;
let getOsAnalytics: Repo;
let getCitiesAnalytics: Repo;
let getLanguagesAnalytics: Repo;
let getResolutionsAnalytics: Repo;
let getGeolocationAnalytics: Repo;
let getPageUtmBreakdownAnalytics: Repo;
let getDimensionsBulkAnalytics: Repo;

beforeAll(async () => {
  ({ getPagesAnalytics } = (await import("../repositories/pages.repository")) as never);
  ({ getReferrersAnalytics } = (await import("../repositories/referrers.repository")) as never);
  ({ getSourcesAnalytics } = (await import("../repositories/sources.repository")) as never);
  ({ getCountriesAnalytics, getBrowsersAnalytics, getDevicesAnalytics, getOsAnalytics } =
    (await import("../repositories/dimensions.repository")) as never);
  ({ getCitiesAnalytics } = (await import("../repositories/cities.repository")) as never);
  ({ getLanguagesAnalytics } = (await import("../repositories/languages.repository")) as never);
  ({ getResolutionsAnalytics } = (await import("../repositories/resolutions.repository")) as never);
  ({ getGeolocationAnalytics } = (await import("../repositories/geolocation.repository")) as never);
  ({ getPageUtmBreakdownAnalytics } = (await import(
    "../repositories/page-utm-breakdown.repository"
  )) as never);
  ({ getDimensionsBulkAnalytics } = (await import(
    "../repositories/dimensions-bulk.repository"
  )) as never);
});

beforeEach(resetDb);

const SITE = "site_1";

// ─── Pages ───────────────────────────────────────────────────────────────────

describe("getPagesAnalytics", () => {
  it("publishes rows under top_pages with `views` and `unique`", async () => {
    queueRows([{ page: "/pricing", views: 40, unique_visitors: 22 }]);
    expect(await getPagesAnalytics(SITE, {})).toEqual({
      top_pages: [{ page: "/pricing", views: 40, unique: 22 }],
    });
  });

  it("labels a blank page path rather than emitting an empty string", async () => {
    // A blank label collapses two different rows into one indistinguishable bar.
    queueRows([{ page: "   ", views: 3, unique_visitors: 2 }]);
    const out = (await getPagesAnalytics(SITE, {})) as { top_pages: { page: string }[] };
    expect(out.top_pages[0]!.page).toBe("(not set)");
  });

  it("coerces string counts", async () => {
    queueRows([{ page: "/a", views: "40", unique_visitors: "22" }]);
    const out = (await getPagesAnalytics(SITE, {})) as { top_pages: { views: number }[] };
    expect(out.top_pages[0]!.views).toBe(40);
  });

  it("returns an empty list rather than omitting the key", async () => {
    queueRows([]);
    expect(await getPagesAnalytics(SITE, {})).toEqual({ top_pages: [] });
  });

  it("windows on the clamped day count", async () => {
    queueRows([]);
    await getPagesAnalytics(SITE, { days: "99999" });
    const start = sqlCalls[0]!.values.find(
      (v): v is string => typeof v === "string" && v.endsWith("Z"),
    )!;
    const days = (Date.now() - new Date(start).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });
});

// ─── Referrers and sources ───────────────────────────────────────────────────

describe("getReferrersAnalytics", () => {
  it("publishes rows under top_referrers with `views` and `unique`", async () => {
    queueRows([{ referrer: "google.com", views: 30, unique_visitors: 18 }]);
    expect(await getReferrersAnalytics(SITE, {})).toEqual({
      top_referrers: [{ referrer: "google.com", views: 30, unique: 18 }],
    });
  });

  it("labels a null referrer as direct traffic", async () => {
    // The query already coalesces, but the projection must not undo it — a null
    // referrer is a fact about the visit (typed the URL), not missing data.
    queueRows([{ referrer: null, views: 5, unique_visitors: 5 }]);
    const out = (await getReferrersAnalytics(SITE, {})) as {
      top_referrers: { referrer: string }[];
    };
    expect(out.top_referrers[0]!.referrer).toBe("direct");
  });

  it("returns only the referrer list — no site id or window label", async () => {
    queueRows([]);
    expect(Object.keys(await getReferrersAnalytics(SITE, {}))).toEqual(["top_referrers"]);
  });
});

describe("getSourcesAnalytics", () => {
  it("publishes source rows with a bounce rate", async () => {
    queueRows([{ source: "newsletter", views: 20, unique_visitors: 12, bounce_rate: 41.7 }]);
    expect(await getSourcesAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      date_range: "7d",
      top_sources: [{ source: "newsletter", views: 20, unique: 12, bounce_rate: 41.7 }],
    });
  });

  it("coerces a bounce rate returned as a numeric string", async () => {
    // `round(...)::numeric` comes back as a string from the driver; leaving it would
    // make the client's comparisons string comparisons.
    queueRows([{ source: "x", views: "2", unique_visitors: "2", bounce_rate: "100.0" }]);
    const out = (await getSourcesAnalytics(SITE, {})) as {
      top_sources: { bounce_rate: number }[];
    };
    expect(out.top_sources[0]!.bounce_rate).toBe(100);
    expect(typeof out.top_sources[0]!.bounce_rate).toBe("number");
  });

  it("reports a zero bounce rate as 0 rather than dropping the field", async () => {
    queueRows([{ source: "x", views: 2, unique_visitors: 2, bounce_rate: 0 }]);
    const out = (await getSourcesAnalytics(SITE, {})) as {
      top_sources: { bounce_rate: number }[];
    };
    expect(out.top_sources[0]).toHaveProperty("bounce_rate", 0);
  });
});

// ─── The four shared-shape dimensions ────────────────────────────────────────

describe("single-column dimensions", () => {
  const cases = [
    { name: "countries", run: () => getCountriesAnalytics(SITE, {}), key: "top_countries", col: "country" },
    { name: "browsers", run: () => getBrowsersAnalytics(SITE, {}), key: "top_browsers", col: "browser" },
    { name: "devices", run: () => getDevicesAnalytics(SITE, {}), key: "top_devices", col: "device" },
    { name: "operating systems", run: () => getOsAnalytics(SITE, {}), key: "top_os", col: "os" },
  ] as const;

  for (const { name, run, key, col } of cases) {
    it(`publishes ${name} under ${key} keyed by \`${col}\``, async () => {
      queueRows([{ k: "value", views: 12, unique_visitors: 8 }]);
      expect(await run()).toEqual({ [key]: [{ [col]: "value", views: 12, unique: 8 }] });
    });

    it(`escapes \`${col}\` as an identifier rather than interpolating it as a value`, async () => {
      // The column name is spliced into SELECT, WHERE, GROUP BY and ORDER BY. It comes
      // from a closed union today, but it must travel as an identifier so widening that
      // union later cannot turn it into an injection point.
      queueRows([]);
      await run();
      const idents = sqlCalls[0]!.values.filter(isIdentifier);
      expect(idents.length).toBeGreaterThan(0);
      expect(idents.every((i) => i.__ident === col)).toBe(true);
    });

    it(`returns an empty ${key} list for a site with no data`, async () => {
      queueRows([]);
      expect(await run()).toEqual({ [key]: [] });
    });
  }

  it("gives each dimension its own key so a bulk merge cannot collide", async () => {
    const keys: string[] = [];
    for (const { run } of cases) {
      resetDb();
      queueRows([]);
      keys.push(...Object.keys(await run()));
    }
    expect(new Set(keys).size).toBe(4);
  });
});

// ─── Cities, languages, resolutions ──────────────────────────────────────────

describe("getCitiesAnalytics", () => {
  it("publishes rows under top_cities", async () => {
    queueRows([{ city: "Dhaka", views: 9, unique: 6 }]);
    expect(await getCitiesAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      top_cities: [{ city: "Dhaka", views: 9, unique: 6 }],
    });
  });

  it("returns an empty list for a site with no city data", async () => {
    queueRows([]);
    expect(await getCitiesAnalytics(SITE, {})).toEqual({ website_id: SITE, top_cities: [] });
  });
});

describe("getLanguagesAnalytics", () => {
  it("publishes rows under top_languages", async () => {
    queueRows([{ language: "en-US", views: 9, unique: 6 }]);
    expect(await getLanguagesAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      top_languages: [{ language: "en-US", views: 9, unique: 6 }],
    });
  });
});

describe("getResolutionsAnalytics", () => {
  it("publishes the WxH label the query composed", async () => {
    queueRows([{ resolution: "1920x1080", views: 12, unique: 7 }]);
    expect(await getResolutionsAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      date_range: "7d",
      top_resolutions: [{ resolution: "1920x1080", views: 12, unique: 7 }],
    });
  });

  it("coerces string counts", async () => {
    queueRows([{ resolution: "800x600", views: "3", unique: "2" }]);
    const out = (await getResolutionsAnalytics(SITE, {})) as {
      top_resolutions: { resolution: string; views: number; unique: number }[];
    };
    expect(out.top_resolutions[0]).toEqual({ resolution: "800x600", views: 3, unique: 2 });
  });
});

// ─── Geolocation: the one with a denominator ─────────────────────────────────

describe("getGeolocationAnalytics", () => {
  /** Site-wide unique visitors, then countries, then cities. */
  function geoRows(uv: number, countries: unknown[], cities: unknown[] = []) {
    queueRows([{ uv }], countries, cities);
  }

  it("issues the total, the country breakdown, and the city breakdown", async () => {
    geoRows(0, []);
    await getGeolocationAnalytics(SITE, {});
    expect(sqlCalls).toHaveLength(3);
  });

  it("resolves a two-letter country code to a display name and keeps the code", async () => {
    geoRows(100, [{ country: "US", views: 60, unique_visitors: 40 }]);
    const out = (await getGeolocationAnalytics(SITE, {})) as {
      countries: { name: string; code?: string; count: number; percentage: number }[];
    };
    expect(out.countries[0]).toEqual({ name: "United States", code: "US", count: 40, percentage: 40 });
  });

  it("leaves a non-code country as its own label with no code", async () => {
    geoRows(10, [{ country: "Unknown Region", views: 2, unique_visitors: 2 }]);
    const out = (await getGeolocationAnalytics(SITE, {})) as {
      countries: { name: string; code?: string }[];
    };
    expect(out.countries[0]!.name).toBe("Unknown Region");
    expect(out.countries[0]!.code).toBeUndefined();
  });

  it("takes the percentage denominator from site-wide uniques, not the column sum", async () => {
    // A visitor with pageviews from two countries counts once site-wide but twice in
    // the per-country sum, so the shares must not be normalised to add up to 100.
    geoRows(100, [
      { country: "US", views: 90, unique_visitors: 60 },
      { country: "GB", views: 50, unique_visitors: 50 },
    ]);
    const out = (await getGeolocationAnalytics(SITE, {})) as {
      countries: { percentage: number }[];
    };
    expect(out.countries.map((c) => c.percentage)).toEqual([60, 50]);
  });

  it("rounds each share to one decimal place", async () => {
    geoRows(3, [{ country: "US", views: 1, unique_visitors: 1 }]);
    const out = (await getGeolocationAnalytics(SITE, {})) as {
      countries: { percentage: number }[];
    };
    expect(out.countries[0]!.percentage).toBe(33.3);
  });

  it("counts unique visitors, not views", async () => {
    geoRows(100, [{ country: "US", views: 900, unique_visitors: 40 }]);
    const out = (await getGeolocationAnalytics(SITE, {})) as { countries: { count: number }[] };
    expect(out.countries[0]!.count).toBe(40);
  });

  it("returns 0% rather than NaN when the site has no visitors", async () => {
    geoRows(0, [{ country: "US", views: 0, unique_visitors: 0 }]);
    const out = (await getGeolocationAnalytics(SITE, {})) as {
      countries: { percentage: number }[];
    };
    expect(out.countries[0]!.percentage).toBe(0);
  });

  it("shares the site-wide denominator with cities", async () => {
    geoRows(200, [], [{ city: "Dhaka", country: "BD", views: 30, unique_visitors: 20 }]);
    const out = (await getGeolocationAnalytics(SITE, {})) as {
      cities: { name: string; code?: string; count: number; percentage: number }[];
    };
    expect(out.cities[0]).toEqual({ name: "Dhaka", code: "BD", count: 20, percentage: 10 });
  });

  it("keeps continents and regions present but empty so the shape stays stable", async () => {
    geoRows(0, []);
    const out = (await getGeolocationAnalytics(SITE, {})) as Record<string, unknown>;
    expect(out.continents).toEqual([]);
    expect(out.regions).toEqual([]);
    expect(Object.keys(out).sort()).toEqual([
      "cities",
      "continents",
      "countries",
      "date_range",
      "regions",
      "website_id",
    ]);
  });
});

// ─── Page × UTM ──────────────────────────────────────────────────────────────

describe("getPageUtmBreakdownAnalytics", () => {
  it("keeps every UTM field, using null for the ones that were absent", async () => {
    // The three UTM columns are the grouping key. Collapsing an absent one to "" would
    // merge two genuinely different campaign rows.
    queueRows([
      {
        page: "/pricing",
        utm_source: "newsletter",
        utm_medium: null,
        utm_campaign: undefined,
        views: 12,
        unique_visitors: 9,
      },
    ]);
    const out = (await getPageUtmBreakdownAnalytics(SITE, {})) as {
      breakdown: Record<string, unknown>[];
    };
    expect(out.breakdown[0]).toEqual({
      page: "/pricing",
      utm_source: "newsletter",
      utm_medium: null,
      utm_campaign: null,
      views: 12,
      unique_visitors: 9,
    });
  });

  it("defaults to a seven-day window", async () => {
    queueRows([]);
    expect((await getPageUtmBreakdownAnalytics(SITE, {})).date_range).toBe("7d");
  });

  it("returns an empty breakdown for a site with no campaign traffic", async () => {
    queueRows([]);
    expect(await getPageUtmBreakdownAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      date_range: "7d",
      breakdown: [],
    });
  });
});

// ─── Bulk ────────────────────────────────────────────────────────────────────

describe("getDimensionsBulkAnalytics", () => {
  /** Pages, referrers, countries, browsers, devices, OS — in issue order. */
  function bulkRows(over: Partial<Record<string, unknown[]>> = {}) {
    queueRows(
      (over.pages as unknown[]) ?? [],
      (over.referrers as unknown[]) ?? [],
      (over.countries as unknown[]) ?? [],
      (over.browsers as unknown[]) ?? [],
      (over.devices as unknown[]) ?? [],
      (over.os as unknown[]) ?? [],
    );
  }

  it("answers all six breakdowns in six queries, not six round trips per dimension", async () => {
    bulkRows();
    await getDimensionsBulkAnalytics(SITE, {});
    expect(sqlCalls).toHaveLength(6);
  });

  it("publishes each dimension under the key its dedicated endpoint uses", async () => {
    // The dashboard swaps between the bulk endpoint and the individual ones; a key
    // that differs between them breaks whichever path is less exercised.
    bulkRows({
      pages: [{ k: "/a", views: 1, unique_visitors: 1 }],
      referrers: [{ referrer: "direct", views: 2, unique_visitors: 2 }],
      countries: [{ k: "US", views: 3, unique_visitors: 3 }],
      browsers: [{ k: "Chrome", views: 4, unique_visitors: 4 }],
      devices: [{ k: "desktop", views: 5, unique_visitors: 5 }],
      os: [{ k: "macOS", views: 6, unique_visitors: 6 }],
    });
    expect(await getDimensionsBulkAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      date_range: "7d",
      top_pages: [{ page: "/a", views: 1, unique: 1 }],
      top_referrers: [{ referrer: "direct", views: 2, unique: 2 }],
      top_countries: [{ country: "US", views: 3, unique: 3 }],
      top_browsers: [{ browser: "Chrome", views: 4, unique: 4 }],
      top_devices: [{ device: "desktop", views: 5, unique: 5 }],
      top_os: [{ os: "macOS", views: 6, unique: 6 }],
    });
  });

  it("matches the individual endpoints' row shape for the same data", async () => {
    // The strongest form of the previous test: run the dedicated repository and the
    // bulk one over identical rows and require identical output.
    queueRows([{ page: "/a", views: 3, unique_visitors: 2 }]);
    const single = await getPagesAnalytics(SITE, {});

    resetDb();
    bulkRows({ pages: [{ k: "/a", views: 3, unique_visitors: 2 }] });
    const bulk = (await getDimensionsBulkAnalytics(SITE, {})) as { top_pages: unknown };

    expect(bulk.top_pages).toEqual((single as { top_pages: unknown }).top_pages);
  });

  it("windows every one of the six queries identically", async () => {
    // Six separate queries with drifting bounds would report dimensions from different
    // ranges under one date_range label.
    bulkRows();
    await getDimensionsBulkAnalytics(SITE, { days: "30" });

    const starts = sqlCalls.map(
      (c) => c.values.find((v): v is string => typeof v === "string" && v.endsWith("Z"))!,
    );
    expect(new Set(starts).size).toBe(1);
  });

  it("scopes every one of the six queries to the same website", async () => {
    bulkRows();
    await getDimensionsBulkAnalytics(SITE, {});
    expect(sqlCalls.every((c) => c.values.includes(SITE))).toBe(true);
  });

  it("returns six empty lists for a site with no traffic", async () => {
    bulkRows();
    const out = (await getDimensionsBulkAnalytics(SITE, {})) as Record<string, unknown>;
    for (const key of [
      "top_pages",
      "top_referrers",
      "top_countries",
      "top_browsers",
      "top_devices",
      "top_os",
    ]) {
      expect(out[key]).toEqual([]);
    }
  });
});
