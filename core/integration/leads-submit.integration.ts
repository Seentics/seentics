import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { seedUser, seedWebsite, sql } from "./harness";
import { rawApp, seedConnection, seedPopup, submit, wheelAction } from "./helpers/leads";

async function site() {
  const owner = await seedUser();
  return { owner, site: await seedWebsite(owner.id) };
}

const stored = (websiteId: string) =>
  sql<{ id: string; email: string; name: string; consent: boolean; fields: Record<string, unknown>; automation_id: string | null; prize: unknown; variant: string | null }[]>`
    SELECT id::text, email, name, consent, fields, automation_id::text, prize, variant
    FROM form_submissions WHERE website_id = ${websiteId}::uuid`;

describe("POST /api/v1/tracker/leads — storing a lead", () => {
  it("stores a normalised submission and tells the visitor only ok", async () => {
    const { site: s } = await site();

    const res = await submit({
      website_id: s.id,
      email: "  Jane@Example.COM ",
      name: " Jane ",
      consent: true,
      fields: { company: "Acme", nested: { x: 1 }, "bad key": "x" },
      page_url: "https://x.test/pricing",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    const rows = await stored(s.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "jane@example.com", name: "Jane", consent: true, fields: { company: "Acme" } });
  });

  it("resolves the site by its public tracking id as well as its uuid", async () => {
    const { site: s } = await site();
    const res = await submit({ website_id: s.trackingId, email: "a@b.test" });
    expect(res.status).toBe(200);
    expect(await stored(s.id)).toHaveLength(1);
  });

  it("stores consent as false unless the visitor ticked it (a truthy string is not consent)", async () => {
    const { site: s } = await site();
    await submit({ website_id: s.id, email: "a@b.test" });
    // The schema wants a boolean; "yes" is malformed rather than silently consent.
    const res = await submit({ website_id: s.id, email: "b@b.test", consent: "yes" });
    expect(res.status).toBe(400);
    const rows = await stored(s.id);
    expect(rows.map((r) => r.consent)).toEqual([false]);
  });

  it("acknowledges a honeypot hit without storing anything", async () => {
    const { site: s } = await site();
    const res = await submit({ website_id: s.id, email: "bot@spam.test", hp: "filled" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("rejects malformed JSON and bad emails with 400", async () => {
    const { site: s } = await site();
    expect((await submit("{not json")).status).toBe(400);
    expect((await submit({ website_id: s.id, email: "not-an-email" })).status).toBe(400);
    expect((await submit({ email: "a@b.test" })).status).toBe(400);
    expect((await submit({ website_id: s.id, email: "a@b.test", automation_id: "nope" })).status).toBe(400);
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("answers 404 for an unknown or inactive site", async () => {
    expect((await submit({ website_id: randomUUID(), email: "a@b.test" })).status).toBe(404);
    const { site: s } = await site();
    await sql`UPDATE websites SET is_active = false WHERE id = ${s.id}::uuid`;
    expect((await submit({ website_id: s.id, email: "a@b.test" })).status).toBe(404);
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("refuses a post from another site's origin", async () => {
    const { site: s } = await site();
    const res = await submit({ website_id: s.id, email: "a@b.test" }, { Origin: "https://evil.test" });
    expect(res.status).toBe(403);
    expect(await stored(s.id)).toHaveLength(0);
    // The site's own origin is fine.
    expect((await submit({ website_id: s.id, email: "a@b.test" }, { Origin: `https://${s.domain}` })).status).toBe(200);
  });

  it("collects nothing when the site has automations switched off", async () => {
    const { site: s } = await site();
    await sql`UPDATE websites SET automation_enabled = false WHERE id = ${s.id}::uuid`;
    const res = await submit({ website_id: s.id, email: "a@b.test" });
    expect(res.status).toBe(200);
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("rate limits a burst from one visitor to five stored leads, still answering ok", async () => {
    const { site: s } = await site();
    for (let i = 0; i < 8; i++) {
      const res = await submit({ website_id: s.id, email: `burst${i}@b.test` });
      // A script must not learn it was throttled.
      expect(res.status).toBe(200);
    }
    expect(await stored(s.id)).toHaveLength(5);
  });

  it("keeps a lead but drops attribution to another site's popup", async () => {
    const { site: s } = await site();
    const other = await site();
    const foreignPopup = await seedPopup(other.site.id, other.owner.id);

    await submit({ website_id: s.id, email: "a@b.test", automation_id: foreignPopup, variant: "b" });

    const rows = await stored(s.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ automation_id: null, variant: null });
  });
});

describe("POST /api/v1/tracker/leads — body size", () => {
  const big = (s: string) => JSON.stringify({ website_id: s, email: "a@b.test", fields: { note: "x".repeat(20_000) } });

  it("refuses a body over 16KB with 413", async () => {
    const { site: s } = await site();
    const res = await submit(big(s.id));
    expect(res.status).toBe(413);
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("refuses an oversized body declared by its Content-Length before reading it", async () => {
    const { site: s } = await site();
    // Declares 1MB but sends a tiny body: rejected on the header alone.
    const res = await rawApp().request("/api/v1/tracker/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(1024 * 1024) },
      body: JSON.stringify({ website_id: s.id, email: "a@b.test" }),
    });
    expect(res.status).toBe(413);
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("refuses a body that lies with a small Content-Length", async () => {
    const { site: s } = await site();
    const res = await rawApp().request("/api/v1/tracker/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10" },
      body: big(s.id),
    });
    expect(res.status).toBe(413);
    expect(await stored(s.id)).toHaveLength(0);
  });

  it("stops a streamed body without a length as soon as it passes 16KB, without waiting for the end", async () => {
    const { site: s } = await site();
    let pulls = 0;
    // An endless stream: if the server buffered the whole body this request would never finish.
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new TextEncoder().encode(pulls === 1 ? `{"website_id":"${s.id}","email":"a@b.test","x":"` : "x".repeat(4096)));
      },
    });
    const res = await rawApp().request("/api/v1/tracker/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      // @ts-expect-error Bun/undici need this for a streamed request body.
      duplex: "half",
    });
    expect(res.status).toBe(413);
    expect(pulls).toBeLessThan(50);
    expect(await stored(s.id)).toHaveLength(0);
  });
});

describe("POST /api/v1/tracker/leads — prizes", () => {
  it("draws a wheel prize server-side and returns its coupon code", async () => {
    const { owner, site: s } = await site();
    const popup = await seedPopup(s.id, owner.id, wheelAction);

    const res = await submit({ website_id: s.id, email: "win@b.test", automation_id: popup });

    expect(res.status).toBe(200);
    expect(res.body.prize).toEqual({ id: "0", label: "10% off", coupon_code: "TEN" });
    const rows = await stored(s.id);
    expect(rows[0]!.prize).toEqual({ id: "0", label: "10% off", coupon_code: "TEN" });
  });

  it("assigns a prize once per email: a resubmission (any casing) gets the same prize and no new claim", async () => {
    const { owner, site: s } = await site();
    const popup = await seedPopup(s.id, owner.id, wheelAction);

    const first = await submit({ website_id: s.id, email: "once@b.test", automation_id: popup });
    // The owner edits the wheel; the visitor who already won keeps their original prize.
    await sql`UPDATE automations SET definition = jsonb_set(definition, '{graph,nodes,1,action,wheel,segments,0,label}', '"20% off"')
              WHERE id = ${popup}::uuid`;
    const again = await submit({ website_id: s.id, email: "ONCE@b.test", automation_id: popup });

    expect(again.body.prize).toEqual(first.body.prize);
    const claims = await sql`SELECT 1 FROM form_prizes WHERE website_id = ${s.id}::uuid AND automation_id = ${popup}::uuid`;
    expect(claims).toHaveLength(1);
  });

  it("gives concurrent submissions of one email the same single prize", async () => {
    const { owner, site: s } = await site();
    const popup = await seedPopup(s.id, owner.id, wheelAction);
    const results = await Promise.all([1, 2, 3].map(() => submit({ website_id: s.id, email: "race@b.test", automation_id: popup })));
    for (const r of results) expect(r.body.prize?.label).toBe("10% off");
    expect(await sql`SELECT 1 FROM form_prizes WHERE automation_id = ${popup}::uuid`).toHaveLength(1);
  });

  it("returns a fixed coupon for a coupon-behind-form popup", async () => {
    const { owner, site: s } = await site();
    const popup = await seedPopup(s.id, owner.id, { type: "show_modal", form: { fields: ["email"] }, coupon: { code: "WELCOME", description: "Welcome gift" } });
    const res = await submit({ website_id: s.id, email: "c@b.test", automation_id: popup });
    expect(res.body.prize).toEqual({ id: "coupon", label: "Welcome gift", coupon_code: "WELCOME" });
  });

  it("ignores prize-looking fields the browser sends", async () => {
    const { owner, site: s } = await site();
    const popup = await seedPopup(s.id, owner.id);
    const res = await submit({ website_id: s.id, email: "p@b.test", automation_id: popup, fields: { prize: "car", prize_code: "FREE", city: "Oslo" } });
    expect(res.body.prize).toBeUndefined();
    const rows = await stored(s.id);
    expect(rows[0]).toMatchObject({ prize: null, fields: { city: "Oslo" } });
  });
});

describe("POST /api/v1/tracker/leads — queuing for integrations", () => {
  it("queues one delivery per enabled destination of the site, and none for a disabled one", async () => {
    const { site: s } = await site();
    const a = await seedConnection(s.id);
    const b = await seedConnection(s.id);
    await seedConnection(s.id, { enabled: false });

    await submit({ website_id: s.id, email: "q@b.test" });

    const [lead] = await stored(s.id);
    const deliveries = await sql<{ connection_id: string; status: string }[]>`
      SELECT connection_id::text, status FROM integration_deliveries WHERE submission_id = ${lead!.id}::uuid`;
    expect(deliveries.map((d) => d.connection_id).sort()).toEqual([a, b].sort());
    expect(deliveries.every((d) => d.status === "pending")).toBe(true);
  });

  it("routes a popup's lead only to the destinations its form names", async () => {
    const { owner, site: s } = await site();
    const chosen = await seedConnection(s.id);
    await seedConnection(s.id);
    const popup = await seedPopup(s.id, owner.id, { type: "show_modal", form: { fields: ["email"], destinations: [chosen] } });

    await submit({ website_id: s.id, email: "r@b.test", automation_id: popup });

    const deliveries = await sql<{ connection_id: string }[]>`
      SELECT connection_id::text FROM integration_deliveries WHERE website_id = ${s.id}::uuid`;
    expect(deliveries.map((d) => d.connection_id)).toEqual([chosen]);
  });

  it("cannot route a lead to another site's destination named in the form", async () => {
    const { owner, site: s } = await site();
    const other = await site();
    const foreign = await seedConnection(other.site.id);
    const popup = await seedPopup(s.id, owner.id, { type: "show_modal", form: { fields: ["email"], destinations: [foreign] } });

    await submit({ website_id: s.id, email: "x@b.test", automation_id: popup });

    expect(await sql`SELECT 1 FROM integration_deliveries WHERE connection_id = ${foreign}::uuid`).toHaveLength(0);
  });
});
