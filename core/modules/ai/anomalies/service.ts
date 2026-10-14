import type { AnalyticsAnomalyReads } from "../../analytics/interfaces";
import type { ErrorAnomalyReads } from "../../errors/interfaces";
import { log as baseLog } from "../../../platform/observability/logger";
import type { DigestSite } from "../digest/builder";
import {
  DROP_HOURS,
  OUTAGE_HOURS,
  dayKey,
  detectConversionDrop,
  detectErrorSurge,
  detectOutage,
  detectTrafficDrop,
  detectTrafficSpike,
  hoursOf,
  lastDay,
  lastHours,
  seasonalWindows,
} from "./detect";
import type { AnomalyExplainer, ExplainContext } from "./explain";
import { buildAlertNotice, presentAlert, type AlertView, type AnomalyAlertNotice } from "./present";
import type { AnomalyRepository } from "./repository";
import {
  MAX_SNOOZE_HOURS,
  SNOOZE_ANY,
  severityRank,
  snoozedUntil,
  type AlertSettings,
  type AlertSnooze,
  type AnomalyType,
  type Detection,
  type Severity,
  type StoredAnomaly,
  type Window,
} from "./types";

const log = baseLog.child({ category: "ai_anomalies" });

const HOUR_MS = 3_600_000;
/** An open anomaly no check has seen for this long closes as `expired`, silently. */
export const STALE_MS = 48 * HOUR_MS;
/** Anomaly emails per site in any 24 hours (the gateway enforces the same cap). */
export const MAX_EMAILS_PER_SITE_PER_DAY = 3;
/** The same incident reopening this soon after it recovered is flapping: shown, not mailed again. */
export const FLAP_MS = 6 * HOUR_MS;
/** Error groups looked at per site per hour: the busiest, plus any already alerting. */
export const ERROR_CANDIDATES = 5;
/** How far back the dashboard list reaches for resolved anomalies. */
export const LIST_DAYS = 14;
export const LIST_LIMIT = 20;
/**
 * A run that finds tracking down on this many sites at once (and at least this share of the
 * sites that could be judged) is looking at our own ingest, not at customers' sites: it opens
 * no outage alerts and pages the operators instead.
 */
export const OUTAGE_STORM = { minSites: 5, share: 0.25 };

export type AnomalySendResult = { rateLimited?: boolean };

export type AnomalyServiceDeps = {
  repo: AnomalyRepository;
  traffic: AnalyticsAnomalyReads;
  errors: ErrorAnomalyReads;
  /** Name, domain and everyone with access; `null` when the site is gone. */
  describeSite(websiteId: string): Promise<DigestSite | null>;
  /** Hands one notice to the gateway; throws when it was not accepted. `null`: no gateway, nothing is mailed. */
  send: ((notice: AnomalyAlertNotice) => Promise<AnomalySendResult>) | null;
  explainer: AnomalyExplainer;
  /** Tells the operators something is wrong platform-wide. */
  alertOps?: (title: string, details: Record<string, string | number>) => Promise<void>;
  now?: () => Date;
  /** The UTC hour whose run checks yesterday's conversions (the rollups have settled by then). */
  conversionHourUtc?: number;
  concurrency?: number;
};

export type AnomalyRunStats = {
  sites: number;
  skipped: number;
  failed: number;
  opened: number;
  resolved: number;
  emailed: number;
  outageStorm: boolean;
};

/** One site's verdicts from one run, before anything is stored. */
export type SiteEvaluation = {
  websiteId: string;
  settings: AlertSettings;
  open: StoredAnomaly[];
  detections: Detection[];
  /** The types this run judged: an open anomaly of one of these with no detection closes. */
  evaluated: Set<AnomalyType>;
};

const keyOf = (type: string, subject: string) => `${type}\u0000${subject}`;

/** Anomalies at or above this severity are mailed; below it they only show on the dashboard. */
export function emailFloor(settings: AlertSettings): Severity {
  return settings.sensitivity === "high" ? "low" : "medium";
}

export class AnomalyService {
  private readonly now: () => Date;

  constructor(private readonly deps: AnomalyServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  // ─── Reads for the dashboard ──────────────────────────────────────────────────

  async list(websiteId: string, status: "open" | "all"): Promise<AlertView[]> {
    const since = new Date(this.now().getTime() - LIST_DAYS * 24 * HOUR_MS);
    const now = this.now();
    const [rows, snoozes] = await Promise.all([
      this.deps.repo.list(websiteId, { status, since, limit: LIST_LIMIT }),
      this.deps.repo.listSnoozes(websiteId, now),
    ]);
    return rows.map((r) => presentAlert(r, snoozedUntil(snoozes, r, now)));
  }

  /** One anomaly of this site, for a snooze draft. `null` for an id on another site. */
  async get(websiteId: string, id: string): Promise<AlertView | null> {
    const now = this.now();
    const [row, snoozes] = await Promise.all([this.deps.repo.get(websiteId, id), this.deps.repo.listSnoozes(websiteId, now)]);
    return row ? presentAlert(row, snoozedUntil(snoozes, row, now)) : null;
  }

  /** The anomaly's dedupe key — what a snooze of it is keyed by. `null` for an id on another site. */
  async snoozeScopeOf(websiteId: string, id: string): Promise<{ type: string; subject: string } | null> {
    const row = await this.deps.repo.get(websiteId, id);
    return row ? { type: row.type, subject: row.subject } : null;
  }

  /** Snoozes still running. */
  snoozes(websiteId: string): Promise<AlertSnooze[]> {
    return this.deps.repo.listSnoozes(websiteId, this.now());
  }

  /**
   * Quiet an anomaly scope for `hours` from now: detected and stored as usual, but not mailed and
   * left out of the banner. `type` / `subject` may be `*`. Replaces a snooze of the same scope.
   */
  async snooze(websiteId: string, scope: { type: string; subject: string }, hours: number, userId: string): Promise<AlertSnooze> {
    if (!(hours > 0 && hours <= MAX_SNOOZE_HOURS)) throw new Error(`A snooze lasts between 1 and ${MAX_SNOOZE_HOURS} hours.`);
    const until = new Date(this.now().getTime() + Math.round(hours * HOUR_MS)).toISOString();
    return this.deps.repo.saveSnooze(websiteId, { type: scope.type || SNOOZE_ANY, subject: scope.subject, until }, userId);
  }

  async settings(websiteId: string): Promise<AlertSettings> {
    return (await this.deps.repo.getSettings([websiteId])).get(websiteId)!;
  }

  /** Saves a site's settings. Turning alerts off closes what is open, quietly: nobody is watching it any more. */
  async saveSettings(websiteId: string, settings: AlertSettings, userId: string): Promise<AlertSettings> {
    const saved = await this.deps.repo.saveSettings(websiteId, settings, userId);
    if (!saved.enabled) await this.deps.repo.resolveAllOpen(websiteId, "disabled", this.now());
    return saved;
  }

  // ─── Detection ────────────────────────────────────────────────────────────────

  /** Reads one site's counts and judges every check. Reads only; nothing is stored. */
  async evaluate(websiteId: string, settings: AlertSettings, open: StoredAnomaly[], now = this.now()): Promise<SiteEvaluation> {
    const sensitivity = settings.sensitivity;
    const hour = lastHours(now, 1);
    const drop = lastHours(now, DROP_HOURS);
    const outageHours = hoursOf(lastHours(now, OUTAGE_HOURS));

    // One call, fifteen windows: each window and its four seasonal twins.
    const groups: Window[][] = [hour, drop, ...outageHours].map((w) => [w, ...seasonalWindows(w)]);
    const counts = await this.deps.traffic.trafficInWindows(websiteId, groups.flat());
    const series = groups.map((_, g) => counts.slice(g * 5, g * 5 + 5));
    const [hourC, dropC, ...outageC] = series as [typeof counts, typeof counts, ...(typeof counts)[]];
    const split = (c: typeof counts, k: "pageviews" | "visitors") => ({ observed: c[0]![k], baseline: c.slice(1).map((x) => x[k]) });

    const detections: Detection[] = [];
    const evaluated = new Set<AnomalyType>(["tracking_outage", "traffic_spike", "error_surge"]);

    const outage = detectOutage({
      hours: outageHours.map((w, i) => ({ window: w, observed: outageC[i]![0]!.pageviews, baseline: outageC[i]!.slice(1).map((x) => x.pageviews) })),
      sensitivity,
    });
    detections.push(outage);
    const outageOngoing = outage.verdict === "anomalous" || (outage.verdict !== "normal" && open.some((a) => a.type === "tracking_outage"));

    // A drop during an outage is the outage: it is not judged, so neither opens nor closes.
    if (!outageOngoing) {
      evaluated.add("traffic_drop");
      detections.push(detectTrafficDrop({ window: drop, pageviews: split(dropC, "pageviews"), visitors: split(dropC, "visitors"), sensitivity }));
    }
    detections.push(detectTrafficSpike({ window: hour, pageviews: split(hourC, "pageviews"), visitors: split(hourC, "visitors"), sensitivity }));

    const openErrors = open.filter((a) => a.type === "error_surge").map((a) => a.subject);
    const candidates = await this.deps.errors.surgeCandidates(websiteId, hour, seasonalWindows(hour), { limit: ERROR_CANDIDATES, include: openErrors });
    for (const c of candidates) {
      detections.push(detectErrorSurge({
        window: hour,
        series: { fingerprint: c.fingerprint, message: c.message, pagePath: c.last_page_path, firstSeen: c.first_seen, observed: c.current, sessions: c.sessions, baseline: c.baseline },
        sensitivity,
        now,
      }));
    }

    // Conversions once a day, over yesterday: an hour of goal completions is too few to judge.
    if (now.getUTCHours() === (this.deps.conversionHourUtc ?? 1)) {
      evaluated.add("conversion_drop");
      const day = lastDay(now);
      const days = [day, ...seasonalWindows(day)];
      const goals = await this.deps.traffic.goalCompletionsByDay(websiteId, days.map((w) => dayKey(w.start)));
      for (const g of goals) {
        detections.push(detectConversionDrop({ window: day, series: { goalId: g.goalId, name: g.name, observed: g.counts[0] ?? 0, baseline: g.counts.slice(1) }, sensitivity }));
      }
    }
    return { websiteId, settings, open, detections, evaluated };
  }

  // ─── Reconciliation ───────────────────────────────────────────────────────────

  /**
   * Stores one site's verdicts: opens what is new (once — the open index dedupes), keeps what
   * is still going, closes what recovered, then explains and mails. `suppressOutage` holds back
   * outage alerts during a platform-wide storm.
   */
  async apply(ev: SiteEvaluation, opts: { suppressOutage?: boolean } = {}): Promise<{ opened: number; resolved: number; emailed: number }> {
    const now = this.now();
    const { repo } = this.deps;
    const openByKey = new Map(ev.open.map((a) => [keyOf(a.type, a.subject), a]));
    const seen = new Set<string>();
    const opened: Array<{ anomaly: StoredAnomaly; d: Detection }> = [];
    const recovered: StoredAnomaly[] = [];

    for (const d of ev.detections) {
      const key = keyOf(d.type, d.subject);
      seen.add(key);
      const existing = openByKey.get(key);
      if (d.verdict === "anomalous") {
        if (existing) await repo.touch(existing.id, d, now);
        else if (!(d.type === "tracking_outage" && opts.suppressOutage)) {
          const row = await repo.open(ev.websiteId, d, now);
          if (row) opened.push({ anomaly: row, d });
        }
      } else if (d.verdict === "elevated" && existing) {
        await repo.touch(existing.id, d, now);
      } else if (d.verdict === "normal" && existing) {
        await repo.resolve(existing.id, "recovered", now);
        recovered.push(existing);
      }
    }
    // An open error or goal the run judged but found nothing for — the group was ignored or
    // deleted, the goal removed — closes without a "back to normal" email.
    for (const a of ev.open) {
      if (seen.has(keyOf(a.type, a.subject)) || !ev.evaluated.has(a.type)) continue;
      if (a.type === "error_surge" || a.type === "conversion_drop") await repo.resolve(a.id, "expired", now);
    }

    let emailed = 0;
    for (const { anomaly, d } of opened) {
      const explained = await this.explain(ev.websiteId, anomaly, d);
      if (await this.notifyOpen(explained, ev.settings, now)) emailed += 1;
    }
    for (const a of recovered) {
      if (a.notifiedAt && !a.resolvedNotifiedAt) await this.notifyResolved(a, now);
    }
    return { opened: opened.length, resolved: recovered.length, emailed };
  }

  /** Adds the likely cause to a new anomaly. Never throws: an alert without a cause still goes out. */
  private async explain(websiteId: string, anomaly: StoredAnomaly, d: Detection): Promise<StoredAnomaly> {
    try {
      let ctx: ExplainContext | null = null;
      if (d.type === "traffic_drop" || d.type === "traffic_spike" || d.type === "conversion_drop") {
        ctx = await this.deps.traffic.windowBreakdown(websiteId, d.window, seasonalWindows(d.window, 1)[0]!);
      }
      const e = await this.deps.explainer.explain(d, ctx);
      await this.deps.repo.setExplanation(anomaly.id, e);
      return { ...anomaly, explanation: e.text, explanationSource: e.source };
    } catch (err) {
      log.warn({ msg: "ai_anomaly_explain_failed", website_id: websiteId, anomaly_id: anomaly.id, err: String(err) });
      return anomaly;
    }
  }

  /** Mails a new anomaly when it is worth it; records why not otherwise. True when it was sent. */
  private async notifyOpen(a: StoredAnomaly, settings: AlertSettings, now: Date): Promise<boolean> {
    const { repo, send } = this.deps;
    const skip = async (status: string) => { await repo.markNotified(a.id, status, null); return false; };
    try {
      if (!send) return skip("no_gateway");
      if (severityRank(a.severity) < severityRank(emailFloor(settings))) return skip("below_severity");
      if (snoozedUntil(await repo.listSnoozes(a.websiteId, now), a, now)) return skip("snoozed");
      if (await repo.recentlyRecovered(a.websiteId, a.type, a.subject, new Date(now.getTime() - FLAP_MS))) return skip("flapping");
      if ((await repo.countNotifiedSince(a.websiteId, new Date(now.getTime() - 24 * HOUR_MS))) >= MAX_EMAILS_PER_SITE_PER_DAY) return skip("rate_limited");
      const site = await this.deps.describeSite(a.websiteId);
      const notice = site ? buildAlertNotice(a, site, "open") : null;
      if (!notice) return skip("no_recipients");
      const result = await send(notice);
      if (result.rateLimited) return skip("rate_limited");
      await repo.markNotified(a.id, "sent", now);
      return true;
    } catch (err) {
      log.error({ msg: "ai_anomaly_notify_failed", website_id: a.websiteId, anomaly_id: a.id, err: String(err) });
      await repo.markNotified(a.id, "failed", null).catch(() => {});
      return false;
    }
  }

  /** "Back to normal", to whoever was told it started. */
  private async notifyResolved(a: StoredAnomaly, now: Date): Promise<void> {
    const { repo, send } = this.deps;
    if (!send) return;
    try {
      const site = await this.deps.describeSite(a.websiteId);
      const notice = site ? buildAlertNotice({ ...a, status: "resolved", resolvedAt: now.toISOString() }, site, "resolved") : null;
      if (!notice) return;
      await send(notice);
      await repo.markResolvedNotified(a.id, now);
    } catch (err) {
      log.error({ msg: "ai_anomaly_resolve_notify_failed", website_id: a.websiteId, anomaly_id: a.id, err: String(err) });
    }
  }

  // ─── The hourly run ───────────────────────────────────────────────────────────

  /**
   * Every site in `websiteIds`: judge them all first, then store. Two passes so a run can see an
   * outage storm — tracking "down" on many sites at once is our ingest, not theirs — before any
   * alert about it goes out. A site that fails is logged and counted; it never stops the others.
   */
  async runHourly(websiteIds: readonly string[]): Promise<AnomalyRunStats> {
    const stats: AnomalyRunStats = { sites: websiteIds.length, skipped: 0, failed: 0, opened: 0, resolved: 0, emailed: 0, outageStorm: false };
    const now = this.now();
    const { repo } = this.deps;

    await repo.expireStale(new Date(now.getTime() - STALE_MS), now).catch((err: unknown) => {
      log.warn({ msg: "ai_anomaly_expire_failed", err: String(err) });
    });
    await repo.purgeExpiredSnoozes(now).catch((err: unknown) => {
      log.warn({ msg: "ai_anomaly_snooze_purge_failed", err: String(err) });
    });

    const settings = await repo.getSettings(websiteIds);
    const evaluations: SiteEvaluation[] = [];
    const concurrency = Math.max(1, Math.min(this.deps.concurrency ?? 4, websiteIds.length));
    let next = 0;
    const worker = async () => {
      while (next < websiteIds.length) {
        const id = websiteIds[next++]!;
        const s = settings.get(id)!;
        if (!s.enabled) { stats.skipped += 1; continue; }
        try {
          evaluations.push(await this.evaluate(id, s, await repo.listOpen(id), now));
        } catch (err) {
          stats.failed += 1;
          log.error({ msg: "ai_anomaly_site_failed", website_id: id, err: String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    const outageVerdicts = evaluations.map((e) => e.detections.find((d) => d.type === "tracking_outage")?.verdict);
    const judged = outageVerdicts.filter((v) => v && v !== "insufficient").length;
    const down = outageVerdicts.filter((v) => v === "anomalous").length;
    stats.outageStorm = down >= OUTAGE_STORM.minSites && down >= OUTAGE_STORM.share * judged;
    if (stats.outageStorm) {
      log.error({ msg: "ai_anomaly_outage_storm", sites_down: down, sites_judged: judged });
      await this.deps.alertOps?.("Anomaly check: tracking looks down on many sites at once", { sites_down: down, sites_judged: judged }).catch(() => {});
    }

    next = 0;
    const applier = async () => {
      while (next < evaluations.length) {
        const ev = evaluations[next++]!;
        try {
          const r = await this.apply(ev, { suppressOutage: stats.outageStorm });
          stats.opened += r.opened;
          stats.resolved += r.resolved;
          stats.emailed += r.emailed;
        } catch (err) {
          stats.failed += 1;
          log.error({ msg: "ai_anomaly_apply_failed", website_id: ev.websiteId, err: String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, evaluations.length)) }, applier));
    return stats;
  }
}

/**
 * The gateway's `POST /internal/notify`, the same endpoint and key as the weekly digest. Reads
 * the gateway's answer for its own per-site cap (`rateLimited`).
 */
export function gatewayAlertSender(target: { url: string; apiKey: string }, fetchImpl: typeof fetch = fetch) {
  return async (notice: AnomalyAlertNotice): Promise<AnomalySendResult> => {
    const res = await fetchImpl(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": target.apiKey },
      body: JSON.stringify(notice),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`notify returned ${res.status}`);
    const body = (await res.json().catch(() => null)) as { rateLimited?: unknown } | null;
    return { rateLimited: body?.rateLimited === true };
  };
}
