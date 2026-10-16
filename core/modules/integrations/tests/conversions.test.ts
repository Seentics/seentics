import { describe, expect, it } from "bun:test";
import type { HttpRequest, ProviderContext } from "../interfaces";
import type { ConversionPayload } from "../interfaces/conversions";
import { adContextOf } from "../lib/ad-context";
import {
  currencyOf, fbcOf, fbpOf, gaClientIdOf, hashEmail, hashPhone, kindOf, liFatIdOf, matchKeysFor, orderIdOf, platformEventFor, ttclidOf, ttpOf,
  valueOf, withDefaults,
} from "../lib/conversion-match";
import { ga4Body, ga4Provider } from "../providers/conversions/ga4";
import { linkedinEvent, linkedinProvider } from "../providers/conversions/linkedin";
import { metaEvent, metaProvider } from "../providers/conversions/meta";
import { tiktokEvent, tiktokProvider } from "../providers/conversions/tiktok";

/** A ProviderContext that answers from a script and records what was asked. */
function fakeCtx(answers: Array<{ status: number; text?: string }>) {
  const calls: HttpRequest[] = [];
  const ctx: ProviderContext = {
    async request(req) { calls.push(req); const a = answers.shift() ?? { status: 200 }; return { status: a.status, text: a.text ?? "" }; },
    async assertPublicUrl() {},
  };
  return { ctx, calls };
}

const payload = (over: Partial<ConversionPayload> = {}): ConversionPayload => ({
  event_id: "order:1042", platform_event: "Purchase", occurred_at: 1_792_000_000_000, url: "https://shop.test/thanks",
  value: 40, currency: "USD", order_id: "1042", email_sha256: "e".repeat(64), phone_sha256: null, external_id_sha256: "x".repeat(64),
  client_id: "123.456", ip: "203.0.113.9", user_agent: "Mozilla/5.0", fbc: "fb.1.1791999999000.IwAR3", fbp: "fb.1.1790000000000.987", ...over,
});

describe("what an event is, and what it is worth", () => {
  it("knows purchases, sign-ups and leads by name, and never forwards the popup's own lead_captured", () => {
    expect(kindOf("purchase")).toBe("purchase");
    expect(kindOf("Order_Completed")).toBe("purchase");
    expect(kindOf("signup")).toBe("sign_up");
    expect(kindOf("generate_lead")).toBe("lead");
    expect(kindOf("add_to_cart")).toBe("custom");
    expect(kindOf("lead_captured")).toBeNull();
    expect(kindOf("  ")).toBeNull();
  });

  it("reads the value the way the revenue dashboard does, and gives a value a currency", () => {
    expect(valueOf({ revenue: "19.999" })).toBe(20);
    expect(valueOf({ value: -5, total: 12 })).toBe(12);
    expect(valueOf({})).toBeNull();
    expect(currencyOf({ currency: "bdt" }, true)).toBe("BDT");
    expect(currencyOf({}, true)).toBe("USD");
    expect(currencyOf({}, false)).toBeNull();
    expect(orderIdOf({ transaction_id: 77 })).toBe("77");
  });

  it("maps each kind to the destination's event, custom ones by name only", () => {
    const meta = withDefaults("meta", { custom: [{ name: "checkout_started", platform_event: "InitiateCheckout" }] });
    expect(platformEventFor(meta, "purchase", "purchase")).toBe("Purchase");
    expect(platformEventFor(meta, "custom", "Checkout_Started")).toBe("InitiateCheckout");
    expect(platformEventFor(meta, "custom", "add_to_cart")).toBeNull();
    expect(platformEventFor(withDefaults("ga4", { events: { purchase: "purchase", lead: null, sign_up: "sign_up" } }), "lead", "lead")).toBeNull();
  });
});

describe("matching a person", () => {
  it("hashes email and phone the way Meta and Google expect", () => {
    // sha256("test@example.com")
    expect(hashEmail("  Test@Example.com ")).toBe("973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
    expect(hashEmail("not an email")).toBeNull();
    // Digits only, country code kept, no leading zeros: +880 1700-000000 → 8801700000000.
    expect(hashPhone("+880 1700-000000")).toBe(hashPhone("8801700000000"));
    expect(hashPhone("123")).toBeNull();
  });

  it("builds fbc from the click when the pixel set none, and reads the pixel's ids when it did", () => {
    expect(fbcOf({ clk: { fbclid: { v: "IwAR3", ts: 1_791_999_999_000 } } })).toBe("fb.1.1791999999000.IwAR3");
    expect(fbcOf({ fbc: "fb.1.1700000000000.ABC", clk: { fbclid: { v: "IwAR3", ts: 1 } } })).toBe("fb.1.1700000000000.ABC");
    expect(fbpOf({ fbp: "fb.1.1700000000000.123456" })).toBe("fb.1.1700000000000.123456");
    expect(fbpOf({ fbp: "garbage" })).toBeNull();
    expect(gaClientIdOf({ ga: "GA1.1.1234567890.1700000000" })).toBe("1234567890.1700000000");
    expect(gaClientIdOf({ ga: "nope" })).toBeNull();
  });

  it("names what each platform will match by", () => {
    const base = { email: "e", phone: null, ip: "1.2.3.4", ua: "UA", fbc: "fb.1.1.x", fbp: null, gaClientId: "1.2", clk: { gclid: { v: "g", ts: 1 } } };
    expect(matchKeysFor("meta", base)).toEqual(["click_id", "email", "ip_ua"]);
    expect(matchKeysFor("ga4", base)).toEqual(["click_id", "email", "browser_id"]);
    expect(matchKeysFor("tiktok", { ...base, phone: "p", ttclid: "E.C.P", ttp: "abc12345" })).toEqual(["click_id", "email", "phone", "ip_ua", "browser_id"]);
    expect(matchKeysFor("linkedin", { ...base, phone: "p", liFatId: "li-uuid-1234" })).toEqual(["click_id", "email"]);
  });

  it("reads TikTok's and LinkedIn's click and browser ids", () => {
    expect(ttclidOf({ clk: { ttclid: { v: "E.C.P.abc", ts: 1 } } })).toBe("E.C.P.abc");
    expect(ttpOf({ ttp: "2Xy_abc.123-9" })).toBe("2Xy_abc.123-9");
    expect(ttpOf({ ttp: "<script>" })).toBeNull();
    // The ad link's id first, then the Insight Tag's cookie.
    expect(liFatIdOf({ clk: { li_fat_id: { v: "11111111-aaaa", ts: 1 } }, li: "22222222-bbbb" })).toBe("11111111-aaaa");
    expect(liFatIdOf({ li: "22222222-bbbb" })).toBe("22222222-bbbb");
    expect(liFatIdOf({})).toBeNull();
    expect(adContextOf({ ttp: "abc12345", li: "22222222-bbbb" })).toEqual({ ttp: "abc12345", li: "22222222-bbbb" });
  });

  it("keeps only well-formed, recent click ids from what the browser sent", () => {
    const now = 1_800_000_000_000;
    expect(adContextOf({ clk: { fbclid: { v: "a", ts: now - 1000 }, gclid: { v: "old", ts: now - 100 * 86_400_000 }, evil: { v: "x", ts: now } }, fbp: 5, ga: "GA1.1.1.2" }, now))
      .toEqual({ clk: { fbclid: { v: "a", ts: now - 1000 } }, ga: "GA1.1.1.2" });
    expect(adContextOf("nope", now)).toBeNull();
    expect(adContextOf({}, now)).toBeNull();
  });
});

describe("Meta's Conversions API", () => {
  it("sends a website event with hashed keys, the click and browser ids, and the order as event_id", async () => {
    expect(metaEvent(payload())).toEqual({
      event_name: "Purchase", event_time: 1_792_000_000, event_id: "order:1042", action_source: "website",
      event_source_url: "https://shop.test/thanks",
      user_data: { em: ["e".repeat(64)], external_id: ["x".repeat(64)], client_ip_address: "203.0.113.9", client_user_agent: "Mozilla/5.0", fbc: "fb.1.1791999999000.IwAR3", fbp: "fb.1.1790000000000.987" },
      custom_data: { value: 40, currency: "USD", order_id: "1042" },
    });
    const { ctx, calls } = fakeCtx([{ status: 200, text: '{"events_received":1}' }]);
    const out = await metaProvider.send(payload(), { pixel_id: "1234567890", access_token: "t".repeat(30) }, withDefaults("meta", {}), ctx);
    expect(out).toEqual({ kind: "ok", httpStatus: 200 });
    expect(calls[0]!.url).toEndWith("/1234567890/events");
    expect(JSON.parse(calls[0]!.body!).access_token).toBe("t".repeat(30));
  });

  it("treats an invalid token as a refused credential, and rate limits as worth retrying", async () => {
    const creds = { pixel_id: "1234567890", access_token: "t".repeat(30) };
    const bad = fakeCtx([{ status: 400, text: '{"error":{"message":"Invalid OAuth access token.","code":190}}' }]);
    expect(await metaProvider.send(payload(), creds, withDefaults("meta", {}), bad.ctx)).toMatchObject({ kind: "failed", auth: true, retryable: false, message: "Invalid OAuth access token." });
    const busy = fakeCtx([{ status: 400, text: '{"error":{"message":"Too many calls","code":17}}' }]);
    expect(await metaProvider.send(payload(), creds, withDefaults("meta", {}), busy.ctx)).toMatchObject({ kind: "failed", retryable: true });
  });

  it("checks credentials against the pixel, and a test without a code sends nothing that would count", async () => {
    const ok = fakeCtx([{ status: 200, text: '{"id":"1234567890","name":"Shoe Shop"}' }]);
    expect(await metaProvider.verify({ pixel_id: "1234567890", access_token: "t".repeat(30) }, ok.ctx)).toEqual({ ok: true, hint: "Shoe Shop · Pixel 1234567890" });
    const noCode = fakeCtx([{ status: 200, text: "{}" }]);
    const res = await metaProvider.test({ pixel_id: "1234567890", access_token: "t".repeat(30) }, withDefaults("meta", {}), null, noCode.ctx);
    expect(res.ok).toBe(true);
    expect(noCode.calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(metaProvider.credentialSchema.safeParse({ pixel_id: "abc", access_token: "t".repeat(30) }).success).toBe(false);
  });
});

describe("GA4's Measurement Protocol", () => {
  it("sends the event under the gtag visitor, with user-provided data and the order as transaction_id", () => {
    expect(ga4Body(payload({ platform_event: "purchase" }))).toEqual({
      client_id: "123.456", timestamp_micros: 1_792_000_000_000_000,
      user_data: { sha256_email_address: ["e".repeat(64)] },
      events: [{ name: "purchase", params: { engagement_time_msec: 1, value: 40, currency: "USD", transaction_id: "1042", page_location: "https://shop.test/thanks" } }],
    });
    expect((ga4Body(payload({ platform_event: "Lead-Form!" })).events as { name: string }[])[0]!.name).toBe("Lead_Form_");
  });

  it("skips an event with no visitor to attribute it to, and reads the debug endpoint's verdict", async () => {
    const creds = { measurement_id: "G-ABC1234", api_secret: "s".repeat(20) };
    const { ctx } = fakeCtx([]);
    expect(await ga4Provider.send(payload({ client_id: null }), creds, withDefaults("ga4", {}), ctx)).toEqual({ kind: "skipped", reason: "No visitor id to attribute the event to" });
    const invalid = fakeCtx([{ status: 200, text: '{"validationMessages":[{"description":"Unknown parameter"}]}' }]);
    expect(await ga4Provider.verify(creds, invalid.ctx)).toEqual({ ok: false, message: "Google Analytics did not accept the test event: Unknown parameter" });
    const valid = fakeCtx([{ status: 200, text: '{"validationMessages":[]}' }]);
    expect(await ga4Provider.verify(creds, valid.ctx)).toEqual({ ok: true, hint: "G-ABC1234" });
  });
});

describe("contact details on an event", () => {
  it("are left out of the analytics event log", async () => {
    const { withoutContactDetails } = await import("../../analytics/repositories/analytics-batch.repository");
    expect(withoutContactDetails({ name: "purchase", value: 40, email: "a@b.co", phone: "+880" })).toEqual({ name: "purchase", value: 40 });
    const untouched = { name: "x" };
    expect(withoutContactDetails(untouched)).toBe(untouched);
  });
});

describe("TikTok's Events API", () => {
  const creds = { pixel_code: "C4ABCD1234EFGH5678", access_token: "t".repeat(30) };

  it("sends a web event with hashed keys, the click and browser ids, and the order as event_id", async () => {
    expect(tiktokEvent(payload({ platform_event: "CompletePayment", ttclid: "E.C.P.x", ttp: "ttp12345" }))).toEqual({
      event: "CompletePayment", event_time: 1_792_000_000, event_id: "order:1042",
      user: { email: "e".repeat(64), external_id: "x".repeat(64), ttclid: "E.C.P.x", ttp: "ttp12345", ip: "203.0.113.9", user_agent: "Mozilla/5.0" },
      page: { url: "https://shop.test/thanks" },
      properties: { value: 40, currency: "USD", order_id: "1042", content_type: "product" },
    });
    const { ctx, calls } = fakeCtx([{ status: 200, text: '{"code":0,"message":"OK"}' }]);
    expect(await tiktokProvider.send(payload(), creds, withDefaults("tiktok", {}), ctx)).toEqual({ kind: "ok", httpStatus: 200 });
    expect(calls[0]!.url).toEndWith("/event/track/");
    expect(calls[0]!.headers!["access-token"]).toBe("t".repeat(30));
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({ event_source: "web", event_source_id: "C4ABCD1234EFGH5678" });
  });

  it("reads the verdict from the body, since TikTok answers 200 to a refusal too", async () => {
    const bad = fakeCtx([{ status: 200, text: '{"code":40105,"message":"Access token is incorrect or has been revoked."}' }]);
    expect(await tiktokProvider.send(payload(), creds, withDefaults("tiktok", {}), bad.ctx)).toMatchObject({ kind: "failed", auth: true, retryable: false });
    const busy = fakeCtx([{ status: 200, text: '{"code":40100,"message":"Too many requests"}' }]);
    expect(await tiktokProvider.send(payload(), creds, withDefaults("tiktok", {}), busy.ctx)).toMatchObject({ kind: "failed", retryable: true });
    const shape = fakeCtx([{ status: 200, text: '{"code":40002,"message":"event is invalid"}' }]);
    expect(await tiktokProvider.send(payload(), creds, withDefaults("tiktok", {}), shape.ctx)).toMatchObject({ kind: "failed", retryable: false, message: "event is invalid" });
  });

  it("checks credentials with an empty batch, and a test without a code sends no event", async () => {
    const ok = fakeCtx([{ status: 200, text: '{"code":40002,"message":"data: Field must not be empty"}' }]);
    expect(await tiktokProvider.verify(creds, ok.ctx)).toEqual({ ok: true, hint: "Pixel C4AB…5678" });
    expect(JSON.parse(ok.calls[0]!.body!).data).toEqual([]);
    const refused = fakeCtx([{ status: 200, text: '{"code":40001,"message":"No permission to operate pixel"}' }]);
    expect(await tiktokProvider.verify(creds, refused.ctx)).toMatchObject({ ok: false });
    const noCode = fakeCtx([{ status: 200, text: '{"code":40002}' }]);
    expect((await tiktokProvider.test(creds, withDefaults("tiktok", {}), null, noCode.ctx)).ok).toBe(true);
    expect(noCode.calls).toHaveLength(1);
    expect(tiktokProvider.credentialSchema.safeParse({ pixel_code: "no", access_token: "t".repeat(30) }).success).toBe(false);
  });
});

describe("LinkedIn's Conversions API", () => {
  const creds = { ad_account_id: "512345678", access_token: "t".repeat(30) };

  it("sends to the mapped conversion rule, matched by hashed email and the LinkedIn click id", async () => {
    expect(linkedinEvent(payload({ platform_event: "104000123", li_fat_id: "li-uuid-1234" }))).toEqual({
      conversion: "urn:lla:llaPartnerConversion:104000123", conversionHappenedAt: 1_792_000_000_000, eventId: "order:1042",
      conversionValue: { currencyCode: "USD", amount: "40.00" },
      user: { userIds: [{ idType: "SHA256_EMAIL", idValue: "e".repeat(64) }, { idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: "li-uuid-1234" }] },
    });
    const { ctx, calls } = fakeCtx([{ status: 201 }]);
    expect(await linkedinProvider.send(payload({ platform_event: "104000123" }), creds, withDefaults("linkedin", {}), ctx)).toEqual({ kind: "ok", httpStatus: 201 });
    expect(calls[0]!.url).toEndWith("/conversionEvents");
    expect(calls[0]!.headers).toMatchObject({ authorization: `Bearer ${"t".repeat(30)}`, "x-restli-protocol-version": "2.0.0" });
  });

  it("does not send what LinkedIn cannot match, or an event mapped to a name instead of a rule", async () => {
    const { ctx, calls } = fakeCtx([]);
    expect(await linkedinProvider.send(payload({ platform_event: "104000123", email_sha256: null }), creds, withDefaults("linkedin", {}), ctx))
      .toEqual({ kind: "skipped", reason: "No email or LinkedIn click id to match the person by" });
    expect(await linkedinProvider.send(payload({ platform_event: "Purchase" }), creds, withDefaults("linkedin", {}), ctx)).toMatchObject({ kind: "failed", retryable: false });
    expect(calls).toHaveLength(0);
    // No standard names to default to: nothing is sent until a rule is entered.
    expect(withDefaults("linkedin", {}).events).toEqual({ purchase: null, lead: null, sign_up: null });
  });

  it("checks the token against the ad account's rules, and the test that every mapped rule exists", async () => {
    const rules = '{"elements":[{"id":104000123},{"id":104000124}]}';
    const ok = fakeCtx([{ status: 200, text: rules }]);
    expect(await linkedinProvider.verify(creds, ok.ctx)).toEqual({ ok: true, hint: "Ad account 512345678" });
    expect(ok.calls[0]!.url).toContain("account=urn%3Ali%3AsponsoredAccount%3A512345678");
    const denied = fakeCtx([{ status: 401, text: '{"message":"Invalid access token"}' }]);
    expect(await linkedinProvider.verify(creds, denied.ctx)).toEqual({ ok: false, message: "LinkedIn did not accept this access token: Invalid access token" });
    const config = withDefaults("linkedin", { events: { purchase: "104000123", lead: "999", sign_up: null } });
    const missing = fakeCtx([{ status: 200, text: rules }]);
    expect((await linkedinProvider.test(creds, config, null, missing.ctx)).message).toContain("no conversion rule 999");
    const all = fakeCtx([{ status: 200, text: rules }]);
    expect((await linkedinProvider.test(creds, withDefaults("linkedin", { events: { purchase: "104000123", lead: null, sign_up: null } }), null, all.ctx)).ok).toBe(true);
  });
});
