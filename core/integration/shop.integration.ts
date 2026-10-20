import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { env } from "../config";
import { api, seedUser, sql } from "./harness";
import { collect } from "./helpers/ingest";
import type { HttpRequest, ProviderContext } from "../modules/integrations/interfaces";
import { resolveVault } from "../modules/integrations/lib/vault";
import { claimDueConversions } from "../modules/integrations/repositories/conversion.repository";
import { ConversionAdminService } from "../modules/integrations/services/conversion-admin.service";
import { ConversionAttemptService } from "../modules/integrations/services/conversion-attempt.service";

/**
 * The shop end to end (docs/shop.md): a store and its website, a page published and served,
 * orders from the public form priced on the server, risk labels, and the verified Purchase
 * sent once the seller confirms.
 */

// The public routes answer the gateway only, which sends the service key.
process.env.GLOBAL_API_KEY = "integration-global-key-0123456789abcdef";
const KEY = { "X-API-Key": process.env.GLOBAL_API_KEY };

const META_OK = (req: HttpRequest) => (req.method === "GET" ? { status: 200, text: '{"id":"1234567890","name":"Shop"}' } : { status: 200, text: '{"events_received":1}' });
function platform(answer = META_OK) {
  const calls: HttpRequest[] = [];
  const ctx: ProviderContext = { async request(req) { calls.push(req); const a = answer(req); return { status: a.status, text: a.text ?? "" }; }, async assertPublicUrl() {} };
  return { ctx, calls };
}

const uniq = () => Math.random().toString(36).slice(2, 8);

async function setup(trigger: "placed" | "confirmed" | "delivered" = "confirmed") {
  const owner = await seedUser();
  const slug = `store-${uniq()}`;
  const created = await api("POST", "/api/v1/shop/stores", { token: owner.token, body: { name: "Rupa Fashion", slug } });
  expect(created.status).toBe(201);
  const websiteId = created.body.data.websiteId as string;
  await api("PUT", `/api/v1/shop/${websiteId}/store`, { token: owner.token, body: { phone: "01711000000", deliveryInsideDhaka: 60, deliveryOutsideDhaka: 120, purchaseEventOn: trigger } });
  const page = await api("POST", `/api/v1/shop/${websiteId}/pages`, {
    token: owner.token,
    body: { slug: "saree", title: "জামদানি শাড়ি", productName: "Jamdani Saree", price: 1450, comparePrice: 2000, maxQuantity: 3, options: { label: "রং", values: ["লাল", "নীল"] } },
  });
  expect(page.status).toBe(201);
  return { owner, slug, websiteId, page: page.body.data };
}

const order = (pageId: string, extra: Record<string, unknown> = {}) =>
  api("POST", "/api/v1/shop/public/orders", {
    headers: { ...KEY, "User-Agent": "Mozilla/5.0 (Linux; Android 13) FBAN/FB4A", "X-Forwarded-For": "103.4.5.6", "x-seentics-peer-ip": "103.4.5.6" },
    body: { pageId, name: "রহিম উদ্দিন", phone: "+880 1812-345678", address: "বাসা ১২, রোড ৫, মিরপুর ১০, ঢাকা", area: "outside_dhaka", quantity: 2,
      option: "লাল", total: 1, anonymous_id: "v-buyer", session_id: "s-buyer",
      ad: { clk: { fbclid: { v: "IwAR3abc", ts: Date.now() - 60_000 } }, fbp: "fb.1.1700000000000.123456789" }, ...extra },
  });

describe("shop", () => {
  it("a store is a website on the shop host, and its slug is its own", async () => {
    const { owner, slug, websiteId } = await setup();
    const [site] = await sql<{ url: string; user_id: string }[]>`SELECT url, user_id::text FROM websites WHERE id = ${websiteId}::uuid`;
    expect(site).toMatchObject({ url: env().shop.host, user_id: owner.id });
    const again = await api("POST", "/api/v1/shop/stores", { token: owner.token, body: { name: "Copy", slug } });
    expect(again.status).toBe(409);
    expect(await api("POST", "/api/v1/shop/stores", { token: owner.token, body: { name: "Bad", slug: "api" } })).toMatchObject({ status: 400 });
    const store = await api("GET", `/api/v1/shop/${websiteId}/store`, { token: owner.token });
    expect(store.body.data).toMatchObject({ slug, url: `${env().shop.publicUrl}/${slug}`, phone: "01711000000", steadfastConnected: false });
  });

  it("only members of the store's website see it", async () => {
    const { websiteId } = await setup();
    const stranger = await seedUser();
    expect((await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: stranger.token })).status).toBe(403);
    expect((await api("GET", `/api/v1/shop/${websiteId}/orders`)).status).toBe(401);
  });

  it("serves published pages to the gateway only, escaped and with the store's tracker", async () => {
    const { owner, slug, websiteId, page } = await setup();
    const path = `/api/v1/shop/public/pages/${slug}/saree`;
    expect((await api("GET", path)).status).toBe(401);
    expect((await api("GET", path, { headers: KEY })).status).toBe(404); // still a draft
    await api("POST", `/api/v1/shop/${websiteId}/pages/${page.id}/publish`, { token: owner.token });
    const res = await api("GET", path, { headers: KEY });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.text).toContain("জামদানি শাড়ি");
    expect(res.text).toContain(`data-website-id="${websiteId}"`);
    const list = await api("GET", `/api/v1/shop/public/stores/${slug}`, { headers: KEY });
    expect(list.text).toContain(`/${slug}/saree`);
  });

  it("the tracker on a shop page is accepted for the store's website", async () => {
    const { websiteId } = await setup();
    const [site] = await sql<{ tracking_id: string }[]>`SELECT tracking_id FROM websites WHERE id = ${websiteId}::uuid`;
    const res = await collect({ id: websiteId, trackingId: site?.tracking_id ?? websiteId, domain: env().shop.host, ownerId: "" }, {
      events: [{ type: "pageview", url: `https://${env().shop.host}/x/saree`, sid: "s1", vid: "v1", ts: Date.now(), data: {} }],
    });
    expect(res.status).toBeLessThan(300);
  });

  it("prices an order on the server, from the page; refuses drafts and bad numbers", async () => {
    const { owner, websiteId, page } = await setup();
    expect((await order(page.id)).body).toMatchObject({ ok: false, error: "not_found" });
    await api("POST", `/api/v1/shop/${websiteId}/pages/${page.id}/publish`, { token: owner.token });
    expect((await order(page.id, { phone: "12345" })).body).toMatchObject({ ok: false, error: "invalid_phone" });

    const placed = await order(page.id, { quantity: 9 });
    expect(placed.body).toMatchObject({ ok: true, orderNumber: "1001" });
    const list = await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: owner.token });
    const o = list.body.data.items[0];
    // 3 is the page's maximum; the browser's `total: 1` is ignored.
    expect(o).toMatchObject({ number: "1001", quantity: 3, unitPrice: 1450, deliveryCharge: 120, total: 4470, phone: "01812345678", option: "লাল", status: "new", sessionId: "s-buyer" });
    expect(o.risk.level).toBe("safe");
    expect(o).not.toHaveProperty("clientIp");

    // The same number again within the day: check first.
    const second = await order(page.id);
    expect(second.body.orderNumber).toBe("1002");
    const again = await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: owner.token, query: { q: "1002" } });
    expect(again.body.data.items[0].risk.reasons.map((r: { code: string }) => r.code)).toContain("duplicate_phone");
    expect(again.body.data.items[0].risk.level).not.toBe("safe");

    // A honeypot hit looks like success and stores nothing.
    expect((await order(page.id, { hp: "bot" })).body.ok).toBe(true);
    expect((await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: owner.token })).body.data.total).toBe(2);
  });

  it("sends one Purchase, in taka, when the seller confirms; nothing for a fake", async () => {
    const { owner, websiteId, page } = await setup("confirmed");
    const admin = new ConversionAdminService(resolveVault(env()), platform().ctx, () => {});
    await admin.create(websiteId, { platform: "meta", credentials: { pixel_id: "1234567890", access_token: "EAAB" + "x".repeat(40) } });
    await api("POST", `/api/v1/shop/${websiteId}/pages/${page.id}/publish`, { token: owner.token });
    await order(page.id);
    await order(page.id, { phone: "01911222333", address: "House 3, Road 2, Uttara, Dhaka" });
    const items = (await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: owner.token })).body.data.items as Array<{ id: string; number: string; conversion: { status: string } }>;
    const [fake, real] = items; // newest first
    expect(real!.conversion.status).toBe("not_sent");
    expect(await sql`SELECT 1 FROM conversion_events WHERE website_id = ${websiteId}::uuid`).toHaveLength(0);

    const confirmed = await api("PATCH", `/api/v1/shop/${websiteId}/orders/${real!.id}`, { token: owner.token, body: { status: "confirmed" } });
    expect(confirmed.body.data).toMatchObject({ status: "confirmed", conversion: { status: "queued", event: "Purchase" } });
    expect(confirmed.body.data.history.map((h: { status: string }) => h.status)).toEqual(["new", "confirmed"]);
    // Shipped and delivered later: still one Purchase.
    await api("PATCH", `/api/v1/shop/${websiteId}/orders/${real!.id}`, { token: owner.token, body: { status: "shipped" } });
    await api("PATCH", `/api/v1/shop/${websiteId}/orders/${real!.id}`, { token: owner.token, body: { status: "delivered" } });
    const rows = await sql<{ event_id: string; value: string; currency: string; payload: Record<string, unknown> }[]>`
      SELECT event_id, value, currency, payload FROM conversion_events WHERE website_id = ${websiteId}::uuid`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event_id: `order:${real!.id}`, currency: "BDT" });
    expect(Number(rows[0]!.value)).toBe(3020);
    expect(rows[0]!.payload.phone_sha256).toBe(createHash("sha256").update("8801812345678").digest("hex"));
    expect(rows[0]!.payload.fbp).toBe("fb.1.1700000000000.123456789");
    expect(rows[0]!.payload.ip).toBeTruthy();

    const marked = await api("PATCH", `/api/v1/shop/${websiteId}/orders/${fake!.id}`, { token: owner.token, body: { status: "fake" } });
    expect(marked.body.data.conversion.status).toBe("skipped");

    // Delivered to Meta: the order reads it back as sent.
    const sender = platform();
    const attempts = new ConversionAttemptService(resolveVault(env()), sender.ctx);
    for (const c of (await claimDueConversions(50)).filter((c) => c.website_id === websiteId)) await attempts.run(c);
    const body = JSON.parse(sender.calls.find((c) => c.method === "POST")!.body!);
    expect(body.data[0]).toMatchObject({ event_name: "Purchase", event_id: `order:${real!.id}`, custom_data: { value: 3020, currency: "BDT" } });
    const read = await api("GET", `/api/v1/shop/${websiteId}/orders/${real!.id}`, { token: owner.token });
    expect(read.body.data.conversion.status).toBe("sent");
  });

  it("the blacklist labels a number's open orders high at once", async () => {
    const { owner, websiteId, page } = await setup();
    await api("POST", `/api/v1/shop/${websiteId}/pages/${page.id}/publish`, { token: owner.token });
    await order(page.id, { phone: "01555666777" });
    const added = await api("POST", `/api/v1/shop/${websiteId}/blacklist`, { token: owner.token, body: { phone: "+8801555666777", reason: "ভুয়া" } });
    expect(added.body.data).toMatchObject({ phone: "01555666777" });
    const o = (await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: owner.token, query: { risk: "high" } })).body.data.items;
    expect(o).toHaveLength(1);
    expect(o[0].risk.reasons[0].code).toBe("blacklisted");
    const next = await order(page.id, { phone: "01555666777" });
    expect(next.body.ok).toBe(true);
    await api("DELETE", `/api/v1/shop/${websiteId}/blacklist/${added.body.data.id}`, { token: owner.token });
    expect((await api("GET", `/api/v1/shop/${websiteId}/orders`, { token: owner.token, query: { risk: "high" } })).body.data.total).toBe(0);
  });

  it("stores a real photo and serves it back; refuses anything else", async () => {
    const { owner, websiteId } = await setup();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const form = new FormData();
    form.set("file", new Blob([png], { type: "image/png" }), "a.png");
    const { createHttpApp } = await import("../app/http-app");
    const { application } = await import("./harness");
    const app = createHttpApp(env(), application(), () => true);
    const up = await app.request(`/api/v1/shop/${websiteId}/images`, { method: "POST", headers: { Authorization: `Bearer ${owner.token}` }, body: form });
    expect(up.status).toBe(201);
    const url = ((await up.json()) as { data: { url: string } }).data.url;
    expect(url).toMatch(/\/i\/[a-f0-9]{32}\.png$/);
    const id = url.split("/i/")[1]!;
    const got = await api("GET", `/api/v1/shop/public/images/${id}`, { headers: KEY });
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("image/png");

    const svg = new FormData();
    svg.set("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png");
    const bad = await app.request(`/api/v1/shop/${websiteId}/images`, { method: "POST", headers: { Authorization: `Bearer ${owner.token}` }, body: svg });
    expect(bad.status).toBe(400);
  });
});
