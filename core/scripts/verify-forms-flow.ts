import { randomUUID } from "node:crypto";
import { Hono } from "hono";
/**
 * Drives a form submission through the real modules and a real Postgres: capture, the outbox,
 * the worker, retries, routing and erasure, against a webhook receiver it starts itself.
 *
 *   DATABASE_URL=postgres://… bun run verify:forms-flow
 *
 * Needs a scratch database that has been through the core migrations. It creates one website
 * and removes it when done. Real transport is used except for the public-address check, which
 * would rightly refuse the local receiver.
 */
const { sql } = await import("../db");
const { Vault } = await import("../modules/integrations/lib/vault");
const { OutboxService } = await import("../modules/integrations/services/outbox.service");
const { DeliveryAttemptService, credentialContext } = await import("../modules/integrations/services/delivery-attempt.service");
const { DeliveryWorker } = await import("../modules/integrations/services/delivery-worker.service");
const { ConnectionService } = await import("../modules/integrations/services/connection.service");
const { LeadCaptureService } = await import("../modules/leads/services/lead-capture.service");
const { SubmissionQueryService } = await import("../modules/leads/services/submission-query.service");
const { SubmissionMutationService } = await import("../modules/leads/services/submission-mutation.service");
const { createLeadTrackerRoutes } = await import("../modules/leads/tracker-routes");
const conn = await import("../modules/integrations/repositories/connection.repository");

let failed = 0;
const ok = (c: unknown, m: string) => { if (!c) { failed++; console.log("FAIL", m); } else console.log("ok  ", m); };

const W = randomUUID(), AUTO = randomUUID();
await sql`INSERT INTO websites (id, user_id, name, url, tracking_id) VALUES (${W}::uuid, ${randomUUID()}::uuid, 'e2e', 'example.com', ${"e2e-" + W})`;

// A webhook receiver we control.
const received: Array<{ path: string; headers: Record<string, string>; body: any }> = [];
let behaviour: Record<string, number[]> = {};
const server = Bun.serve({ port: 0, async fetch(req) {
  const path = new URL(req.url).pathname;
  received.push({ path, headers: Object.fromEntries(req.headers), body: await req.json().catch(() => null) });
  const queue = behaviour[path] ?? [];
  return new Response("{}", { status: queue.length ? queue.shift()! : 200 });
} });
const base = `http://localhost:${server.port}`;

const vault = new Vault({ current: Buffer.alloc(32, 3).toString("base64"), previous: [] });
// Real transport, minus the public-address check that would (rightly) refuse localhost.
const ctx = { async request(r: any) { const res = await fetch(r.url.replace("https://hooks.test", base), { method: r.method, headers: r.headers, body: r.body, redirect: "manual" }); return { status: res.status, text: await res.text() }; }, async assertPublicUrl() {} };
const resolution = { vault, ephemeralDevKey: false };

async function addHook(name: string, path: string): Promise<string> {
  const id = randomUUID();
  await conn.insertConnection({ id, websiteId: W, provider: "zapier", name, credentials: vault.encrypt(JSON.stringify({ webhook_url: `https://hooks.test${path}` }), credentialContext(W, id)), hint: "abcd", config: {} });
  return id;
}
const hookA = await addHook("Slack", "/a");
const hookB = await addHook("Sheet", "/b");

let routing: { destinations: string[] | null } = { destinations: null };
const directory = { names: async (_w: string, ids: string[]) => new Map(ids.filter((i) => i === AUTO).map((i) => [i, "Popup"])), rewards: async () => null, routing: async () => routing };
const worker = new DeliveryWorker(new DeliveryAttemptService(resolution, ctx), undefined, 60_000);
const sink = new OutboxService(() => worker.kick());
const capture = new LeadCaptureService(directory as any, sink);
const queries = new SubmissionQueryService(sink);
const mutations = new SubmissionMutationService(sink);
const connections = new ConnectionService(resolution, ctx);
worker.start();

const app = new Hono().route("/leads", createLeadTrackerRoutes({ capture, trackerWebsites: { resolve: async () => ({ id: W, url: "example.com", is_active: true, automation_enabled: true }) } as any }));
const submit = (email: string) => app.request("/leads", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ website_id: W, email, name: "Jane Doe", consent: true, automation_id: AUTO, fields: { company: "Acme" } }) });
const settle = async (ms = 300) => { await new Promise((r) => setTimeout(r, ms)); };
const deliveryRows = async () => [...await sql`SELECT d.status, d.attempt_count, d.payload IS NOT NULL AS has_payload, c.name FROM integration_deliveries d JOIN integration_connections c ON c.id = d.connection_id WHERE d.website_id = ${W}::uuid ORDER BY c.name`];

// 1. happy path, both destinations
let res = await submit("one@example.com");
ok(res.status === 200 && (await res.json()).status === "ok", "visitor gets ok");
await settle();
ok(received.length === 2 && received.every((r) => r.body.email === "one@example.com" && r.body.event === "lead.captured"), "both webhooks received the lead");
ok(received[0]!.headers["idempotency-key"] === received[0]!.body.submission_id && received[0]!.headers["x-seentics-delivery"], "idempotency key and delivery id sent");
let rows = await deliveryRows();
ok(rows.every((r: any) => r.status === "success" && !r.has_payload), "deliveries succeeded and payloads cleared: " + JSON.stringify(rows));
let list = await queries.listSubmissions(W, AUTO, { search: "", limit: 10, offset: 0 });
ok(list.total === 1 && list.submissions[0]!.deliveries.length === 2 && list.submissions[0]!.deliveries.every((d: any) => d.status === "success"), "submission list shows per-destination delivery");
ok(list.submissions[0]!.email === "one@example.com" && list.submissions[0]!.fields.company === "Acme", "submission stored with answers");

// 2. routed to one destination only
received.length = 0; routing = { destinations: [hookB] };
await submit("two@example.com"); await settle();
ok(received.length === 1 && received[0]!.path === "/b", "form routed to the destination it names");
routing = { destinations: [] };
received.length = 0;
res = await submit("none@example.com"); await settle();
ok(res.status === 200 && received.length === 0, "form routed nowhere: stored, nothing sent, visitor still ok");
ok((await queries.listSubmissions(W, AUTO, { search: "none@", limit: 10, offset: 0 })).total === 1, "…and still listed on the form page");
routing = { destinations: null };

// 3. retry: A answers 503 once, then 200
received.length = 0; behaviour = { "/a": [503] };
await submit("three@example.com"); await settle();
rows = await deliveryRows();
const a3 = (await sql`SELECT d.status, d.attempt_count, d.next_attempt_at > now() AS future FROM integration_deliveries d JOIN integration_connections c ON c.id = d.connection_id WHERE d.website_id = ${W}::uuid AND c.name = 'Slack' ORDER BY d.created_at DESC LIMIT 1`)[0];
ok(a3.status === "pending" && a3.attempt_count === 1 && a3.future, "503 leaves it pending with a retry in the future");
const b3 = rows.find((r: any) => r.name === "Sheet" && r.status === "success");
ok(!!b3, "the other destination was not held up");
await sql`UPDATE integration_deliveries SET next_attempt_at = now() WHERE website_id = ${W}::uuid AND status = 'pending'`;
worker.kick(); await settle();
ok((await sql`SELECT count(*)::int c FROM integration_deliveries WHERE website_id = ${W}::uuid AND status = 'pending'`)[0].c === 0, "after the delay the retry goes out and succeeds");
ok(received.filter((r) => r.path === "/a").length === 2 && new Set(received.filter((r) => r.path === "/a").map((r) => r.headers["idempotency-key"])).size === 1, "the retry carries the same idempotency key");

// 4. permanent failure + manual retry
received.length = 0; behaviour = { "/b": [400] };
await submit("four@example.com"); await settle();
const failedRow = (await sql`SELECT d.id, d.status, d.payload IS NOT NULL AS has_payload, d.error FROM integration_deliveries d JOIN integration_connections c ON c.id = d.connection_id WHERE d.website_id = ${W}::uuid AND c.name = 'Sheet' ORDER BY d.created_at DESC LIMIT 1`)[0];
ok(failedRow.status === "failed" && failedRow.has_payload && /400/.test(failedRow.error), "a 400 fails for good and keeps the payload for a manual retry: " + failedRow.error);
const retried = await connections.retryDelivery(W, failedRow.id);
ok(retried.ok, "retryDelivery accepted"); await settle(); worker.kick(); await settle();
ok((await sql`SELECT status FROM integration_deliveries WHERE id = ${failedRow.id}::uuid`)[0].status === "success", "manual retry delivered it");

// 5. erase a submission with a pending delivery
await conn.updateConnection(W, hookA, { enabled: true });
behaviour = { "/a": [500, 500, 500, 500, 500, 500, 500] };
received.length = 0;
await capture.capture({ websiteId: W, email: "erase@example.com", name: "", phone: "", consent: true, fields: {}, anonymousId: null, sessionId: null, automationId: AUTO, variant: null, pageUrl: "", referrer: "" }); await settle();
const toErase = (await queries.listSubmissions(W, AUTO, { search: "erase@", limit: 5, offset: 0 })).submissions[0]!;
ok(toErase.deliveries.some((d: any) => d.status === "pending"), "a pending delivery exists");
ok(await mutations.deleteSubmission(W, AUTO, toErase.id), "deleted");
ok((await sql`SELECT count(*)::int c FROM integration_deliveries WHERE submission_id = ${toErase.id}::uuid AND status = 'pending'`)[0].c === 0, "its pending deliveries were cancelled");
ok((await sql`SELECT count(*)::int c FROM integration_deliveries WHERE submission_id = ${toErase.id}::uuid AND payload IS NOT NULL`)[0].c === 0, "no payload of it remains");

// 6. a queueing failure fails the request and leaves no stored row
const before = (await sql`SELECT count(*)::int c FROM form_submissions WHERE website_id = ${W}::uuid`)[0].c;
const broken = new LeadCaptureService(directory as any, { ...sink, enqueue: async () => { throw new Error("db down"); }, kick() {}, statuses: sink.statuses.bind(sink), forget: sink.forget.bind(sink) } as any);
let threw = false; try { await broken.capture({ websiteId: W, email: "x@example.com", name: "", phone: "", consent: false, fields: {}, anonymousId: null, sessionId: null, automationId: AUTO, variant: null, pageUrl: "", referrer: "" }); } catch { threw = true; }
ok(threw && (await sql`SELECT count(*)::int c FROM form_submissions WHERE website_id = ${W}::uuid`)[0].c === before, "enqueue failure → error, and the stored row is withdrawn");

// 7. stop() drains
await worker.stop();
await sql`DELETE FROM websites WHERE id = ${W}::uuid`;
server.stop(true);
console.log(failed ? `\n${failed} FAILED` : "\nALL OK");
await sql.end();
process.exit(failed ? 1 : 0);
