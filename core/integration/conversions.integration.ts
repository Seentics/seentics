import { describe, expect, it } from "bun:test";
import { env } from "../config";
import { api, application, seedUser, seedWebsite, sql, type SeededWebsite } from "./harness";
import { collect, siteHeaders } from "./helpers/ingest";
import { submit } from "./helpers/leads";
import { BatchWorker } from "../modules/ingest/services/batch-worker.service";
import { postgresBatchQueue } from "../modules/ingest/repositories/postgres-batch-queue";
import type { IngestFlusher } from "../modules/ingest/interfaces";
import type { HttpRequest, ProviderContext } from "../modules/integrations/interfaces";
import { resolveVault } from "../modules/integrations/lib/vault";
import { claimDueConversions } from "../modules/integrations/repositories/conversion.repository";
import { ConversionAdminService } from "../modules/integrations/services/conversion-admin.service";
import { ConversionAttemptService } from "../modules/integrations/services/conversion-attempt.service";
import { log } from "../platform/observability/logger";

/** A platform that answers from a script, and remembers every request. */
function platform(answer: (req: HttpRequest) => { status: number; text?: string } = () => ({ status: 200, text: "{}" })) {
  const calls: HttpRequest[] = [];
  const ctx: ProviderContext = {
    async request(req) { calls.push(req); const a = answer(req); return { status: a.status, text: a.text ?? "" }; },
    async assertPublicUrl() {},
  };
  return { ctx, calls };
}

const META_OK = (req: HttpRequest) => (req.method === "GET" ? { status: 200, text: '{"id":"1234567890","name":"Shoe Shop"}' } : { status: 200, text: '{"events_received":1}' });

async function setup() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

async function connectMeta(websiteId: string, config?: Record<string, unknown>) {
  const admin = new ConversionAdminService(resolveVault(env()), platform(META_OK).ctx, () => {});
  const out = await admin.create(websiteId, { platform: "meta", credentials: { pixel_id: "1234567890", access_token: "EAAB" + "x".repeat(40) }, config });
  if (!("destination" in out) || !out.destination) throw new Error(`connect failed: ${JSON.stringify(out)}`);
  return out.destination;
}

let worker: BatchWorker | null = null;
/** What the ingest worker does on its timer, for the conversions lane only. */
async function drainConversions(websiteId: string) {
  const app = application();
  await (app.modules.ingest.queue as unknown as IngestFlusher).flushNow();
  worker ??= new BatchWorker(postgresBatchQueue, { conversions: app.modules.integrations.conversions.lane } as never, log);
  for (let i = 0; i < 100; i++) {
    await worker.drainOnce();
    const [row] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ingest_batches
      WHERE category = 'conversions' AND partition_key = ${websiteId} AND completed_at IS NULL`;
    if (!row?.n) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("conversion batches still pending");
}

const queued = (websiteId: string) => sql<{
  event_id: string; kind: string; platform_event: string; status: string; match_keys: string[]; value: string | null;
  currency: string | null; order_id: string | null; payload: Record<string, unknown> | null; visitor_id: string | null;
}[]>`SELECT event_id, kind, platform_event, status, match_keys, value, currency, order_id, payload, visitor_id
     FROM conversion_events WHERE website_id = ${websiteId}::uuid ORDER BY created_at, event_id`;

async function purchase(site: SeededWebsite, opts: { consent?: boolean; order?: string; extra?: Record<string, unknown> } = {}) {
  const res = await collect(site, {
    consent: opts.consent ?? true,
    batch_id: `b-${opts.order ?? "x"}-${Math.random()}`,
    ad: { clk: { fbclid: { v: "IwAR3abc", ts: Date.now() - 60_000 } }, fbp: "fb.1.1700000000000.123456789" },
    events: [
      { type: "pageview", url: `https://${site.domain}/`, sid: "s1", vid: "v-buyer", ts: Date.now() - 5000, data: {} },
      { type: "custom", url: `https://${site.domain}/thanks`, sid: "s1", vid: "v-buyer", ts: Date.now(),
        data: { name: "purchase", value: 40, currency: "usd", order_id: opts.order ?? "1042", email: "Buyer@Example.com", ...(opts.extra ?? {}) } },
    ],
  }, { headers: { "X-Forwarded-For": "203.0.113.9" } });
  expect(res.status).toBeLessThan(300);
}

describe("a consented purchase", () => {
  it("is queued for each destination with hashed contact details, the click and the order id — and kept out of analytics", async () => {
    const { site } = await setup();
    const meta = await connectMeta(site.id);
    await purchase(site);
    await drainConversions(site.id);

    const rows = await queued(site.id);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).toMatchObject({ event_id: "1042", kind: "purchase", platform_event: "Purchase", status: "pending", currency: "USD", order_id: "1042", visitor_id: "v-buyer" });
    expect(Number(row.value)).toBe(40);
    expect(row.match_keys).toEqual(expect.arrayContaining(["click_id", "email", "browser_id"]));
    expect(row.payload).toMatchObject({ fbc: expect.stringMatching(/^fb\.1\.\d+\.IwAR3abc$/), fbp: "fb.1.1700000000000.123456789" });
    // The address is hashed before it is stored, anywhere.
    expect(JSON.stringify(row)).not.toContain("buyer@example.com");
    expect(JSON.stringify(row)).not.toContain("Buyer@Example.com");
    expect(row.payload!.email_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.config.events.purchase).toBe("Purchase");
  });

  it("is queued once, however many times the same order arrives", async () => {
    const { site } = await setup();
    await connectMeta(site.id);
    await purchase(site, { order: "A-1" });
    await purchase(site, { order: "A-1" });
    await drainConversions(site.id);
    expect(await queued(site.id)).toHaveLength(1);
  });

  it("is never queued for an anonymous visitor", async () => {
    const { site } = await setup();
    await connectMeta(site.id);
    // In the consent region without consent: the batch is anonymised, and nothing is forwarded.
    const res = await collect(site, {
      consent: false,
      events: [{ type: "custom", url: `https://${site.domain}/thanks`, sid: "s1", vid: "anon", ts: Date.now(), data: { name: "purchase", value: 9, order_id: "N-1" } }],
    }, { headers: { ...siteHeaders(site), "CF-IPCountry": "DE" } });
    expect(res.status).toBeLessThan(300);
    await drainConversions(site.id);
    expect(await queued(site.id)).toHaveLength(0);
  });

  it("sends only what a destination maps: custom events by name", async () => {
    const { site } = await setup();
    await connectMeta(site.id, { custom: [{ name: "checkout_started", platform_event: "InitiateCheckout" }], events: { purchase: null } });
    await collect(site, {
      consent: true,
      events: [
        { type: "custom", url: "/", sid: "s", vid: "v", ts: Date.now(), data: { name: "checkout_started" } },
        { type: "custom", url: "/", sid: "s", vid: "v", ts: Date.now(), data: { name: "add_to_cart" } },
        { type: "custom", url: "/", sid: "s", vid: "v", ts: Date.now(), data: { name: "purchase", order_id: "P-9" } },
      ],
    });
    await drainConversions(site.id);
    expect((await queued(site.id)).map((r) => r.platform_event)).toEqual(["InitiateCheckout"]);
  });
});

describe("sending", () => {
  it("delivers to Meta, clears the payload, and counts it on the destination", async () => {
    const { owner, site } = await setup();
    const meta = await connectMeta(site.id);
    await purchase(site, { order: "S-1" });
    await drainConversions(site.id);

    const { ctx, calls } = platform(META_OK);
    const attempts = new ConversionAttemptService(resolveVault(env()), ctx);
    for (const c of (await claimDueConversions(50)).filter((c) => c.website_id === site.id)) await attempts.run(c);

    const sent = calls.find((c) => c.method === "POST")!;
    expect(sent.url).toEndWith("/1234567890/events");
    const body = JSON.parse(sent.body!);
    expect(body.data[0]).toMatchObject({ event_name: "Purchase", event_id: "S-1", action_source: "website", custom_data: { value: 40, currency: "USD" } });
    expect(body.data[0].user_data.client_ip_address).toBeTruthy();
    const [row] = await queued(site.id);
    expect(row).toMatchObject({ status: "success", payload: null });

    const list = await api("GET", `/api/v1/conversions/${site.id}/destinations`, { token: owner.token });
    expect(list.body.data[0]).toMatchObject({ id: meta.id, stats: { sent_7d: 1, failed_7d: 0 }, credentials_hint: "Shoe Shop · Pixel 1234567890" });
    // The secret never leaves the server.
    expect(JSON.stringify(list.body)).not.toContain("EAAB");
    const summary = await api("GET", `/api/v1/conversions/${site.id}/summary`, { token: owner.token, query: { days: 7 } });
    expect(summary.body.data.totals).toMatchObject({ sent: 1, accepted: 1, failed: 0 });
    expect(summary.body.data.match.email).toBe(1);
  });

  it("switches a destination off when Meta refuses the token, and a failed event can be retried", async () => {
    const { owner, site } = await setup();
    await connectMeta(site.id);
    await purchase(site, { order: "F-1" });
    await drainConversions(site.id);

    const refused = platform(() => ({ status: 400, text: '{"error":{"message":"Invalid OAuth access token.","code":190}}' }));
    const attempts = new ConversionAttemptService(resolveVault(env()), refused.ctx);
    for (const c of (await claimDueConversions(50)).filter((c) => c.website_id === site.id)) await attempts.run(c);

    const events = await api("GET", `/api/v1/conversions/${site.id}/events`, { token: owner.token, query: { status: "failed" } });
    expect(events.body.data.events[0]).toMatchObject({ status: "failed", error: "Invalid OAuth access token.", platform: "meta" });
    const [d] = await sql<{ enabled: boolean; status: string }[]>`SELECT enabled, status FROM conversion_destinations WHERE website_id = ${site.id}::uuid`;
    expect(d).toEqual({ enabled: false, status: "error" });

    const retry = await api("POST", `/api/v1/conversions/${site.id}/events/${events.body.data.events[0].id}/retry`, { token: owner.token });
    expect(retry.status).toBe(200);
    expect((await queued(site.id))[0]!.status).toBe("pending");
  });
});

describe("TikTok and LinkedIn", () => {
  const TIKTOK_OK = () => ({ status: 200, text: '{"code":0,"message":"OK"}' });
  const LINKEDIN_OK = (req: HttpRequest) => (req.method === "GET" ? { status: 200, text: '{"elements":[{"id":104000123}]}' } : { status: 201 });

  it("each get the purchase with their own click and browser ids, and deliver it", async () => {
    const { site } = await setup();
    const tiktokAdmin = new ConversionAdminService(resolveVault(env()), platform(TIKTOK_OK).ctx, () => {});
    const tiktok = await tiktokAdmin.create(site.id, { platform: "tiktok", credentials: { pixel_code: "c4abcd1234efgh5678", access_token: "t".repeat(40) } });
    expect(tiktok).toMatchObject({ destination: { platform: "tiktok", name: "TikTok", credentials_hint: "Pixel C4AB…5678", config: { events: { purchase: "CompletePayment" } } } });
    const linkedinAdmin = new ConversionAdminService(resolveVault(env()), platform(LINKEDIN_OK).ctx, () => {});
    const linkedin = await linkedinAdmin.create(site.id, {
      platform: "linkedin", credentials: { ad_account_id: "512345678", access_token: "l".repeat(40) }, config: { events: { purchase: "104000123", lead: null, sign_up: null } },
    });
    expect(linkedin).toMatchObject({ destination: { platform: "linkedin", credentials_hint: "Ad account 512345678" } });

    const res = await collect(site, {
      consent: true,
      batch_id: `b-tl-${Math.random()}`,
      ad: { clk: { ttclid: { v: "E.C.P.tiktokclick", ts: Date.now() - 60_000 }, li_fat_id: { v: "3f2c1a9e-li-click", ts: Date.now() - 60_000 } }, ttp: "2XyTtpBrowser01" },
      events: [{ type: "custom", url: `https://${site.domain}/thanks`, sid: "s1", vid: "v-buyer", ts: Date.now(),
        data: { name: "purchase", value: 25, currency: "eur", order_id: "TL-1", email: "Buyer@Example.com" } }],
    }, { headers: { "X-Forwarded-For": "203.0.113.9" } });
    expect(res.status).toBeLessThan(300);
    await drainConversions(site.id);

    const rows = await queued(site.id);
    expect(rows.map((r) => r.platform_event).sort()).toEqual(["104000123", "CompletePayment"]);
    const tt = rows.find((r) => r.platform_event === "CompletePayment")!;
    expect(tt.payload).toMatchObject({ ttclid: "E.C.P.tiktokclick", ttp: "2XyTtpBrowser01", li_fat_id: null, fbc: null });
    expect(tt.match_keys).toEqual(["click_id", "email", "ip_ua", "browser_id"]);
    const li = rows.find((r) => r.platform_event === "104000123")!;
    expect(li.payload).toMatchObject({ li_fat_id: "3f2c1a9e-li-click", ttclid: null });
    expect(li.match_keys).toEqual(["click_id", "email"]);

    const answers = platform((req) => (req.url.includes("tiktok") || req.url.includes("/event/track/") ? TIKTOK_OK() : LINKEDIN_OK(req)));
    const attempts = new ConversionAttemptService(resolveVault(env()), answers.ctx);
    for (const c of (await claimDueConversions(50)).filter((c) => c.website_id === site.id)) await attempts.run(c);

    const toTiktok = JSON.parse(answers.calls.find((c) => c.url.endsWith("/event/track/"))!.body!);
    expect(toTiktok).toMatchObject({ event_source: "web", event_source_id: "C4ABCD1234EFGH5678" });
    expect(toTiktok.data[0]).toMatchObject({ event: "CompletePayment", event_id: "TL-1", user: { ttclid: "E.C.P.tiktokclick", ttp: "2XyTtpBrowser01" }, properties: { value: 25, currency: "EUR" } });
    const toLinkedin = JSON.parse(answers.calls.find((c) => c.url.endsWith("/conversionEvents"))!.body!);
    expect(toLinkedin).toMatchObject({ conversion: "urn:lla:llaPartnerConversion:104000123", eventId: "TL-1", conversionValue: { currencyCode: "EUR", amount: "25.00" } });
    expect(toLinkedin.user.userIds).toContainEqual({ idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: "3f2c1a9e-li-click" });
    expect((await queued(site.id)).map((r) => r.status)).toEqual(["success", "success"]);
  });
});

describe("a popup lead", () => {
  it("is forwarded only when the visitor ticked consent, with their email and phone hashed", async () => {
    const { site } = await setup();
    await connectMeta(site.id);
    await submit({ website_id: site.id, email: "Lead@Example.com", phone: "+880 1700-000000", consent: true, anonymous_id: "v-lead", page_url: `https://${site.domain}/` },
      { Origin: `https://${site.domain}` });
    await submit({ website_id: site.id, email: "nope@example.com", consent: false, page_url: `https://${site.domain}/` }, { Origin: `https://${site.domain}` });

    const rows = await queued(site.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "lead", platform_event: "Lead", visitor_id: "v-lead" });
    expect(rows[0]!.event_id).toMatch(/^lead:/);
    expect(rows[0]!.match_keys).toEqual(expect.arrayContaining(["email", "phone"]));
    expect(JSON.stringify(rows[0])).not.toContain("lead@example.com");
  });
});

describe("the dashboard API", () => {
  it("lets viewers read, members change, and refuses bad input", async () => {
    const { owner, site } = await setup();
    const meta = await connectMeta(site.id);
    const viewer = await seedUser();
    await sql`INSERT INTO website_members (website_id, user_id, role) VALUES (${site.id}::uuid, ${viewer.id}::uuid, 'viewer')`;

    expect((await api("GET", `/api/v1/conversions/${site.id}/destinations`, { token: viewer.token })).status).toBe(200);
    expect((await api("PATCH", `/api/v1/conversions/${site.id}/destinations/${meta.id}`, { token: viewer.token, body: { enabled: false } })).status).toBe(403);
    const off = await api("PATCH", `/api/v1/conversions/${site.id}/destinations/${meta.id}`, { token: owner.token, body: { enabled: false, config: { custom: [{ name: "x", platform_event: "Y" }] } } });
    expect(off.body.data).toMatchObject({ enabled: false, config: { custom: [{ name: "x", platform_event: "Y" }], events: { purchase: "Purchase" } } });
    expect((await api("POST", `/api/v1/conversions/${site.id}/destinations`, { token: owner.token, body: { platform: "tiktok", credentials: {} } })).status).toBe(400);
    expect((await api("GET", `/api/v1/conversions/${site.id}/events`, { token: owner.token, query: { status: "lost" } })).status).toBe(400);
    expect((await api("DELETE", `/api/v1/conversions/${site.id}/destinations/${meta.id}`, { token: owner.token })).status).toBe(200);
    expect(await sql`SELECT 1 FROM conversion_destinations WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });
});

describe("a visitor's data request", () => {
  it("exports and erases what was queued on their behalf", async () => {
    const { owner, site } = await setup();
    await connectMeta(site.id);
    await purchase(site, { order: "G-1" });
    await drainConversions(site.id);
    const exported = await api("GET", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { visitor_id: "v-buyer" } });
    expect(exported.body.data.conversions).toEqual([expect.objectContaining({ kind: "purchase", order_id: "G-1" })]);
    await api("DELETE", `/api/v1/privacy/visitor/${site.id}`, { token: owner.token, query: { visitor_id: "v-buyer" } });
    expect(await queued(site.id)).toHaveLength(0);
  });
});
