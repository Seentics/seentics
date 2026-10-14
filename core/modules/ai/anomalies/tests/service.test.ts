import { describe, expect, it } from "bun:test";
import type { LlmClient } from "../../interfaces/llm-client.interface";
import { AnomalyExplainer } from "../explain";
import type { AnomalyAlertNotice } from "../present";
import { AnomalyService, MAX_EMAILS_PER_SITE_PER_DAY, gatewayAlertSender, type AnomalyServiceDeps } from "../service";
import { MemoryAnomalyRepository, fakeErrors, fakeTraffic } from "./fakes";

const SITE = "11111111-1111-4111-8111-111111111111";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HOUR = 3_600_000;
// Wednesday 14 Oct 2026, 14:15 UTC.
const NOW = new Date("2026-10-14T14:15:00Z");
/** The end of the last complete hour the run judges. */
const H0 = new Date("2026-10-14T14:00:00Z");

const steady = () => ({ pageviews: 300, visitors: 150 });
/** Steady traffic, except from `from` on, where `then` applies. */
const changeAt = (from: Date, then: { pageviews: number; visitors: number }) => (h: Date) => (h.getTime() >= from.getTime() ? then : steady());

function setup(over: Partial<AnomalyServiceDeps> & { clock?: { now: Date } } = {}) {
  const repo = new MemoryAnomalyRepository();
  const sent: AnomalyAlertNotice[] = [];
  const clock = over.clock ?? { now: NOW };
  const deps: AnomalyServiceDeps = {
    repo,
    traffic: fakeTraffic(steady),
    errors: fakeErrors(),
    describeSite: async (id) => ({ id, name: "Acme", domain: "acme.test", userIds: [OWNER, OWNER] }),
    send: async (n) => { sent.push(n); return {}; },
    explainer: new AnomalyExplainer({ llm: null, model: null }),
    now: () => clock.now,
    ...over,
  };
  return { repo, sent, clock, service: new AnomalyService(deps) };
}

const llm = (content: string): LlmClient & { calls: number } => {
  const c = { calls: 0, complete: async () => { c.calls += 1; return { content, inputTokens: 300, outputTokens: 40 }; }, classify: async () => "" };
  return c;
};
const MODEL = { name: "claude-haiku-5-5", inputCostPerToken: 1e-6, outputCostPerToken: 5e-6 };

describe("AnomalyService: tracking outage", () => {
  it("opens once, mails once, keeps it open while it lasts, and says when it is back to normal", async () => {
    const outage = fakeTraffic(changeAt(new Date(H0.getTime() - 3 * HOUR), { pageviews: 0, visitors: 0 }));
    const { repo, sent, clock, service } = setup({ traffic: outage });

    let stats = await service.runHourly([SITE]);
    expect(stats).toMatchObject({ opened: 1, emailed: 1, outageStorm: false });
    expect(repo.rows).toHaveLength(1);
    const [row] = repo.rows;
    expect(row).toMatchObject({ type: "tracking_outage", severity: "critical", status: "open", notifyStatus: "sent", path: "settings/tracking" });
    // The drop is the outage, not a second alert.
    expect(repo.rows.some((r) => r.type === "traffic_drop")).toBe(false);
    expect(row!.explanation).toContain("tracking script");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "anomaly_alert", state: "open", websiteId: SITE, userIds: [OWNER], anomalyId: row!.id, type: "tracking_outage", path: "settings/tracking" });

    // An hour later, still down: the same row, no new email.
    clock.now = new Date(NOW.getTime() + HOUR);
    stats = await service.runHourly([SITE]);
    expect(stats.opened).toBe(0);
    expect(repo.rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(repo.rows[0]!.lastSeenAt).toBe(clock.now.toISOString());

    // Tracking back: resolved, and "back to normal" goes to the people told it started.
    const recovered = fakeTraffic(steady);
    const back = setup({ traffic: recovered, clock });
    back.repo.rows = repo.rows;
    clock.now = new Date(NOW.getTime() + 2 * HOUR);
    stats = await back.service.runHourly([SITE]);
    expect(stats.resolved).toBe(1);
    expect(back.repo.rows[0]).toMatchObject({ status: "resolved", resolution: "recovered" });
    expect(back.repo.rows[0]!.resolvedNotifiedAt).not.toBeNull();
    expect(back.sent).toHaveLength(1);
    expect(back.sent[0]).toMatchObject({ state: "resolved", anomalyId: row!.id });
  });

  it("does not alert a small site whose quiet hours are normal", async () => {
    const tiny = fakeTraffic((h) => (h.getTime() >= H0.getTime() - 3 * HOUR ? { pageviews: 0, visitors: 0 } : { pageviews: 4, visitors: 2 }));
    const { repo, sent, service } = setup({ traffic: tiny });
    await service.runHourly([SITE]);
    expect(repo.rows).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("holds back outage alerts when many sites go down at once, and pages the operators", async () => {
    const ops: string[] = [];
    const sites = Array.from({ length: 6 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`);
    const { repo, sent, service } = setup({
      traffic: fakeTraffic(changeAt(new Date(H0.getTime() - 3 * HOUR), { pageviews: 0, visitors: 0 })),
      alertOps: async (title) => { ops.push(title); },
    });
    const stats = await service.runHourly(sites);
    expect(stats.outageStorm).toBe(true);
    expect(repo.rows.filter((r) => r.type === "tracking_outage")).toEqual([]);
    expect(sent).toEqual([]);
    expect(ops).toHaveLength(1);
  });
});

describe("AnomalyService: traffic", () => {
  const spike = (pv: number) => fakeTraffic(changeAt(new Date(H0.getTime() - HOUR), { pageviews: pv, visitors: pv / 2 }));

  it("explains a spike with the model's sentence when its numbers are the data's", async () => {
    const model = llm(JSON.stringify({ explanation: "Most of the extra traffic came from google, 30 pageviews against 260 a week earlier." }));
    const { repo, sent, service } = setup({ traffic: spike(3_000), explainer: new AnomalyExplainer({ llm: model, model: MODEL }) });
    await service.runHourly([SITE]);
    const row = repo.rows.find((r) => r.type === "traffic_spike")!;
    expect(row).toMatchObject({ severity: "high", explanationSource: "ai", notifyStatus: "sent" });
    expect(model.calls).toBe(1);
    expect(sent[0]!.explanation).toContain("google");
  });

  it("throws away a model sentence with an invented number (no rule sentence fits a spike here, so none)", async () => {
    const model = llm(JSON.stringify({ explanation: "A newsletter sent to 12,345 subscribers caused it." }));
    const { repo, service } = setup({ traffic: spike(3_000), explainer: new AnomalyExplainer({ llm: model, model: MODEL }) });
    await service.runHourly([SITE]);
    const row = repo.rows.find((r) => r.type === "traffic_spike")!;
    expect(row.explanationSource).toBeNull();
    expect(row.explanation).toBeNull();
  });

  it("shows a low-severity anomaly on the dashboard without mailing it", async () => {
    const { repo, sent, service } = setup({ traffic: spike(1_000) });
    await service.runHourly([SITE]);
    const row = repo.rows.find((r) => r.type === "traffic_spike")!;
    expect(row).toMatchObject({ severity: "low", notifyStatus: "below_severity", notifiedAt: null });
    expect(sent).toEqual([]);
    // High sensitivity mails low severity too.
    const high = setup({ traffic: spike(1_000) });
    high.repo.settings.set(SITE, { enabled: true, sensitivity: "high" });
    await high.service.runHourly([SITE]);
    expect(high.sent).toHaveLength(1);
  });

  it("opens a traffic drop with a rule explanation from the pages and sources that fell", async () => {
    const drop = fakeTraffic(changeAt(new Date(H0.getTime() - 3 * HOUR), { pageviews: 60, visitors: 25 }));
    const { repo, service } = setup({ traffic: drop });
    await service.runHourly([SITE]);
    const row = repo.rows.find((r) => r.type === "traffic_drop")!;
    expect(row).toMatchObject({ status: "open", metric: "visitors", severity: "high", explanationSource: "rules" });
    expect(row.explanation).toBe("The biggest fall is in traffic from google: 30 against 260 at the same time a week earlier.");
    expect(repo.rows.some((r) => r.type === "tracking_outage")).toBe(false);
  });
});

describe("AnomalyService: errors and conversions", () => {
  const surge = {
    fingerprint: "f00d", message: "TypeError: x is undefined", last_page_path: "/checkout/4111111111111111",
    first_seen: new Date(NOW.getTime() - 30 * 60_000).toISOString(), current: 220, sessions: 80, baseline: [0, 0, 0, 0],
  };

  it("opens one alert per error group, and asks for it by name next time so it can resolve", async () => {
    const errors = fakeErrors([surge]);
    const { repo, sent, clock, service } = setup({ errors });
    await service.runHourly([SITE]);
    const row = repo.rows.find((r) => r.type === "error_surge")!;
    expect(row).toMatchObject({ subject: "f00d", severity: "high", path: "errors" });
    expect(row.explanation).toBe("A new error, thrown mostly on /checkout/:id: likely a recent release.");
    expect(sent[0]!.metrics.map((m) => m.label)).toEqual(["Occurrences", "Usual for this time", "Sessions affected"]);

    clock.now = new Date(NOW.getTime() + HOUR);
    const quiet = fakeErrors([{ ...surge, current: 3, sessions: 2 }]);
    const later = setup({ errors: quiet, clock });
    later.repo.rows = repo.rows;
    await later.service.runHourly([SITE]);
    expect(quiet.includes[0]).toEqual(["f00d"]);
    expect(later.repo.rows[0]).toMatchObject({ status: "resolved", resolution: "recovered" });
  });

  it("closes an alerting error the check no longer finds (ignored or deleted) without a 'back to normal' email", async () => {
    const { repo, service, clock } = setup({ errors: fakeErrors([surge]) });
    await service.runHourly([SITE]);
    clock.now = new Date(NOW.getTime() + HOUR);
    const gone = setup({ errors: fakeErrors([]), clock });
    gone.repo.rows = repo.rows;
    await gone.service.runHourly([SITE]);
    expect(gone.repo.rows[0]).toMatchObject({ status: "resolved", resolution: "expired" });
    expect(gone.sent).toEqual([]);
  });

  it("checks conversions once a day, over yesterday", async () => {
    const goals = [{ goalId: "g1", name: "Signup", counts: [2, 40, 38, 42, 40] }];
    const at = (iso: string) => setup({ traffic: fakeTraffic(steady, goals), clock: { now: new Date(iso) } });

    const early = at("2026-10-14T01:15:00Z");
    await early.service.runHourly([SITE]);
    expect(early.repo.rows.map((r) => [r.type, r.subject, r.path])).toEqual([["conversion_drop", "g1", "goals"]]);

    // Other hours do not judge it, so neither open nor close it.
    const later = at("2026-10-14T05:15:00Z");
    later.repo.rows = early.repo.rows;
    await later.service.runHourly([SITE]);
    expect(later.repo.rows[0]!.status).toBe("open");

    const none = at("2026-10-14T05:15:00Z");
    await none.service.runHourly([SITE]);
    expect(none.repo.rows).toEqual([]);
  });
});

describe("AnomalyService: email policy", () => {
  const spikeTraffic = fakeTraffic(changeAt(new Date(H0.getTime() - HOUR), { pageviews: 3_000, visitors: 1_500 }));

  it(`mails at most ${MAX_EMAILS_PER_SITE_PER_DAY} anomalies per site a day`, async () => {
    const { repo, sent, service } = setup({ traffic: spikeTraffic });
    for (let i = 0; i < MAX_EMAILS_PER_SITE_PER_DAY; i++) {
      const earlier = (await repo.open(SITE, { type: "error_surge", subject: `e${i}`, verdict: "anomalous", severity: "high", metric: "errors", observed: 1, expected: 0, score: 1, window: { start: NOW, end: NOW }, title: "t", summary: "s", path: "errors", facts: {} }, new Date(NOW.getTime() - 2 * HOUR)))!;
      await repo.markNotified(earlier.id, "sent", new Date(NOW.getTime() - 2 * HOUR));
      await repo.resolve(earlier.id, "expired", new Date(NOW.getTime() - HOUR));
    }
    await service.runHourly([SITE]);
    expect(repo.rows.find((r) => r.type === "traffic_spike")!.notifyStatus).toBe("rate_limited");
    expect(sent).toEqual([]);
  });

  it("records the gateway's own cap", async () => {
    const { repo, service } = setup({ traffic: spikeTraffic, send: async () => ({ rateLimited: true }) });
    await service.runHourly([SITE]);
    expect(repo.rows.find((r) => r.type === "traffic_spike")).toMatchObject({ notifyStatus: "rate_limited", notifiedAt: null });
  });

  it("does not mail an incident that reopens soon after it recovered (flapping)", async () => {
    const { repo, sent, service } = setup({ traffic: spikeTraffic });
    const old = (await repo.open(SITE, { type: "traffic_spike", subject: "", verdict: "anomalous", severity: "high", metric: "pageviews", observed: 1, expected: 1, score: 1, window: { start: NOW, end: NOW }, title: "t", summary: "s", path: "", facts: {} }, new Date(NOW.getTime() - 3 * HOUR)))!;
    await repo.resolve(old.id, "recovered", new Date(NOW.getTime() - HOUR));
    await service.runHourly([SITE]);
    expect(repo.rows.find((r) => r.status === "open")!.notifyStatus).toBe("flapping");
    expect(sent).toEqual([]);
  });

  it("records but does not mail a snoozed anomaly, and the dashboard says until when", async () => {
    const { repo, sent, service } = setup({ traffic: spikeTraffic });
    const saved = await service.snooze(SITE, { type: "traffic_spike", subject: "*" }, 24, OWNER);
    expect(saved.until).toBe(new Date(NOW.getTime() + 24 * HOUR).toISOString());
    await service.runHourly([SITE]);
    const row = repo.rows.find((r) => r.type === "traffic_spike")!;
    expect(row.notifyStatus).toBe("snoozed");
    expect(sent).toEqual([]);
    const [view] = await service.list(SITE, "open");
    expect(view!.snoozedUntil).toBe(saved.until);
    // Another type is not covered.
    expect(await service.snoozeScopeOf(SITE, row.id)).toEqual({ type: "traffic_spike", subject: row.subject });
    expect(await service.snoozeScopeOf("22222222-2222-4222-8222-222222222222", row.id)).toBeNull();
  });

  it("refuses a snooze longer than a week, and purges ended ones", async () => {
    const { repo, clock, service } = setup();
    await expect(service.snooze(SITE, { type: "*", subject: "*" }, 500, OWNER)).rejects.toThrow("between 1 and");
    await service.snooze(SITE, { type: "*", subject: "*" }, 1, OWNER);
    clock.now = new Date(NOW.getTime() + 2 * HOUR);
    expect(await service.snoozes(SITE)).toEqual([]);
    await service.runHourly([SITE]);
    expect(repo.snoozes.get(SITE)).toEqual([]);
  });

  it("without a gateway, alerts still show on the dashboard", async () => {
    const { repo, service } = setup({ traffic: spikeTraffic, send: null });
    await service.runHourly([SITE]);
    expect(repo.rows.find((r) => r.type === "traffic_spike")!.notifyStatus).toBe("no_gateway");
  });

  it("skips sites with alerts turned off; turning them off closes what is open", async () => {
    const { repo, service } = setup({ traffic: spikeTraffic });
    await service.runHourly([SITE]);
    expect(repo.rows.filter((r) => r.status === "open")).toHaveLength(1);
    await service.saveSettings(SITE, { enabled: false, sensitivity: "normal" }, OWNER);
    expect(repo.rows[0]).toMatchObject({ status: "resolved", resolution: "disabled" });
    const stats = await service.runHourly([SITE]);
    expect(stats.skipped).toBe(1);
    expect(repo.rows).toHaveLength(1);
  });

  it("expires anomalies no check has seen for two days", async () => {
    const { repo, service } = setup();
    await repo.open(SITE, { type: "traffic_drop", subject: "", verdict: "anomalous", severity: "high", metric: "pageviews", observed: 1, expected: 1, score: 1, window: { start: NOW, end: NOW }, title: "t", summary: "s", path: "", facts: {} }, new Date(NOW.getTime() - 50 * HOUR));
    await service.runHourly([]);
    expect(repo.rows[0]).toMatchObject({ status: "resolved", resolution: "expired" });
  });
});

describe("gatewayAlertSender", () => {
  it("posts with the service key and reads the gateway's rate limit", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const send = gatewayAlertSender({ url: "https://gw.test/api/v1/internal/notify", apiKey: "k" }, (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ sent: 0, skipped: 1, failed: 0, rateLimited: true }), { status: 202 });
    }) as unknown as typeof fetch);
    expect(await send({ kind: "anomaly_alert" } as AnomalyAlertNotice)).toEqual({ rateLimited: true });
    expect((calls[0]!.init.headers as Record<string, string>)["X-API-Key"]).toBe("k");
    const failing = gatewayAlertSender({ url: "https://gw.test", apiKey: "k" }, (async () => new Response("", { status: 500 })) as unknown as typeof fetch);
    await expect(failing({ kind: "anomaly_alert" } as AnomalyAlertNotice)).rejects.toThrow("notify returned 500");
  });
});
