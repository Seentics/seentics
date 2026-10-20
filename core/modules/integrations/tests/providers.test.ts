import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { TransportError, createProviderContext } from "../lib/http";
import type { HttpRequest, LeadPayload, ProviderContext } from "../interfaces";
import { hubspot } from "../providers/hubspot";
import { klaviyo } from "../providers/klaviyo";
import { mailchimp } from "../providers/mailchimp";
import { getProvider, providers } from "../providers/registry";
import { webhookBody, zapier } from "../providers/zapier";

const lead: LeadPayload = {
  submissionId: "5d3f1c0e-8a6b-4f5e-9d2c-1a2b3c4d5e6f", email: "Jane@Example.com", name: "Jane van Doe", firstName: "Jane", lastName: "van Doe",
  phone: "+1 (415) 555-0100", consent: true, fields: { company: "Acme" }, prize: { label: "10% off", coupon_code: "SAVE10" }, popupId: "a1", variant: "b",
  pageUrl: "https://shop.test/pricing", referrer: "", submittedAt: "2026-01-01T00:00:00.000Z",
};

type Reply = { status: number; body?: string };
/** A context that records requests and answers from a queue. */
function fakeCtx(replies: Reply[]) {
  const calls: HttpRequest[] = [];
  const ctx: ProviderContext = {
    async request(req) {
      calls.push(req);
      const r = replies.shift() ?? { status: 200 };
      return { status: r.status, text: r.body ?? "{}" };
    },
    async assertPublicUrl() {},
  };
  return { ctx, calls };
}

describe("registry", () => {
  it("lists the four providers and finds them by id", () => {
    expect(providers.map((p) => p.id)).toEqual(["zapier", "mailchimp", "klaviyo", "hubspot"]);
    expect(getProvider("mailchimp")?.label).toBe("Mailchimp");
    expect(getProvider("nope")).toBeUndefined();
  });
  it("describes only credential and config fields, never values", () => {
    for (const p of providers) for (const f of p.fields) expect(Object.keys(f)).not.toContain("value");
  });
});

describe("zapier / webhook", () => {
  const credentials = { webhook_url: "https://hooks.zapier.com/hooks/catch/123/abc/", signing_secret: undefined };

  it("posts stable JSON and marks test events", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }]);
    expect(await zapier.deliver(lead, credentials, {}, ctx)).toEqual({ kind: "ok", httpStatus: 200 });
    expect(calls[0]!.method).toBe("POST");
    const body = JSON.parse(calls[0]!.body!);
    expect(body).toMatchObject({ event: "lead.captured", test: false, email: "Jane@Example.com", first_name: "Jane", consent: true, source: { popup_id: "a1", variant: "b" } });
    expect(body).toMatchObject({ submission_id: lead.submissionId, prize: { label: "10% off", coupon_code: "SAVE10" } });
    expect(body).not.toHaveProperty("contact_id");
    expect(webhookBody({ ...lead, test: true }).event).toBe("lead.test");
  });

  it("names the submission and the delivery so a receiver can de-duplicate a retry", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }, { status: 200 }]);
    await zapier.deliver(lead, credentials, {}, ctx, { id: "delivery-1" });
    await zapier.deliver(lead, credentials, {}, ctx);
    expect(calls[0]!.headers!["Idempotency-Key"]).toBe(lead.submissionId);
    expect(calls[0]!.headers!["X-Seentics-Delivery"]).toBe("delivery-1");
    expect(calls[1]!.headers!["Idempotency-Key"]).toBe(lead.submissionId);
    expect(calls[1]!.headers).not.toHaveProperty("X-Seentics-Delivery");
  });

  it("signs the body when a secret is set", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }]);
    await zapier.deliver(lead, { ...credentials, signing_secret: "topsecret" }, {}, ctx);
    const expected = createHmac("sha256", "topsecret").update(calls[0]!.body!).digest("hex");
    expect(calls[0]!.headers!["X-Seentics-Signature"]).toBe(`sha256=${expected}`);
  });

  it("checks the user-supplied host before sending", async () => {
    const { ctx, calls } = fakeCtx([]);
    ctx.assertPublicUrl = async () => { throw new TransportError("URL resolves to a non-public address"); };
    await expect(zapier.deliver(lead, credentials, {}, ctx)).rejects.toThrow("non-public");
    expect(calls).toHaveLength(0);
  });

  it("requires an https URL", () => {
    expect(zapier.credentialSchema.safeParse({ webhook_url: "http://hooks.zapier.com/x" }).success).toBe(false);
    expect(zapier.credentialSchema.safeParse({ webhook_url: "https://hooks.zapier.com/hooks/catch/1/a/" }).success).toBe(true);
  });
});

describe("mailchimp", () => {
  const credentials = { api_key: `${"0123456789abcdef".repeat(2)}-us21` };
  const config = { audience_id: "a1b2c3d4e5", double_opt_in: false };

  it("upserts by md5 of the lower-cased email on the key's data centre", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }]);
    expect(await mailchimp.deliver(lead, credentials, config, ctx)).toMatchObject({ kind: "ok" });
    const call = calls[0]!;
    expect(call.method).toBe("PUT");
    expect(call.url).toBe("https://us21.api.mailchimp.com/3.0/lists/a1b2c3d4e5/members/" + new Bun.CryptoHasher("md5").update("jane@example.com").digest("hex"));
    expect(JSON.parse(call.body!)).toEqual({ email_address: "Jane@Example.com", status_if_new: "subscribed", merge_fields: { FNAME: "Jane", LNAME: "van Doe" } });
    expect(call.headers!.Authorization).toBe(`Basic ${Buffer.from(`seentics:${credentials.api_key}`).toString("base64")}`);
  });

  it("uses pending status for double opt-in", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }]);
    await mailchimp.deliver(lead, credentials, { ...config, double_opt_in: true }, ctx);
    expect(JSON.parse(calls[0]!.body!).status_if_new).toBe("pending");
  });

  it("skips a lead without consent and makes no request", async () => {
    const { ctx, calls } = fakeCtx([]);
    expect(await mailchimp.deliver({ ...lead, consent: false }, credentials, config, ctx)).toEqual({ kind: "skipped", reason: "No marketing consent given" });
    expect(calls).toHaveLength(0);
  });

  it("verifies the audience, and reports a bad key or audience", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }, { status: 401, body: '{"detail":"API Key Invalid"}' }, { status: 404 }]);
    expect((await mailchimp.verify(credentials, config, ctx)).kind).toBe("ok");
    expect(calls[0]!.url).toContain("/lists/a1b2c3d4e5?fields=id,name");
    expect(await mailchimp.verify(credentials, config, ctx)).toMatchObject({ kind: "failed", auth: true });
    expect(await mailchimp.verify(credentials, config, ctx)).toMatchObject({ kind: "failed", retryable: false, httpStatus: 404 });
  });

  it("validates credentials and shows only a hint", () => {
    expect(mailchimp.credentialSchema.safeParse({ api_key: "no-datacentre" }).success).toBe(false);
    expect(mailchimp.hint(credentials)).toBe("cdef");
  });
});

describe("klaviyo", () => {
  const credentials = { api_key: "pk_abcdefghijklmnopqrstuvwx" };

  it("imports a profile with E.164 phone and properties, and stops without a list", async () => {
    const { ctx, calls } = fakeCtx([{ status: 201, body: '{"data":{"id":"P1"}}' }]);
    expect(await klaviyo.deliver(lead, credentials, {}, ctx)).toMatchObject({ kind: "ok" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://a.klaviyo.com/api/profile-import");
    expect(calls[0]!.headers!.Authorization).toBe(`Klaviyo-API-Key ${credentials.api_key}`);
    expect(calls[0]!.headers!.revision).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const attrs = JSON.parse(calls[0]!.body!).data.attributes;
    expect(attrs).toMatchObject({ email: "Jane@Example.com", first_name: "Jane", phone_number: "+14155550100" });
    expect(attrs.properties.company).toBe("Acme");
  });

  it("drops a phone that is not E.164 rather than failing the profile", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200, body: "{}" }]);
    await klaviyo.deliver({ ...lead, phone: "555-0100" }, credentials, {}, ctx);
    expect(JSON.parse(calls[0]!.body!).data.attributes.phone_number).toBeUndefined();
  });

  it("subscribes a consenting lead to the list", async () => {
    const { ctx, calls } = fakeCtx([{ status: 201, body: '{"data":{"id":"P1"}}' }, { status: 202 }]);
    expect(await klaviyo.deliver(lead, credentials, { list_id: "Y6nRLr" }, ctx)).toMatchObject({ kind: "ok", httpStatus: 202 });
    expect(calls[1]!.url).toBe("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs");
    const body = JSON.parse(calls[1]!.body!);
    expect(body.data.relationships.list.data.id).toBe("Y6nRLr");
    expect(body.data.attributes.profiles.data[0].attributes.subscriptions.email.marketing.consent).toBe("SUBSCRIBED");
  });

  it("adds a non-consenting lead to the list without recording consent", async () => {
    const { ctx, calls } = fakeCtx([{ status: 201, body: '{"data":{"id":"P1"}}' }, { status: 204 }]);
    expect(await klaviyo.deliver({ ...lead, consent: false }, credentials, { list_id: "Y6nRLr" }, ctx)).toMatchObject({ kind: "ok", httpStatus: 204 });
    expect(calls[1]!.url).toBe("https://a.klaviyo.com/api/lists/Y6nRLr/relationships/profiles");
    expect(calls[1]!.body).not.toContain("SUBSCRIBED");
    expect(JSON.parse(calls[1]!.body!).data).toEqual([{ type: "profile", id: "P1" }]);
  });

  it("surfaces a failed profile import without touching the list", async () => {
    const { ctx, calls } = fakeCtx([{ status: 400, body: '{"errors":[{"detail":"Invalid email"}]}' }]);
    expect(await klaviyo.deliver(lead, credentials, { list_id: "Y6nRLr" }, ctx)).toMatchObject({ kind: "failed", retryable: false, message: "HTTP 400: Invalid email" });
    expect(calls).toHaveLength(1);
  });

  it("only accepts private keys", () => {
    expect(klaviyo.credentialSchema.safeParse({ api_key: "AbCdEf" }).success).toBe(false);
    expect(klaviyo.configSchema.safeParse({ list_id: "" }).success).toBe(true);
  });
});

describe("hubspot", () => {
  const credentials = { access_token: "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx" };

  it("updates an existing contact by email", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }]);
    expect(await hubspot.deliver(lead, credentials, {}, ctx)).toMatchObject({ kind: "ok" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/Jane%40Example.com?idProperty=email");
    expect(JSON.parse(calls[0]!.body!).properties).toEqual({ email: "Jane@Example.com", firstname: "Jane", lastname: "van Doe", phone: "+1 (415) 555-0100" });
    expect(calls[0]!.headers!.Authorization).toBe(`Bearer ${credentials.access_token}`);
  });

  it("creates the contact when it does not exist", async () => {
    const { ctx, calls } = fakeCtx([{ status: 404 }, { status: 201 }]);
    expect(await hubspot.deliver(lead, credentials, {}, ctx)).toMatchObject({ kind: "ok", httpStatus: 201 });
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST"]);
    expect(calls[1]!.url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
  });

  it("retries the update once if creation races with another", async () => {
    const { ctx, calls } = fakeCtx([{ status: 404 }, { status: 409 }, { status: 200 }]);
    expect(await hubspot.deliver(lead, credentials, {}, ctx)).toMatchObject({ kind: "ok" });
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST", "PATCH"]);
  });

  it("is sent whether or not the visitor consented", async () => {
    const { ctx, calls } = fakeCtx([{ status: 200 }]);
    await hubspot.deliver({ ...lead, consent: false }, credentials, {}, ctx);
    expect(calls).toHaveLength(1);
  });

  it("verifies with a read and reports a missing scope", async () => {
    const { ctx } = fakeCtx([{ status: 200 }, { status: 403, body: '{"message":"missing scopes"}' }]);
    expect((await hubspot.verify(credentials, {}, ctx)).kind).toBe("ok");
    expect(await hubspot.verify(credentials, {}, ctx)).toMatchObject({ kind: "failed", auth: true });
  });
});

// ─── Against a real HTTP server ─────────────────────────────────────────────────

describe("provider context over HTTP", () => {
  let server: ReturnType<typeof Bun.serve>;
  let seen: { method: string; path: string; auth: string | null; body: string }[] = [];
  let mode: "ok" | "500" | "400" | "slow" | "redirect" = "ok";

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        seen.push({ method: req.method, path: url.pathname, auth: req.headers.get("authorization"), body: await req.text() });
        if (mode === "slow") await Bun.sleep(300);
        if (mode === "500") return new Response('{"message":"boom"}', { status: 500 });
        if (mode === "400") return new Response('{"detail":"nope"}', { status: 400 });
        if (mode === "redirect") return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
        return new Response('{"ok":true}', { status: 200 });
      },
    });
  });
  afterAll(() => server.stop(true));
  beforeEach(() => { seen = []; mode = "ok"; });

  /** Send everything to the fake server, keeping path and headers. */
  const toFake = ((input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    return fetch(`http://localhost:${server.port}${u.pathname}${u.search}`, init);
  }) as typeof fetch;

  it("delivers a lead end to end through a provider", async () => {
    const ctx = createProviderContext(toFake, 2_000);
    const out = await hubspot.deliver(lead, { access_token: "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx" }, {}, ctx);
    expect(out.kind).toBe("ok");
    expect(seen[0]).toMatchObject({ method: "PATCH", auth: "Bearer pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx" });
  });

  it("reports 5xx as retryable and 4xx as final", async () => {
    const ctx = createProviderContext(toFake, 2_000);
    const creds = { access_token: "pat-na1-12345678-abcd-efgh-ijkl-mnopqrstuvwx" };
    mode = "500";
    expect(await hubspot.deliver(lead, creds, {}, ctx)).toMatchObject({ kind: "failed", retryable: true, httpStatus: 500 });
    mode = "400";
    expect(await hubspot.deliver(lead, creds, {}, ctx)).toMatchObject({ kind: "failed", retryable: false, message: "HTTP 400: nope" });
  });

  it("times out as a transport error", async () => {
    const ctx = createProviderContext(toFake, 50);
    mode = "slow";
    await expect(ctx.request({ url: "https://x.test/slow", method: "GET" })).rejects.toThrow("timed out");
  });

  it("does not follow redirects", async () => {
    const ctx = createProviderContext(toFake, 2_000);
    mode = "redirect";
    const res = await ctx.request({ url: "https://x.test/r", method: "GET" });
    expect(res.status).toBe(302);
    expect(seen).toHaveLength(1);
  });

  it("refuses internal and non-https webhook URLs", async () => {
    const ctx = createProviderContext(toFake, 2_000);
    for (const url of ["http://hooks.example.com/x", "https://localhost/x", "https://169.254.169.254/x", "https://service.internal/x"]) {
      await expect(ctx.assertPublicUrl(url), url).rejects.toThrow(TransportError);
    }
  });
});

describe("zapier hint", () => {
  it("keeps the webhook's host, which is not the secret, and only the tail of its path", () => {
    expect(zapier.hint({ webhook_url: "https://hooks.slack.com/services/T000/B000/abcdefb71d90" })).toBe("hooks.slack.com …1d90");
    expect(zapier.hint({ webhook_url: "https://hooks.zapier.com/hooks/catch/123/abc8f3a2c/" })).toBe("hooks.zapier.com …3a2c");
  });

  it("fits the column (VARCHAR 120) for any URL the schema accepts", () => {
    const host = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.example.com`;
    expect(zapier.hint({ webhook_url: `https://${host}/x/${"y".repeat(40)}` }).length).toBeLessThanOrEqual(120);
  });
});
