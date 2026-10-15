import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import type { SeededWebsite } from "./harness";

// A low per-automation webhook cap, so the cap is reachable in a test. Read once, when the
// evaluation service loads — hence set before the harness (and the app) is imported, and
// every import that reaches the app is dynamic (static ones are hoisted above this line).
process.env.AUTOMATION_WEBHOOKS_PER_MINUTE = "3";
const { api, application, seedUser, seedWebsite, sql } = await import("./harness");
const { BROWSER_UA, CRAWLER_UA, createAutomation, definition, eventually, evaluate, graphOf, insertAutomation, pageHeaders } =
  await import("./helpers/automations");
const { setHostGuard, setWebhookTransport } = await import("../modules/automations/services/automation-webhook-execution.service");

/** Every webhook request the app made, captured instead of leaving the machine. */
const sent: Array<{ url: string; init: RequestInit }> = [];
let reply: (url: string) => Response = () => new Response("ok", { status: 200 });

beforeAll(() => {
  setHostGuard(async (host) => {
    // Stands in for DNS: this name "resolves" to an internal address.
    if (host === "rebind.example.com") throw new Error("resolves to 10.0.0.1");
  });
  setWebhookTransport((async (url: string | URL, init?: RequestInit) => {
    sent.push({ url: String(url), init: init ?? {} });
    return reply(String(url));
  }) as typeof fetch);
});
afterAll(() => {
  setHostGuard();
  setWebhookTransport();
});

async function ownerWithSite() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

const webhookDef = (url: string, extra: Record<string, unknown> = {}) =>
  definition({ graph: graphOf({ type: "webhook", url, headers: { "X-Api-Key": "secret-key-123" }, body: { who: "{{ user.email }}" }, ...extra }) });

describe("what /tracker/init gives a page", () => {
  it("lists active automations with only their id and triggers — no webhook URL, header, or name", async () => {
    const { owner, site } = await ownerWithSite();
    const hook = await createAutomation(owner.token, site.id, {
      name: "Internal CRM sync",
      definition: webhookDef("https://hooks.example.com/secret-path", { url: "https://hooks.example.com/secret-path" }),
    });
    const inactive = await createAutomation(owner.token, site.id);
    await api("POST", `/api/v1/automations/${site.id}/${inactive.id}/toggle`, { token: owner.token });

    const res = await api("GET", `/api/v1/tracker/init/${site.trackingId}`, { headers: pageHeaders(site) });

    expect(res.status).toBe(200);
    expect(res.body.automations).toEqual([{ id: hook.id, triggers: [{ type: "exit_intent" }] }]);
    for (const secret of ["secret-path", "secret-key-123", "Internal CRM sync", "hooks.example.com"]) {
      expect({ secret, leaked: res.text.includes(secret) }).toEqual({ secret, leaked: false });
    }
  });

  it("sends no automations when the site has automations switched off", async () => {
    const { owner, site } = await ownerWithSite();
    await createAutomation(owner.token, site.id);
    await sql`UPDATE websites SET automation_enabled = false WHERE id = ${site.id}::uuid`;

    const res = await api("GET", `/api/v1/tracker/init/${site.trackingId}`, { headers: pageHeaders(site) });

    expect(res.status).toBe(200);
    expect(res.body.automations).toEqual([]);
  });

  it("refuses a page on another domain", async () => {
    const { site } = await ownerWithSite();
    const res = await api("GET", `/api/v1/tracker/init/${site.trackingId}`, { headers: { Origin: "https://evil.example", "User-Agent": BROWSER_UA } });
    expect(res.status).toBe(403);
  });
});

describe("evaluating a trigger", () => {
  it("returns the matching automation's client action and records the run and impression", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    const anon = `v-${randomUUID().slice(0, 8)}`;

    const res = await evaluate(site, { type: "exit_intent" }, { anonymousId: anon, context: { page: "/pricing" } });

    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(1);
    expect(res.body.actions).toHaveLength(1);
    expect(res.body.actions[0]).toMatchObject({ type: "show_banner", automation_id: a.id, custom_html: "<p>Hi</p>" });
    const imps = await sql`SELECT anonymous_id, website_id::text FROM automation_impressions WHERE automation_id = ${a.id}::uuid`;
    expect([...imps]).toEqual([{ anonymous_id: anon, website_id: site.id }]);
    const runs = await sql`SELECT record_type, page_url FROM automation_events WHERE automation_id = ${a.id}::uuid ORDER BY record_type`;
    expect(runs.map((r) => r.record_type)).toEqual(["action", "server_run"]);
  });

  it("matches nothing for another trigger type, or a page outside the trigger's path", async () => {
    const { owner, site } = await ownerWithSite();
    await createAutomation(owner.token, site.id, { definition: definition({ triggers: [{ type: "exit_intent", path: "/pricing", match_type: "exact" }] }) });

    expect((await evaluate(site, { type: "click" })).body.matched).toBe(0);
    expect((await evaluate(site, { type: "exit_intent" }, { context: { page: "/blog" } })).body.matched).toBe(0);
    expect((await evaluate(site, { type: "exit_intent" }, { context: { page: "/pricing" } })).body.matched).toBe(1);
  });

  it("stops showing once the per-session cap is reached", async () => {
    const { owner, site } = await ownerWithSite();
    await createAutomation(owner.token, site.id, { definition: definition({ frequency: { maxPerSession: 2 } }) });
    const who = { anonymousId: "v-cap", sessionId: `s-${randomUUID()}` };

    const counts = [];
    for (let i = 0; i < 3; i++) counts.push((await evaluate(site, { type: "exit_intent" }, who)).body.matched);

    expect(counts).toEqual([1, 1, 0]);
  });

  it("never runs an inactive automation, or another site's", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    await api("POST", `/api/v1/automations/${site.id}/${a.id}/toggle`, { token: owner.token });
    const other = await seedWebsite(owner.id);
    await createAutomation(owner.token, other.id);

    const res = await evaluate(site, { type: "exit_intent" });

    expect(res.body).toEqual({ status: "ok", matched: 0, actions: [] });
  });

  it("does nothing when the site has automations switched off", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    await sql`UPDATE websites SET automation_enabled = false WHERE id = ${site.id}::uuid`;

    const res = await evaluate(site, { type: "exit_intent" });

    expect(res.body.matched).toBe(0);
    expect(await sql`SELECT 1 FROM automation_impressions WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });

  // A crawler running the page's scripts must not see popups, be charged impressions, or fire webhooks.
  it("triggers nothing for a crawler", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);

    const res = await evaluate(site, { type: "exit_intent" }, { ua: CRAWLER_UA });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", matched: 0, actions: [] });
    expect(await sql`SELECT 1 FROM automation_impressions WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });

  it("rejects requests missing the visitor, session or trigger, and other domains", async () => {
    const { site } = await ownerWithSite();
    const post = (body: unknown, headers = pageHeaders(site)) => api("POST", "/api/v1/tracker/automations/evaluate", { headers, body });

    expect((await post({ website_id: site.trackingId, session_id: "s", trigger: { type: "click" } })).status).toBe(400);
    expect((await post({ website_id: site.trackingId, anonymous_id: "a", session_id: "s" })).status).toBe(400);
    expect((await post({ website_id: site.trackingId, anonymous_id: "a", session_id: "s", trigger: {} })).status).toBe(400);
    expect((await post("{oops")).status).toBe(400);
    expect((await post({ website_id: "trk_nope", anonymous_id: "a", session_id: "s", trigger: { type: "click" } })).status).toBe(404);
    const foreign = await post({ website_id: site.trackingId, anonymous_id: "a", session_id: "s", trigger: { type: "click" } }, { Origin: "https://evil.example", "User-Agent": BROWSER_UA });
    expect(foreign.status).toBe(403);
  });
});

describe("webhook actions", () => {
  async function webhookRows(automationId: string, n = 1) {
    return eventually(async () => {
      const rows = await sql`SELECT url, success, status_code, attempt_count, error FROM webhook_deliveries WHERE automation_id = ${automationId}::uuid`;
      return rows.length >= n ? rows : null;
    });
  }

  it("calls the webhook from the server with its headers and rendered body, and never tells the page", async () => {
    const { owner, site } = await ownerWithSite();
    const url = `https://hooks.example.com/${randomUUID()}`;
    const a = await createAutomation(owner.token, site.id, { definition: webhookDef(url) });

    const res = await evaluate(site, { type: "exit_intent" }, { context: { user: { email: "jane@example.com" } } });

    expect(res.body.matched).toBe(1);
    expect(res.body.actions).toEqual([]);
    expect(res.text).not.toContain("hooks.example.com");
    const rows = await webhookRows(a.id);
    expect([...rows!]).toEqual([{ url, success: true, status_code: 200, attempt_count: 1, error: null }]);
    const call = sent.find((s) => s.url === url)!;
    expect((call.init.headers as Record<string, string>)["X-Api-Key"]).toBe("secret-key-123");
    expect(JSON.parse(String(call.init.body))).toMatchObject({ who: "jane@example.com", _automation_id: a.id });
  });

  // Saved before the URL rules tightened, or written around the API: the executor checks again.
  it("refuses an internal webhook URL at execution time and logs the refusal", async () => {
    const { owner, site } = await ownerWithSite();
    const url = "http://169.254.169.254/latest/meta-data/";
    const id = await insertAutomation(site.id, owner.id, definition({ graph: graphOf({ type: "webhook", url }) }));

    await evaluate(site, { type: "exit_intent" });

    const rows = await webhookRows(id);
    expect([...rows!]).toEqual([{ url, success: false, status_code: null, attempt_count: 0, error: "URL blocked: failed SSRF validation" }]);
    expect(sent.some((s) => s.url === url)).toBe(false);
  });

  it("refuses a public-looking name that resolves to an internal address", async () => {
    const { owner, site } = await ownerWithSite();
    const url = "https://rebind.example.com/hook";
    const a = await createAutomation(owner.token, site.id, { definition: webhookDef(url) });

    await evaluate(site, { type: "exit_intent" });

    const rows = await webhookRows(a.id);
    expect(rows![0]!.error).toBe("URL blocked: resolves to a non-public address");
    expect(sent.some((s) => s.url === url)).toBe(false);
  });

  it("does not follow a redirect", async () => {
    const { owner, site } = await ownerWithSite();
    const url = `https://hooks.example.com/redirect-${randomUUID()}`;
    const a = await createAutomation(owner.token, site.id, { definition: webhookDef(url) });
    reply = (u) => (u === url ? new Response(null, { status: 302, headers: { Location: "http://10.0.0.1/" } }) : new Response("ok"));
    try {
      await evaluate(site, { type: "exit_intent" });
      const rows = await webhookRows(a.id);
      expect(rows![0]).toMatchObject({ success: false, status_code: 302, attempt_count: 1 });
      expect(sent.filter((s) => s.url.startsWith("http://10.")).length).toBe(0);
    } finally {
      reply = () => new Response("ok", { status: 200 });
    }
  });

  // The trigger endpoint is public: a script inventing visitors must not make the server call
  // the owner's webhook without end. Past the cap the run is logged as failed, not sent.
  it("caps webhook calls per automation per minute, without starving other automations", async () => {
    const { owner, site } = await ownerWithSite();
    const url = `https://hooks.example.com/cap-${randomUUID()}`;
    const a = await createAutomation(owner.token, site.id, { definition: webhookDef(url) });
    const otherUrl = `https://hooks.example.com/other-${randomUUID()}`;
    const other = await seedWebsite(owner.id);
    const b = await createAutomation(owner.token, other.id, { definition: webhookDef(otherUrl) });

    for (let i = 0; i < 5; i++) await evaluate(site, { type: "exit_intent" });
    await evaluate(other, { type: "exit_intent" });

    await webhookRows(a.id, 3);
    await webhookRows(b.id, 1);
    expect(sent.filter((s) => s.url === url)).toHaveLength(3);
    expect(sent.filter((s) => s.url === otherUrl)).toHaveLength(1);
    const limited = await eventually(async () => {
      const r = await sql`SELECT 1 FROM automation_events WHERE automation_id = ${a.id}::uuid AND record_type = 'action' AND status = 'failed' AND error_message LIKE 'rate limited%'`;
      return r.length === 2 ? r : null;
    });
    expect(limited).toHaveLength(2);
  });

  it("calls nothing for a crawler", async () => {
    const { owner, site } = await ownerWithSite();
    const url = `https://hooks.example.com/bot-${randomUUID()}`;
    const a = await createAutomation(owner.token, site.id, { definition: webhookDef(url) });

    await evaluate(site, { type: "exit_intent" }, { ua: CRAWLER_UA });
    await new Promise((r) => setTimeout(r, 100));

    expect(sent.some((s) => s.url === url)).toBe(false);
    expect(await sql`SELECT 1 FROM webhook_deliveries WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });
});

describe("client-side triggers through /collect", () => {
  // With consent: a trigger row carries the visitor and session, which need it.
  function collect(site: SeededWebsite, automations: unknown[], ua = BROWSER_UA, consent = true) {
    return api("POST", "/api/v1/tracker/collect", {
      headers: pageHeaders(site, ua),
      body: { website_id: site.trackingId, batch_id: randomUUID(), consent, automations },
    });
  }
  const trigger = (automationId: string, over: Record<string, unknown> = {}) => ({
    type: "automation_trigger",
    ts: Date.now(),
    url: "https://x/pricing",
    sid: "s-collect",
    vid: "v-collect",
    data: { automation_id: automationId, event: "shown" },
    ...over,
  });
  /** Buffers onto the durable queue, then the queue into the tables. */
  const flush = () => application().modules.ingest.stop?.();
  const triggerRows = (id: string, n: number) =>
    eventually(async () => {
      await flush();
      const r = await sql`SELECT record_type, status, trigger_event, visitor_id, session_id, page_url FROM automation_events WHERE automation_id = ${id}::uuid`;
      return r.length >= n ? r : null;
    }, 5000);

  // The queued row's `occurredAt` is a Date, but the durable queue stores rows as JSON: at apply
  // time it is a string, `r.occurredAt.getTime()` throws (automation-batch.repository.ts:105),
  // and every batch is retried and parked. No client trigger reaches automation_events.
  it("stores client automation triggers sent through /collect, after the durable queue", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);

    const res = await collect(site, [trigger(a.id)]);

    expect(res.status).toBe(200);
    expect([...(await triggerRows(a.id, 1))!]).toEqual([
      { record_type: "client_trigger", status: "triggered", trigger_event: "shown", visitor_id: "v-collect", session_id: "s-collect", page_url: "https://x/pricing" },
    ]);
  });

  // A page could name any automation id; only its own site's active ones may be charged.
  // Blocked by the bug above: until a valid trigger is stored, "dropped" cannot be told from "lost".
  it("drops triggers naming another site's automation or an inactive one", async () => {
    const { owner, site } = await ownerWithSite();
    const mine = await createAutomation(owner.token, site.id);
    const inactive = await insertAutomation(site.id, owner.id, definition(), false);
    const victim = await ownerWithSite();
    const theirs = await createAutomation(victim.owner.token, victim.site.id);

    await collect(site, [trigger(theirs.id), trigger(inactive), trigger(mine.id), trigger("not-a-uuid")]);
    await triggerRows(mine.id, 1);

    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${theirs.id}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${inactive}::uuid`).toHaveLength(0);
  });

  it("ignores a crawler's triggers", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);

    const res = await collect(site, [trigger(a.id)], CRAWLER_UA);
    await flush();

    expect(res.body).toEqual({ status: "ok", message: "ignored" });
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });

  it("records nothing for a visitor who has not consented", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);

    const res = await collect(site, [trigger(a.id)], BROWSER_UA, false);
    await flush();

    expect(res.status).toBe(200);
    // Stripped before routing: nothing reaches the queue.
    expect(res.body.message).toBe("nothing to process");
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });

  it("records nothing when the site has automations switched off", async () => {
    const { owner, site } = await ownerWithSite();
    const a = await createAutomation(owner.token, site.id);
    await sql`UPDATE websites SET automation_enabled = false WHERE id = ${site.id}::uuid`;

    const res = await collect(site, [trigger(a.id)]);
    await flush();

    expect(res.body).toMatchObject({ status: "ok", queued: 0 });
    expect(await sql`SELECT 1 FROM automation_events WHERE automation_id = ${a.id}::uuid`).toHaveLength(0);
  });
});
