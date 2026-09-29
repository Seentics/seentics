import { afterAll, describe, expect, it } from "bun:test";

process.env.DATABASE_URL ??= "postgres://test-not-connected";

const { ensureFresh, rollupsEnabled, setRollupRefresher, setRollupsEnabled } = await import("../rollups/reads");

// The rebuild, as long as a test says it takes — set through the module's own seam,
// not mock.module, which would replace the builder for every other test file too.
let rebuildMs = 0;
let rebuilds = 0;
const wasEnabled = rollupsEnabled();
setRollupsEnabled(true);
setRollupRefresher(async () => {
  rebuilds++;
  await new Promise((resolve) => setTimeout(resolve, rebuildMs));
});
afterAll(async () => {
  setRollupsEnabled(wasEnabled);
  const { buildStaleRollups } = await import("../rollups/builder");
  setRollupRefresher((websiteId) => buildStaleRollups({ websiteId, recentOnly: true }));
});

const timed = async (p: Promise<void>) => {
  const t = performance.now();
  await p;
  return performance.now() - t;
};

/**
 * A read refreshes the site's recent rollups first, but waits only so long. A busy
 * site's rebuild of today took 2 s warm and 15 s cold, and the first dashboard
 * request after any new traffic used to wait for all of it.
 */
describe("ensureFresh", () => {
  it("waits for a quick rebuild, so a small site's numbers are current", async () => {
    rebuildMs = 20;
    const ms = await timed(ensureFresh("site-small"));
    expect(ms).toBeGreaterThanOrEqual(15);
    expect(ms).toBeLessThan(250);
  });

  it("answers after at most ~300 ms from a slow rebuild, which carries on in the background", async () => {
    rebuildMs = 2_000;
    const before = rebuilds;
    const ms = await timed(ensureFresh("site-busy"));
    expect(ms).toBeLessThan(450);
    // A second read while it runs shares that rebuild rather than starting another.
    await timed(ensureFresh("site-busy"));
    expect(rebuilds - before).toBe(1);
  });
});
