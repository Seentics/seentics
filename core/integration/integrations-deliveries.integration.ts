// Must load first: replaces outbound HTTP and DNS before the app is composed.
import { dns, hookUrl, receiver } from "./helpers/integrations";
import { describe, expect, it } from "bun:test";
import { createHmac, randomUUID } from "node:crypto";
import { env } from "../config";
import { addMember, api, application, seedUser, seedWebsite, sql, type SeededWebsite } from "./harness";
import { createProviderContext } from "../modules/integrations/lib/http";
import { resolveVault } from "../modules/integrations/lib/vault";
import { DeliveryAttemptService } from "../modules/integrations/services/delivery-attempt.service";
import { DeliveryWorker } from "../modules/integrations/services/delivery-worker.service";
import { LEASE_SECONDS, type ClaimedDelivery } from "../modules/integrations/repositories/delivery.repository";

/**
 * The production worker and attempt service, claiming only this site's rows: other test files
 * share the outbox table, and their pending rows are not ours to deliver.
 */
async function runWorker(websiteId: string) {
  const claim = async (limit: number) => [...await sql<ClaimedDelivery[]>`
    WITH due AS (
      SELECT d.id FROM integration_deliveries d
      JOIN integration_connections c ON c.id = d.connection_id
      WHERE d.website_id = ${websiteId}::uuid AND d.status = 'pending' AND d.next_attempt_at <= NOW()
        AND (d.locked_until IS NULL OR d.locked_until < NOW()) AND c.enabled
      ORDER BY d.next_attempt_at LIMIT ${limit} FOR UPDATE OF d SKIP LOCKED
    ), claimed AS (
      UPDATE integration_deliveries d SET locked_until = NOW() + make_interval(secs => ${LEASE_SECONDS})
      FROM due WHERE d.id = due.id
      RETURNING d.id, d.connection_id, d.website_id, d.submission_id, d.automation_id, d.payload, d.attempt_count
    )
    SELECT claimed.*, c.provider, c.credentials, c.config FROM claimed JOIN integration_connections c ON c.id = claimed.connection_id`];
  await new DeliveryWorker(new DeliveryAttemptService(resolveVault(env()), createProviderContext()), claim).tick();
}

async function siteWithHook(extra: Record<string, unknown> = {}) {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  const c = await connect(owner.token, site.id, extra);
  return { owner, site, ...c };
}

async function connect(token: string, websiteId: string, extra: Record<string, unknown> = {}) {
  const hook = hookUrl();
  const res = await api("POST", `/api/v1/integrations/${websiteId}/connections`, {
    token, body: { provider: "zapier", credentials: { webhook_url: hook.url, ...extra } },
  });
  expect(res.status).toBe(201);
  return { connectionId: res.body.data.id as string, hook };
}

/** What the tracker posts when a visitor fills in a popup form. */
function submit(site: SeededWebsite, body: Record<string, unknown> = {}) {
  return api("POST", "/api/v1/tracker/leads", {
    headers: { Origin: `https://${site.domain}` },
    body: { website_id: site.trackingId, email: `lead-${randomUUID().slice(0, 6)}@example.com`, name: "Jane Q Doe", consent: true, ...body },
  });
}

type Row = { id: string; status: string; attempt_count: number; payload: any; error: string | null; http_status: number | null;
  next_attempt_at: string; submission_id: string; connection_id: string };
const deliveriesOf = (websiteId: string) =>
  sql<Row[]>`SELECT id::text, status, attempt_count, payload, error, http_status, next_attempt_at, submission_id::text, connection_id::text
             FROM integration_deliveries WHERE website_id = ${websiteId}::uuid ORDER BY created_at`;

/** A popup automation whose form routes to `destinations`, so a lead can be attributed and erased. */
async function seedForm(site: SeededWebsite, destinations?: string[]) {
  const definition = { graph: { nodes: [{ id: "a1", kind: "action", action: { type: "show_modal", form: destinations ? { destinations } : {} } }] } };
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO automations (website_id, user_id, name, definition)
    VALUES (${site.id}::uuid, ${site.ownerId}::uuid, 'Popup', ${JSON.stringify(definition)}::jsonb) RETURNING id::text`;
  return row!.id;
}

describe("a captured lead enters the outbox", () => {
  it("queues one pending delivery per enabled destination, holding the lead until it is sent", async () => {
    const { owner, site, connectionId } = await siteWithHook();
    const off = await connect(owner.token, site.id);
    await api("PATCH", `/api/v1/integrations/${site.id}/connections/${off.connectionId}`, { token: owner.token, body: { enabled: false } });

    const res = await submit(site, { email: "Jane@Example.com", fields: { company: "Acme" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    const rows = await deliveriesOf(site.id);
    expect(rows.map((r) => [r.connection_id, r.status])).toEqual([[connectionId, "pending"]]);
    expect(rows[0]!.payload).toMatchObject({ email: "jane@example.com", firstName: "Jane", lastName: "Q Doe", consent: true, fields: { company: "Acme" } });
  });

  it("queues nothing for a honeypot hit", async () => {
    const { site } = await siteWithHook();

    const res = await submit(site, { hp: "i am a bot" });

    expect(res.body).toEqual({ status: "ok" });
    expect(await deliveriesOf(site.id)).toHaveLength(0);
  });

  it("sends a form's lead only to the destinations the form names", async () => {
    const { owner, site, connectionId: first } = await siteWithHook();
    const { connectionId: second } = await connect(owner.token, site.id);
    const formId = await seedForm(site, [second]);

    await submit(site, { automation_id: formId });

    expect((await deliveriesOf(site.id)).map((r) => r.connection_id)).toEqual([second]);
    expect(first).not.toBe(second);
  });
});

describe("the delivery worker", () => {
  it("posts the lead to the webhook, signed and de-duplicable, then drops the stored copy", async () => {
    const { site, hook, connectionId } = await siteWithHook({ signing_secret: "sign-me-please" });
    await submit(site, { email: "ann@example.com" });
    const [queued] = await deliveriesOf(site.id);

    await runWorker(site.id);

    const sent = receiver.to(hook.marker).filter((r) => JSON.parse(r.body).event === "lead.captured");
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!.body)).toMatchObject({ email: "ann@example.com", submission_id: queued!.submission_id, test: false });
    // Delivery is at-least-once, so receivers de-duplicate on these.
    expect(sent[0]!.headers["idempotency-key"]).toBe(queued!.submission_id);
    expect(sent[0]!.headers["x-seentics-delivery"]).toBe(queued!.id);
    const expected = createHmac("sha256", "sign-me-please").update(sent[0]!.body).digest("hex");
    expect(sent[0]!.headers["x-seentics-signature"]).toBe(`sha256=${expected}`);

    const [done] = await deliveriesOf(site.id);
    expect(done).toMatchObject({ status: "success", attempt_count: 1, http_status: 200, payload: null });
    const [conn] = await sql<{ last_success_at: Date | null }[]>`SELECT last_success_at FROM integration_connections WHERE id = ${connectionId}::uuid`;
    expect(conn!.last_success_at).not.toBeNull();
  });

  it("schedules a retry for a provider outage and does not resend before it is due", async () => {
    const { site, hook } = await siteWithHook();
    await submit(site);
    receiver.replies.set(hook.marker, { status: 503, body: "down" });

    await runWorker(site.id);
    await runWorker(site.id);

    const [row] = await deliveriesOf(site.id);
    expect(row).toMatchObject({ status: "pending", attempt_count: 1, http_status: 503 });
    expect(row!.payload).not.toBeNull();
    // First retry is about 30 seconds out.
    const wait = new Date(row!.next_attempt_at).getTime() - Date.now();
    expect(wait).toBeGreaterThan(20_000);
    expect(wait).toBeLessThan(40_000);
    expect(receiver.to(hook.marker).filter((r) => JSON.parse(r.body).event === "lead.captured")).toHaveLength(1);
  });

  it("parks a delivery after its last attempt, keeping the lead so the owner can retry it", async () => {
    const { owner, site, hook } = await siteWithHook();
    await submit(site);
    receiver.replies.set(hook.marker, { status: 500 });
    await sql`UPDATE integration_deliveries SET attempt_count = 5 WHERE website_id = ${site.id}::uuid`;

    await runWorker(site.id);

    const [parked] = await deliveriesOf(site.id);
    expect(parked).toMatchObject({ status: "failed", attempt_count: 6, http_status: 500 });
    expect(parked!.payload).not.toBeNull();

    const retry = await api("POST", `/api/v1/integrations/${site.id}/deliveries/${parked!.id}/retry`, { token: owner.token });
    expect(retry.status).toBe(200);
    expect((await deliveriesOf(site.id))[0]).toMatchObject({ status: "pending", attempt_count: 0, error: null });

    receiver.replies.delete(hook.marker);
    await runWorker(site.id);
    expect((await deliveriesOf(site.id))[0]).toMatchObject({ status: "success", payload: null });
  });

  it("gives up at once on a refused credential and switches the destination off", async () => {
    const { owner, site, hook, connectionId } = await siteWithHook();
    await submit(site);
    await submit(site);
    receiver.replies.set(hook.marker, { status: 401, body: "nope" });

    await runWorker(site.id);

    const rows = await deliveriesOf(site.id);
    // The first refusal disables it; the second lead, claimed in the same round, is refused too.
    expect(rows.every((r) => r.status === "failed")).toBe(true);
    const [conn] = await sql<{ enabled: boolean; status: string }[]>`SELECT enabled, status FROM integration_connections WHERE id = ${connectionId}::uuid`;
    expect(conn).toEqual({ enabled: false, status: "error" });

    // A retry behind a disabled destination would sit there looking active.
    const retry = await api("POST", `/api/v1/integrations/${site.id}/deliveries/${rows[0]!.id}/retry`, { token: owner.token });
    expect(retry.status).toBe(400);
  });

  it("switches a destination off after five leads in a row give up", async () => {
    const { site, hook, connectionId } = await siteWithHook();
    await sql`UPDATE integration_connections SET consecutive_failures = 4 WHERE id = ${connectionId}::uuid`;
    await submit(site);
    receiver.replies.set(hook.marker, { status: 400, body: "bad payload" });

    await runWorker(site.id);

    const [conn] = await sql<{ enabled: boolean; consecutive_failures: number }[]>`
      SELECT enabled, consecutive_failures FROM integration_connections WHERE id = ${connectionId}::uuid`;
    expect(conn).toEqual({ enabled: false, consecutive_failures: 5 });
  });

  it("leaves a disabled destination's queue alone until it is switched back on", async () => {
    const { owner, site, hook, connectionId } = await siteWithHook();
    await submit(site);
    await sql`UPDATE integration_connections SET enabled = false WHERE id = ${connectionId}::uuid`;

    await runWorker(site.id);
    expect((await deliveriesOf(site.id))[0]!.status).toBe("pending");

    await api("PATCH", `/api/v1/integrations/${site.id}/connections/${connectionId}`, { token: owner.token, body: { enabled: true } });
    await runWorker(site.id);
    expect((await deliveriesOf(site.id))[0]!.status).toBe("success");
    expect(receiver.to(hook.marker).filter((r) => JSON.parse(r.body).event === "lead.captured")).toHaveLength(1);
  });

  it("refuses to send once the webhook host resolves to a private address, and retries later", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const host = `rebind-${randomUUID().slice(0, 8)}.receiver.example`;
    dns.set(host, ["93.184.216.34"]);
    const hook = hookUrl(host);
    const res = await api("POST", `/api/v1/integrations/${site.id}/connections`, {
      token: owner.token, body: { provider: "zapier", credentials: { webhook_url: hook.url } },
    });
    expect(res.status).toBe(201);
    await submit(site);
    dns.set(host, ["127.0.0.1"]);

    await runWorker(site.id);

    const [row] = await deliveriesOf(site.id);
    expect(row).toMatchObject({ status: "pending", attempt_count: 1 });
    expect(row!.error).toContain("non-public");
    expect(receiver.to(hook.marker)).toHaveLength(1); // only the verification at connect time
  });

  it("never stores the webhook URL when the provider echoes it in an error", async () => {
    const { site, hook } = await siteWithHook();
    await submit(site);
    receiver.replies.set(hook.marker, { status: 422, body: JSON.stringify({ message: `rejected ${hook.url}` }) });

    await runWorker(site.id);

    const [row] = await deliveriesOf(site.id);
    expect(row!.status).toBe("failed");
    expect(row!.error).toContain("[redacted]");
    expect(row!.error).not.toContain(hook.marker);
  });
});

describe("the delivery log", () => {
  it("lists deliveries without the lead's data, filterable by status and destination", async () => {
    const { owner, site, connectionId, hook } = await siteWithHook();
    await submit(site, { email: "visible@example.com" });
    await submit(site);
    receiver.replies.set(hook.marker, { status: 400 });
    await runWorker(site.id);
    await submit(site);

    const all = await api("GET", `/api/v1/integrations/${site.id}/deliveries`, { token: owner.token });
    expect(all.status).toBe(200);
    expect(all.body.data.deliveries).toHaveLength(3);
    expect(all.text).not.toContain("visible@example.com");

    const pending = await api("GET", `/api/v1/integrations/${site.id}/deliveries`, { token: owner.token, query: { status: "pending" } });
    expect(pending.body.data.deliveries).toHaveLength(1);
    expect(pending.body.data.deliveries[0].next_attempt_at).not.toBeNull();
    const byConn = await api("GET", `/api/v1/integrations/${site.id}/deliveries`, { token: owner.token, query: { connection_id: connectionId, limit: 2 } });
    expect(byConn.body.data.deliveries).toHaveLength(2);
  });

  it("validates its query and limits who may read and retry", async () => {
    const { owner, site } = await siteWithHook();
    const viewer = await seedUser();
    const stranger = await seedUser();
    await addMember(site.id, viewer.id, "viewer");
    const path = `/api/v1/integrations/${site.id}/deliveries`;

    const queries: Record<string, string | number>[] = [{ limit: 0 }, { limit: 101 }, { status: "lost" }, { connection_id: "x" }];
    for (const query of queries) {
      expect((await api("GET", path, { token: owner.token, query })).status).toBe(400);
    }
    expect((await api("GET", path)).status).toBe(401);
    expect((await api("GET", path, { token: stranger.token })).status).toBe(403);
    expect((await api("GET", path, { token: viewer.token })).status).toBe(200);
    expect((await api("POST", `${path}/${randomUUID()}/retry`, { token: viewer.token })).status).toBe(403);
    expect((await api("POST", `${path}/not-a-uuid/retry`, { token: owner.token })).status).toBe(404);
  });

  it("only retries a failed delivery of the caller's own site", async () => {
    const { owner, site, hook } = await siteWithHook();
    await submit(site);
    receiver.replies.set(hook.marker, { status: 400 });
    await runWorker(site.id);
    const [failed] = await deliveriesOf(site.id);
    const other = await siteWithHook();
    await submit(other.site);
    await runWorker(other.site.id);
    const [delivered] = await deliveriesOf(other.site.id);

    expect((await api("POST", `/api/v1/integrations/${other.site.id}/deliveries/${failed!.id}/retry`, { token: other.owner.token })).status).toBe(404);
    expect((await api("POST", `/api/v1/integrations/${other.site.id}/deliveries/${delivered!.id}/retry`, { token: other.owner.token })).status).toBe(404);
    expect((await deliveriesOf(site.id))[0]!.status).toBe("failed");
    void owner;
  });

  it("goes with its destination when that is removed", async () => {
    const { owner, site, connectionId } = await siteWithHook();
    await submit(site);

    await api("DELETE", `/api/v1/integrations/${site.id}/connections/${connectionId}`, { token: owner.token });

    expect(await deliveriesOf(site.id)).toHaveLength(0);
  });
});

describe("erasing a submission", () => {
  it("cancels what is still waiting and clears the lead from deliveries that failed", async () => {
    const { owner, site, hook } = await siteWithHook();
    const second = await connect(owner.token, site.id);
    const formId = await seedForm(site);
    await submit(site, { automation_id: formId, email: "erase-me@example.com" });
    // One destination gives up (keeping the payload for a retry); the other stays pending.
    await sql`UPDATE integration_connections SET enabled = false WHERE id = ${second.connectionId}::uuid`;
    receiver.replies.set(hook.marker, { status: 400 });
    await runWorker(site.id);
    await sql`UPDATE integration_connections SET enabled = true WHERE id = ${second.connectionId}::uuid`;
    const before = await deliveriesOf(site.id);
    expect(before.map((r) => r.status).sort()).toEqual(["failed", "pending"]);
    const submissionId = before[0]!.submission_id;

    const res = await api("DELETE", `/api/v1/leads/${site.id}/forms/${formId}/submissions/${submissionId}`, { token: owner.token });

    expect(res.status).toBe(200);
    const after = await deliveriesOf(site.id);
    expect(after.map((r) => [r.status, r.payload])).toEqual([["failed", null]]);
    expect(JSON.stringify(await sql`SELECT payload FROM integration_deliveries WHERE website_id = ${site.id}::uuid`)).not.toContain("erase-me");
  });
});

describe("retention", () => {
  it("ages out old history, expires leads never delivered within 30 days, and scrubs old failures", async () => {
    const { site, connectionId } = await siteWithHook();
    const ins = (status: string, age: string, completedAge: string | null) => sql<{ id: string }[]>`
      INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload, status, created_at, completed_at)
      VALUES (${connectionId}::uuid, ${site.id}::uuid, ${randomUUID()}::uuid, '{"email":"old@example.com"}'::jsonb, ${status},
              NOW() - ${age}::interval, ${completedAge === null ? null : sql`NOW() - ${completedAge}::interval`})
      RETURNING id::text`;
    const [ancient] = await ins("success", "400 days", "400 days");
    const [stale] = await ins("pending", "31 days", null);
    const [oldFailure] = await ins("failed", "40 days", "35 days");
    const [fresh] = await ins("pending", "1 day", null);

    const counts = await application().modules.integrations.retention.purge(
      { websiteId: site.id },
      { analytics: new Date(), funnelAutomation: new Date(Date.now() - 365 * 86_400_000), replay: new Date(), heatmap: new Date() } as never,
      { batchSize: 1000 } as never,
    );

    expect(counts).toEqual({ integrationDeliveryRows: 1, integrationDeliveriesExpired: 1, integrationPayloadsCleared: 1 });
    const rows = new Map((await deliveriesOf(site.id)).map((r) => [r.id, r]));
    expect(rows.has(ancient!.id)).toBe(false);
    expect(rows.get(stale!.id)).toMatchObject({ status: "failed", payload: null });
    expect(rows.get(stale!.id)!.error).toContain("Expired");
    expect(rows.get(oldFailure!.id)).toMatchObject({ status: "failed", payload: null });
    expect(rows.get(fresh!.id)!.payload).toEqual({ email: "old@example.com" });
  });
});
