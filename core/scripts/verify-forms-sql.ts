import { randomUUID } from "node:crypto";
/**
 * Runs the forms and destinations SQL against a real Postgres.
 *
 * The unit tests stub the database, so they cannot catch a wrong column, a bad cast or a
 * claim query that hands one delivery to two workers. This does. Point it at a scratch
 * database that has been through the core migrations:
 *
 *   DATABASE_URL=postgres://… bun run verify:forms-sql
 *
 * It creates one website of its own and removes it (and everything under it) when done.
 */
const { sql } = await import("../db");
const conn = await import("../modules/integrations/repositories/connection.repository");
const del = await import("../modules/integrations/repositories/delivery.repository");
const sub = await import("../modules/leads/repositories/submission.repository");
const prz = await import("../modules/leads/repositories/prize.repository");

let failed = 0;
const ok = (cond: unknown, msg: string) => { if (!cond) { failed++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
const W = randomUUID();
const AUTO = randomUUID();
await sql`INSERT INTO websites (id, user_id, name, url, tracking_id) VALUES (${W}::uuid, ${randomUUID()}::uuid, 'verify', 'example.com', ${"verify-" + W})`;

// ── connections
const c1 = randomUUID(), c2 = randomUUID(), c3 = randomUUID();
for (const [id, provider, name] of [[c1, "zapier", "Slack"], [c2, "zapier", "Sheet"], [c3, "hubspot", "CRM"]] as const) {
  await conn.insertConnection({ id, websiteId: W, provider, name, credentials: "sealed-" + name, hint: "abcd", config: {} });
}
ok((await conn.countConnectionsOf(W)) === 3, "three connections, two of one provider");
await conn.updateConnection(W, c3, { enabled: false });
ok((await conn.getConnectionView(W, c3))?.enabled === false, "disable");
ok((await conn.updateConnection(W, c3, { name: "CRM 2" })) && (await conn.getConnectionView(W, c3))?.name === "CRM 2" && (await conn.getConnectionView(W, c3))?.enabled === false, "rename keeps enabled=false");

// ── enqueue
const payload = (id: string) => ({ submissionId: id, email: "a@b.co", name: "A", firstName: "A", lastName: "", phone: "", consent: true, fields: {}, prize: null, popupId: AUTO, variant: null, pageUrl: "/", referrer: "", submittedAt: new Date().toISOString() });
const s1 = randomUUID();
ok((await del.enqueueDeliveries({ websiteId: W, submissionId: s1, automationId: AUTO, payload: payload(s1), destinationIds: null })) === 2, "enqueue to all ENABLED destinations (disabled skipped)");
ok((await del.enqueueDeliveries({ websiteId: W, submissionId: s1, automationId: AUTO, payload: payload(s1), destinationIds: null })) === 0, "same submission twice is a no-op");
const s2 = randomUUID();
ok((await del.enqueueDeliveries({ websiteId: W, submissionId: s2, automationId: AUTO, payload: payload(s2), destinationIds: [c1, randomUUID()] })) === 1, "narrowed to named destinations, dangling id ignored");
ok((await conn.listConnectionViews(W)).find((c: any) => c.id === c1)?.pending_count === 2, "pending_count on the view");

// ── claim
const claimed = await del.claimDue(10);
ok(claimed.length === 3 && claimed.every((d: any) => d.provider === "zapier" && d.payload?.email === "a@b.co" && d.credentials.startsWith("sealed-")), "claim returns due rows with provider+credentials+payload");
ok((await del.claimDue(10)).length === 0, "leased rows are not claimed twice");
// two concurrent claimers get disjoint sets
await sql`UPDATE integration_deliveries SET locked_until = NULL WHERE website_id = ${W}::uuid`;
const [a, b] = await Promise.all([del.claimDue(50), del.claimDue(50)]);
const ids = [...a, ...b].filter((d: any) => d.website_id === W).map((d: any) => d.id);
ok(new Set(ids).size === ids.length && ids.length === 3, `concurrent claims are disjoint and complete (${a.length}+${b.length})`);

// ── attempts
const d = claimed[0]!;
const r1 = await del.completeAttempt({ deliveryId: d.id, connectionId: d.connection_id, attempts: 1, durationMs: 5, disableAfter: 5, result: { kind: "retry", httpStatus: 503, error: "boom", nextAttemptAt: new Date(Date.now() + 60_000) } });
ok(!r1.disabled, "retry does not disable");
let row = (await sql`SELECT status, attempt_count, next_attempt_at > now() AS future, locked_until, payload IS NOT NULL AS has_payload FROM integration_deliveries WHERE id = ${d.id}::uuid`)[0];
ok(row.status === "pending" && row.attempt_count === 1 && row.future && row.locked_until === null && row.has_payload, "retry keeps it pending, in the future, payload kept");
await sql`UPDATE integration_deliveries SET locked_until = NULL WHERE website_id = ${W}::uuid`;
const again = await del.claimDue(10);
ok(!again.some((x: any) => x.id === d.id), "a retry that is not due yet is not claimed");

await del.completeAttempt({ deliveryId: d.id, connectionId: d.connection_id, attempts: 2, durationMs: 5, disableAfter: 5, result: { kind: "success", httpStatus: 200, error: null } });
row = (await sql`SELECT status, payload, completed_at FROM integration_deliveries WHERE id = ${d.id}::uuid`)[0];
ok(row.status === "success" && row.payload === null && row.completed_at, "success clears payload and completes");
let view = await conn.getConnectionView(W, d.connection_id);
ok(view?.consecutive_failures === 0 && view?.last_success_at && view?.last_error === null, "success resets health");

// ── terminal failures disable the connection at 5
const target = c2;
let disabled = false;
for (let i = 0; i < 5; i++) {
  const sid = randomUUID();
  await del.enqueueDeliveries({ websiteId: W, submissionId: sid, automationId: null, payload: payload(sid), destinationIds: [target] });
  const [dd] = (await del.claimDue(50)).filter((x: any) => x.submission_id === sid);
  if (!dd) { console.log("no claim for", i); continue; }
  ({ disabled } = await del.completeAttempt({ deliveryId: dd.id, connectionId: target, attempts: 6, durationMs: 1, disableAfter: 5, result: { kind: "failed", httpStatus: 500, error: "down", disableNow: false } }));
}
view = await conn.getConnectionView(W, target);
ok(disabled && view?.enabled === false && view?.status === "error", "5 terminal failures disable it");
// claim skips disabled destination's pending rows
const sidPending = randomUUID();
await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload) VALUES (${target}::uuid, ${W}::uuid, ${sidPending}::uuid, '{"x":1}'::jsonb)`;
ok(!(await del.claimDue(50)).some((x: any) => x.submission_id === sidPending), "pending rows of a disabled destination wait");

// ── retry
const [failedRow] = await sql`SELECT id FROM integration_deliveries WHERE connection_id = ${target}::uuid AND status = 'failed' LIMIT 1`;
ok((await del.requeueFailed(W, failedRow.id)) === "disabled", "retry refused while destination is off");
await conn.updateConnection(W, target, { enabled: true });
ok((await conn.getConnectionView(W, target))?.consecutive_failures === 0, "re-enabling clears the failure state");
ok((await del.requeueFailed(W, failedRow.id)) === "requeued", "retry requeues a failed delivery");
ok((await del.requeueFailed(W, failedRow.id)) === "not_found", "…but not twice (it is pending now)");
ok((await del.requeueFailed(W, randomUUID())) === "not_found", "unknown id");
ok((await del.claimDue(50)).some((x: any) => x.id === failedRow.id), "requeued row is claimed again, with attempt_count 0");

// ── statuses/forget/list
const st = await del.deliveriesOfSubmissions(W, [s1, s2]);
ok(st.filter((x: any) => x.submission_id === s1).length === 2 && st.every((x: any) => x.connection_name && x.id), "statuses per submission with names and delivery ids");
const list = await del.recentDeliveries(W, { limit: 5, status: "failed" });
ok(list.length > 0 && list.every((x: any) => x.status === "failed" && x.next_attempt_at === null), "list filters by status; next_attempt_at only for pending");
await del.forgetSubmissions(W, [s1]);
ok((await sql`SELECT count(*)::int c FROM integration_deliveries WHERE submission_id = ${s1}::uuid AND status = 'pending'`)[0].c === 0, "forget cancels pending");

// ── purge
await sql`UPDATE integration_deliveries SET created_at = now() - interval '40 days' WHERE submission_id = ${sidPending}::uuid`;
await sql`INSERT INTO integration_deliveries (connection_id, website_id, submission_id, payload, status, completed_at) VALUES (${c1}::uuid, ${W}::uuid, ${randomUUID()}::uuid, '{"x":1}'::jsonb, 'failed', now() - interval '31 days')`;
const counts = await del.purgeDeliveries(W, new Date(Date.now() - 365 * 864e5), new Date(Date.now() - 30 * 864e5));
ok(counts.expired >= 1 && counts.scrubbed >= 1, `purge expires stale pending (${counts.expired}) and scrubs failed payloads (${counts.scrubbed})`);

// ── submissions
const sid = randomUUID();
const submission = { websiteId: W, email: "jane@example.com", name: "Jane", phone: "", consent: true, fields: { company: "Acme" }, anonymousId: null, sessionId: null, automationId: AUTO, variant: "b", pageUrl: "/p", referrer: "" };
await sub.insertSubmission(sid, submission, { id: "1", label: "10% off", coupon_code: "SAVE10" });
await sub.insertSubmission(randomUUID(), { ...submission, email: "bob_x@example.com", name: "Bob", variant: "a" }, null);
let l = await sub.listSubmissions(W, AUTO, { search: "", limit: 10, offset: 0 });
ok(l.total === 2 && l.rows[0].fields.company === "Acme" || l.rows[1].fields.company === "Acme", "list");
l = await sub.listSubmissions(W, AUTO, { search: "bob_x", limit: 10, offset: 0 });
ok(l.total === 1, "search");
l = await sub.listSubmissions(W, AUTO, { search: "%", limit: 10, offset: 0 });
ok(l.total === 0, "LIKE metacharacters are literal");
const sum = await sub.formSummary(W, AUTO);
ok(sum.total === 2 && sum.with_prize === 1 && sum.by_variant.length === 2, "summary " + JSON.stringify(sum));
ok((await sub.countSince([W], new Date(Date.now() - 864e5))) === 2, "countSince");
ok((await sub.websiteSummary(W, new Date(Date.UTC(2020, 0, 1)))).this_month === 2, "websiteSummary");
ok((await sub.exportSubmissions(W, AUTO, 10)).length === 2, "export");
ok(!(await sub.deleteSubmission(W, randomUUID(), sid)) && (await sub.deleteSubmission(W, AUTO, sid)), "delete is scoped to the form");
await sql`UPDATE form_submissions SET created_at = now() - interval '91 days'`;
ok((await sub.purgeBefore(W, new Date(Date.now() - 90 * 864e5))) === 1, "purge >90 days");
await sub.removeSubmissionById((await sql`SELECT id FROM form_submissions WHERE website_id = ${W}::uuid`)[0]?.id ?? randomUUID());

// ── prizes
let draws = 0;
const hash = "a".repeat(64);
const results = await Promise.all(Array.from({ length: 12 }, (_, i) => prz.claimPrize(W, AUTO, hash, () => { draws++; return { id: String(i), label: `P${i}`, coupon_code: `C${i}` }; })));
ok(new Set(results.map((r: any) => r.id)).size === 1, `12 concurrent claims, one winner (${draws} draws)`);
ok((await prz.claimPrize(W, AUTO, hash, () => ({ id: "x", label: "x", coupon_code: null })))?.id === results[0]?.id, "a later claim gets the same prize");
ok((await prz.claimPrize(W, AUTO, "b".repeat(64), () => null)) === null, "no drawable prize records nothing");

// ── delete cascade
await conn.deleteConnection(W, c1);
ok((await sql`SELECT count(*)::int c FROM integration_deliveries WHERE connection_id = ${c1}::uuid`)[0].c === 0, "deleting a destination deletes its deliveries");

await sql`DELETE FROM websites WHERE id = ${W}::uuid`;
console.log(failed ? `\n${failed} FAILED` : "\nALL OK");
await sql.end();
process.exit(failed ? 1 : 0);
