import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, application, buckets, listKeys, objectExists, putObject, seedUser, seedWebsite, sql, type SeededWebsite } from "./harness";
import { collect, eventually, flushIngest, MOBILE_UA } from "./helpers/recordings";

setDefaultTimeout(30_000);

async function siteWithOwner() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

const click = (site: SeededWebsite, path: string, nx: number, ny: number, extra: Record<string, unknown> = {}) => ({
  type: "heatmap_click",
  ts: Date.now() - 5_000,
  url: `https://${site.domain}${path}`,
  sid: "s-heat",
  data: { nx, ny, target: "button#buy", vw: 1280, vh: 800, ...extra },
});
const scroll = (site: SeededWebsite, path: string, depth: number) => ({
  type: "heatmap_scroll",
  ts: Date.now() - 5_000,
  url: `https://${site.domain}${path}`,
  sid: "s-heat",
  data: { depth },
});

async function pointTotal(site: SeededWebsite): Promise<number> {
  const [r] = await sql<{ n: number }[]>`SELECT COALESCE(SUM(intensity), 0)::int AS n FROM heatmap_points WHERE website_id = ${site.id}::uuid`;
  return r!.n;
}

/** Send points and wait until the site's stored intensity reaches `expected`. */
async function ingestPoints(site: SeededWebsite, heatmaps: unknown[], expected: number, ua?: string) {
  expect((await collect(site, { heatmaps }, { ua })).status).toBe(200);
  await eventually(async () => (await pointTotal(site)) >= expected);
}

/** A DOM snapshot event for `path`, optionally tagged with a page version. */
function domSnapshot(site: SeededWebsite, path: string, opts: { version?: string; marker?: string } = {}) {
  return {
    type: "heatmap_dom_snapshot",
    ts: Date.now(),
    url: `https://${site.domain}${path}?token=secret`,
    sid: "s-heat",
    doc_w: 1280,
    doc_h: 2400,
    data: { html: `<!doctype html><html><body><main>${opts.marker ?? randomUUID()} ${"content ".repeat(30)}</main></body></html>`, ...(opts.version ? { page_version: opts.version } : {}) },
  };
}

async function ingestSnapshot(site: SeededWebsite, ev: ReturnType<typeof domSnapshot>, wait: () => Promise<boolean>) {
  expect((await collect(site, { heatmap_dom_snapshot: [ev] })).status).toBe(200);
  await eventually(wait);
}

/** A tiny but valid-looking JPEG: the magic bytes, padding past the 400-byte floor. */
function jpegBase64(fill = 0): string {
  const b = Buffer.alloc(600, fill);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0;
  b[598] = 0xff; b[599] = 0xd9;
  return `data:image/jpeg;base64,${b.toString("base64")}`;
}

describe("heatmap ingest and reads", () => {
  it("stores clicks and scrolls from the tracker and lists the page with its counts", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/pricing", 0.5, 0.25), click(site, "/pricing", 0.5, 0.25), scroll(site, "/pricing", 0.8)], 3);

    const pages = await api("GET", `/api/v1/heatmaps/${site.id}/pages`, { token: owner.token });

    expect(pages.status).toBe(200);
    expect(pages.body.pages).toHaveLength(1);
    expect(pages.body.pages[0]).toMatchObject({ page_path: "/pricing", click_count: 2, scroll_count: 1, avg_scroll: 80 });
  });

  it("returns a page's click points, one per cell with summed intensity, at the 10000x scale", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/a", 0.5, 0.25), click(site, "/a", 0.5, 0.25), click(site, "/a", 0.1, 0.9), click(site, "/b", 0.3, 0.3)], 4);

    const res = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: owner.token, query: { page_path: "/a" } });

    expect(res.status).toBe(200);
    expect(res.body.page_path).toBe("/a");
    expect(res.body.points.map((p: { x_percent: number; y_percent: number; intensity: number }) => [p.x_percent, p.y_percent, p.intensity]))
      .toEqual([[5000, 2500, 2], [1000, 9000, 1]]);
    expect(res.body.points[0]).toMatchObject({ event_type: "click", device_type: "desktop", target_selector: "button#buy", cap_vw: 1280 });
  });

  it("returns scroll depths separately from clicks", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5), scroll(site, "/", 0.4)], 2);
    const res = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: owner.token, query: { page_path: "/", event_type: "scroll" } });
    expect(res.body.points).toHaveLength(1);
    expect(res.body.points[0]).toMatchObject({ event_type: "scroll", y_percent: 40, intensity: 1 });
  });

  it("files points under the visitor's device", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.2, 0.2)], 1);
    await ingestPoints(site, [click(site, "/", 0.2, 0.2)], 2, MOBILE_UA);
    const res = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: owner.token, query: { page_path: "/" } });
    expect(res.body.points.map((p: { device_type: string }) => p.device_type).sort()).toEqual(["desktop", "mobile"]);
  });

  it("collapses dynamic id segments so one route is one heatmap", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/orders/1234567", 0.5, 0.5), click(site, "/orders/7654321", 0.5, 0.5)], 2);
    const res = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: owner.token, query: { page_path: "/orders/999999" } });
    expect(res.body.page_path).toBe("/orders/:id");
    expect(res.body.points[0].intensity).toBe(2);
  });

  it("reads only the requested window of days", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5), click(site, "/", 0.1, 0.1)], 2);
    await sql`UPDATE heatmap_points SET day = current_date - 20 WHERE website_id = ${site.id}::uuid AND x_percent = 1000`;

    const week = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: owner.token, query: { page_path: "/", days: 7 } });
    const all = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: owner.token, query: { page_path: "/" } });
    const pages = await api("GET", `/api/v1/heatmaps/${site.id}/pages`, { token: owner.token, query: { days: 7 } });

    expect(week.body.points).toHaveLength(1);
    expect(all.body.points).toHaveLength(2);
    expect(pages.body.pages[0].click_count).toBe(1);
  });

  it("counts a click resent with the same event id once", async () => {
    // The tracker resends its summary when the page closes; counting it twice inflates the map.
    const { site } = await siteWithOwner();
    const eventId = `e-${randomUUID()}`;
    await ingestPoints(site, [click(site, "/", 0.5, 0.5, { event_id: eventId })], 1);
    expect((await collect(site, { heatmaps: [click(site, "/", 0.5, 0.5, { event_id: eventId })] })).status).toBe(200);
    // A fresh click proves the resend's batch was drained too.
    await ingestPoints(site, [click(site, "/", 0.9, 0.9)], 2);
    expect(await pointTotal(site)).toBe(2);
  });

  it("counts a batch retried under the same batch id once", async () => {
    const { site } = await siteWithOwner();
    const batchId = `b-${randomUUID()}`;
    expect((await collect(site, { batch_id: batchId, heatmaps: [click(site, "/", 0.5, 0.5)] })).status).toBe(200);
    const retry = await collect(site, { batch_id: batchId, heatmaps: [click(site, "/", 0.5, 0.5)] });
    expect(retry.body.message).toBe("duplicate");
    await ingestPoints(site, [click(site, "/", 0.7, 0.7)], 2);
    expect(await pointTotal(site)).toBe(2);
  });

  it("stores nothing for a site with heatmaps switched off", async () => {
    const { site } = await siteWithOwner();
    await sql`UPDATE websites SET heatmap_enabled = false WHERE id = ${site.id}::uuid`;
    await collect(site, { heatmaps: [click(site, "/", 0.5, 0.5)] });
    await flushIngest();
    expect(await pointTotal(site)).toBe(0);
  });
});

describe("heatmap read access and validation", () => {
  it("requires a signed-in user", async () => {
    const { site } = await siteWithOwner();
    expect((await api("GET", `/api/v1/heatmaps/${site.id}/pages`)).status).toBe(401);
    expect((await api("GET", `/api/v1/heatmaps/${site.id}/data`, { query: { page_path: "/" } })).status).toBe(401);
  });

  it("refuses another account's site", async () => {
    const { site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5)], 1);
    const stranger = await seedUser();
    expect((await api("GET", `/api/v1/heatmaps/${site.id}/pages`, { token: stranger.token })).status).toBe(403);
    const data = await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: stranger.token, query: { page_path: "/" } });
    expect(data.status).toBe(403);
    expect(data.body.points).toBeUndefined();
  });

  it("lets a viewer read pages and points", async () => {
    const { site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5)], 1);
    const viewer = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    expect((await api("GET", `/api/v1/heatmaps/${site.id}/pages`, { token: viewer.token })).body.pages).toHaveLength(1);
    expect((await api("GET", `/api/v1/heatmaps/${site.id}/data`, { token: viewer.token, query: { page_path: "/" } })).body.points).toHaveLength(1);
  });

  it("rejects malformed queries", async () => {
    const { owner, site } = await siteWithOwner();
    const bad: [string, Record<string, string | number>][] = [
      ["data", {}],
      ["data", { page_path: "/", event_type: "hover" }],
      ["data", { page_path: "/", days: 0 }],
      ["data", { page_path: "/", days: 400 }],
      ["pages", { days: "week" }],
      ["layout-snapshot", { page_path: "/", device: "watch" }],
    ];
    for (const [route, query] of bad) {
      const res = await api("GET", `/api/v1/heatmaps/${site.id}/${route}`, { token: owner.token, query });
      expect({ route, query, status: res.status }).toEqual({ route, query, status: 400 });
    }
  });
});

describe("DOM snapshots and page versions", () => {
  it("stores a tracker DOM snapshot in the heatmap bucket and serves it as the page's layout", async () => {
    const { owner, site } = await siteWithOwner();
    await ingestSnapshot(site, domSnapshot(site, "/landing"), async () =>
      (await sql`SELECT 1 FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid AND page_path = '/landing'`).length === 1);

    const [row] = await sql<{ html_s3_key: string; source_path: string; doc_height: number }[]>`
      SELECT html_s3_key, source_path, doc_height FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`;
    expect(await objectExists(buckets.heatmaps(), row!.html_s3_key)).toBe(true);
    expect(await objectExists(buckets.replays(), row!.html_s3_key)).toBe(false);
    // The query string is where tokens turn up: only the path is kept.
    expect(row!.source_path).toBe("/landing");
    expect(row!.doc_height).toBe(2400);

    const res = await api("GET", `/api/v1/heatmaps/${site.id}/layout-snapshot`, { token: owner.token, query: { page_path: "/landing" } });
    expect(res.status).toBe(200);
    expect(res.body.layout).toMatchObject({ doc_width: 1280, doc_height: 2400, device_type: "desktop", device_fallback: false });
    expect(res.body.layout.html_url).toContain(row!.html_s3_key);
  });

  it("records a version per page_version and keeps each version's own copy", async () => {
    const { site } = await siteWithOwner();
    const versions = () => sql<{ dom_fingerprint: string; html_s3_key: string }[]>`
      SELECT dom_fingerprint, html_s3_key FROM heatmap_page_versions WHERE website_id = ${site.id}::uuid ORDER BY dom_fingerprint`;
    await ingestSnapshot(site, domSnapshot(site, "/p", { version: "v1" }), async () => (await versions()).length === 1);
    await ingestSnapshot(site, domSnapshot(site, "/p", { version: "v2" }), async () => (await versions()).length === 2);

    const rows = await versions();
    expect(rows.map((r) => r.dom_fingerprint)).toEqual(["v1", "v2"]);
    expect(rows[0]!.html_s3_key).not.toBe(rows[1]!.html_s3_key);
    for (const r of rows) expect(await objectExists(buckets.heatmaps(), r.html_s3_key)).toBe(true);
    const [canonical] = await sql<{ html_s3_key: string }[]>`SELECT html_s3_key FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`;
    expect(canonical!.html_s3_key).toBe(rows[1]!.html_s3_key);
  });

  it("ignores a snapshot from a visitor without consent on a cookieless site", async () => {
    const { site } = await siteWithOwner();
    await collect(site, { consent: false, heatmap_dom_snapshot: [domSnapshot(site, "/private")] });
    await flushIngest();
    expect(await sql`SELECT 1 FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });
});

describe("POST /api/v1/heatmaps/:website_id/save-screenshot", () => {
  it("stores the dashboard's screenshot in the heatmap bucket and points the page at it", async () => {
    const { owner, site } = await siteWithOwner();
    const res = await api("POST", `/api/v1/heatmaps/${site.id}/save-screenshot`, {
      token: owner.token,
      body: { page_path: "/shot/", image: jpegBase64(), doc_width: 1440, doc_height: 3000 },
    });

    expect(res.status).toBe(200);
    const [row] = await sql<{ page_path: string; s3_key: string; doc_width: number; doc_height: number }[]>`
      SELECT page_path, s3_key, doc_width, doc_height FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`;
    expect(row).toMatchObject({ page_path: "/shot", doc_width: 1440, doc_height: 3000 });
    expect(row!.s3_key).toStartWith(`heatmap-screenshots/${site.id}/`);
    expect(await objectExists(buckets.heatmaps(), row!.s3_key)).toBe(true);
    expect(await objectExists(buckets.replays(), row!.s3_key)).toBe(false);
  });

  it("falls back to a default size when the dimensions are not numbers", async () => {
    const { owner, site } = await siteWithOwner();
    await api("POST", `/api/v1/heatmaps/${site.id}/save-screenshot`, {
      token: owner.token,
      body: { page_path: "/", image: jpegBase64(), doc_width: "wide", doc_height: 10 },
    });
    const [row] = await sql`SELECT doc_width, doc_height FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`;
    expect(row).toMatchObject({ doc_width: 1280, doc_height: 800 });
  });

  it("rejects a missing field, a non-JPEG, a too-small image and invalid JSON", async () => {
    const { owner, site } = await siteWithOwner();
    const post = (body: unknown) => api("POST", `/api/v1/heatmaps/${site.id}/save-screenshot`, { token: owner.token, body });
    expect((await post({ image: jpegBase64() })).status).toBe(400);
    expect((await post({ page_path: "/" })).status).toBe(400);
    expect((await post({ page_path: "/", image: Buffer.alloc(600, 1).toString("base64") })).status).toBe(400);
    expect((await post({ page_path: "/", image: Buffer.from([0xff, 0xd8, 0xff]).toString("base64") })).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect(await sql`SELECT 1 FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("is refused to a viewer, a stranger and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    const viewer = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const body = { page_path: "/", image: jpegBase64() };
    expect((await api("POST", `/api/v1/heatmaps/${site.id}/save-screenshot`, { token: viewer.token, body })).status).toBe(403);
    expect((await api("POST", `/api/v1/heatmaps/${site.id}/save-screenshot`, { token: stranger.token, body })).status).toBe(403);
    expect((await api("POST", `/api/v1/heatmaps/${site.id}/save-screenshot`, { body })).status).toBe(401);
    expect(await sql`SELECT 1 FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });
});

describe("DELETE /api/v1/heatmaps/:website_id/bulk-delete", () => {
  /** A page with points, a screenshot, a canonical HTML snapshot and a version — all in the heatmap bucket. */
  async function pageWithEverything(site: SeededWebsite, path: string) {
    await ingestPoints(site, [click(site, path, 0.5, 0.5)], (await pointTotal(site)) + 1);
    const shot = `heatmap-screenshots/${site.id}/${randomUUID()}.jpg`;
    const html = `heatmap-screenshots/${site.id}/${randomUUID()}.html`;
    const variant = `heatmap-screenshots/${site.id}/${randomUUID()}_v.html`;
    for (const key of [shot, html, variant]) await putObject(buckets.heatmaps(), key);
    await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, device_type)
              VALUES (${site.id}::uuid, ${path}, ${shot}, ${html}, 'sha', 1280, 2000, 'desktop')`;
    await sql`INSERT INTO heatmap_page_versions (website_id, page_path, dom_fingerprint, device_type, viewport_width, viewport_height, html_s3_key, content_sha256)
              VALUES (${site.id}::uuid, ${path}, 'fp1', 'desktop', 1280, 800, ${variant}, 'sha')`;
    return [shot, html, variant];
  }

  it("removes the pages' points, snapshot and version rows and their objects, and leaves other pages", async () => {
    const { owner, site } = await siteWithOwner();
    const goneKeys = await pageWithEverything(site, "/gone");
    const keptKeys = await pageWithEverything(site, "/kept");

    const res = await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { token: owner.token, body: { pagePaths: ["/gone"] } });

    expect(res.status).toBe(204);
    const paths = async (table: string) =>
      (await sql.unsafe(`SELECT DISTINCT page_path FROM ${table} WHERE website_id = $1::uuid ORDER BY 1`, [site.id])).map((r) => r.page_path);
    expect(await paths("heatmap_points")).toEqual(["/kept"]);
    expect(await paths("heatmap_page_snapshots")).toEqual(["/kept"]);
    expect(await paths("heatmap_page_versions")).toEqual(["/kept"]);
    for (const key of goneKeys) expect({ key, exists: await objectExists(buckets.heatmaps(), key) }).toEqual({ key, exists: false });
    for (const key of keptKeys) expect({ key, exists: await objectExists(buckets.heatmaps(), key) }).toEqual({ key, exists: true });
  });

  // The points delete matches the paths as sent, while the snapshot delete normalises them first,
  // so "/gone/" (or "/orders/123456") removes the background but leaves every click.
  it("deleting a page by an un-normalised path removes its points as well as its snapshots", async () => {
    const { owner, site } = await siteWithOwner();
    await pageWithEverything(site, "/gone");

    const res = await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { token: owner.token, body: { pagePaths: ["/gone/"] } });

    expect(res.status).toBe(204);
    expect(await sql`SELECT 1 FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
    expect(await pointTotal(site)).toBe(0);
  });

  it("lets a member delete but not a viewer", async () => {
    const { site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5)], 1);
    const viewer = await seedUser();
    const member = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    await addMember(site.id, member.id, "member");

    expect((await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { token: viewer.token, body: { pagePaths: ["/"] } })).status).toBe(403);
    expect(await pointTotal(site)).toBe(1);
    expect((await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { token: member.token, body: { pagePaths: ["/"] } })).status).toBe(204);
    expect(await pointTotal(site)).toBe(0);
  });

  it("refuses a stranger and an anonymous caller", async () => {
    const { site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5)], 1);
    const stranger = await seedUser();
    expect((await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { token: stranger.token, body: { pagePaths: ["/"] } })).status).toBe(403);
    expect((await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { body: { pagePaths: ["/"] } })).status).toBe(401);
    expect(await pointTotal(site)).toBe(1);
  });

  it("rejects an empty or malformed list", async () => {
    const { owner, site } = await siteWithOwner();
    for (const body of [{}, { pagePaths: [] }, { pagePaths: [""] }, { pagePaths: "/" }, { pagePaths: Array.from({ length: 501 }, (_, i) => `/p${i}`) }]) {
      expect((await api("DELETE", `/api/v1/heatmaps/${site.id}/bulk-delete`, { token: owner.token, body })).status).toBe(400);
    }
  });
});

describe("heatmap retention", () => {
  const purge = (site: SeededWebsite, cutoff: Date) =>
    application().modules.heatmaps.retention.purge(
      { websiteId: site.id },
      { analytics: cutoff, funnelAutomation: cutoff, replay: cutoff, heatmap: cutoff },
      { batchSize: 100, bucket: buckets.replays(), heatmapBucket: buckets.heatmaps() } as never,
    );

  it("ages out old points, snapshots and versions with their objects, but keeps the version the current snapshot shows", async () => {
    const { site } = await siteWithOwner();
    await ingestPoints(site, [click(site, "/", 0.5, 0.5), click(site, "/", 0.1, 0.1)], 2);
    await sql`UPDATE heatmap_points SET day = current_date - 100 WHERE website_id = ${site.id}::uuid AND x_percent = 1000`;

    const k = (n: string) => `heatmap-screenshots/${site.id}/${n}-${randomUUID()}.html`;
    const current = k("current"), oldVariant = k("old"), recentVariant = k("recent"), oldShot = k("oldshot"), oldShotHtml = k("oldshothtml");
    for (const key of [current, oldVariant, recentVariant, oldShot, oldShotHtml]) await putObject(buckets.heatmaps(), key);
    // A fresh canonical snapshot that points at a version last seen long ago.
    await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, device_type)
              VALUES (${site.id}::uuid, '/', '', ${current}, 'sha', 1280, 2000, 'desktop')`;
    await sql`INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, html_s3_key, content_sha256, doc_width, doc_height, device_type, updated_at)
              VALUES (${site.id}::uuid, '/old', ${oldShot}, ${oldShotHtml}, 'sha', 1280, 2000, 'desktop', now() - interval '100 days')`;
    const version = (fp: string, key: string, age: string) => sql`
      INSERT INTO heatmap_page_versions (website_id, page_path, dom_fingerprint, device_type, viewport_width, viewport_height, html_s3_key, content_sha256, last_seen_at)
      VALUES (${site.id}::uuid, '/', ${fp}, 'desktop', 1280, 800, ${key}, 'sha', now() - ${age}::interval)`;
    await version("current", current, "100 days");
    await version("old", oldVariant, "100 days");
    await version("recent", recentVariant, "1 day");

    const result = await purge(site, new Date(Date.now() - 30 * 86_400_000));

    expect(result).toMatchObject({ heatmapPointRows: 1, heatmapSnapshotRows: 1, heatmapVersionRows: 1 });
    expect(await pointTotal(site)).toBe(1);
    const versions = await sql<{ dom_fingerprint: string }[]>`
      SELECT dom_fingerprint FROM heatmap_page_versions WHERE website_id = ${site.id}::uuid ORDER BY 1`;
    expect(versions.map((v) => v.dom_fingerprint)).toEqual(["current", "recent"]);
    const snaps = await sql<{ page_path: string }[]>`SELECT page_path FROM heatmap_page_snapshots WHERE website_id = ${site.id}::uuid`;
    expect(snaps.map((s) => s.page_path)).toEqual(["/"]);
    for (const key of [current, recentVariant]) expect({ key, exists: await objectExists(buckets.heatmaps(), key) }).toEqual({ key, exists: true });
    for (const key of [oldVariant, oldShot, oldShotHtml]) expect({ key, exists: await objectExists(buckets.heatmaps(), key) }).toEqual({ key, exists: false });
  });

  it("leaves other sites' heatmaps alone", async () => {
    const a = await siteWithOwner();
    const b = await siteWithOwner();
    await ingestPoints(b.site, [click(b.site, "/", 0.5, 0.5)], 1);
    await sql`UPDATE heatmap_points SET day = current_date - 100 WHERE website_id = ${b.site.id}::uuid`;
    await purge(a.site, new Date(Date.now() - 30 * 86_400_000));
    expect(await pointTotal(b.site)).toBe(1);
    expect(await listKeys(buckets.heatmaps(), `heatmap-screenshots/${a.site.id}/`)).toEqual([]);
  });
});
