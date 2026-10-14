import type { AnalyticsAnomalyReads } from "../../../analytics/interfaces";
import type { ErrorAnomalyReads, ErrorSurgeCandidate } from "../../../errors/interfaces";
import type { AnomalyRepository, ExplanationRecord } from "../repository";
import { DEFAULT_ALERT_SETTINGS, SEVERITIES, type AlertSettings, type AlertSnooze, type Detection, type Resolution, type StoredAnomaly } from "../types";

/** `AnomalyRepository` in memory, with the open-index dedupe the real one gets from Postgres. */
export class MemoryAnomalyRepository implements AnomalyRepository {
  rows: StoredAnomaly[] = [];
  settings = new Map<string, AlertSettings>();
  snoozes = new Map<string, AlertSnooze[]>();
  private seq = 0;

  async getSettings(ids: readonly string[]) {
    return new Map(ids.map((id) => [id, this.settings.get(id) ?? { ...DEFAULT_ALERT_SETTINGS }]));
  }
  async saveSettings(id: string, s: AlertSettings) {
    this.settings.set(id, s);
    return s;
  }
  async listOpen(id: string) {
    return this.rows.filter((r) => r.websiteId === id && r.status === "open").map((r) => ({ ...r }));
  }
  async list(id: string, opts: { status: "open" | "all"; since: Date; limit: number }) {
    return this.rows
      .filter((r) => r.websiteId === id && (r.status === "open" || (opts.status === "all" && Date.parse(r.detectedAt) >= opts.since.getTime())))
      .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
      .slice(0, opts.limit);
  }
  async open(id: string, d: Detection, now: Date) {
    if (this.rows.some((r) => r.websiteId === id && r.type === d.type && r.subject === d.subject && r.status === "open")) return null;
    const row: StoredAnomaly = {
      id: `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`,
      websiteId: id, type: d.type, subject: d.subject, status: "open", severity: d.severity, metric: d.metric,
      observed: d.observed, expected: d.expected, score: d.score,
      windowStart: d.window.start.toISOString(), windowEnd: d.window.end.toISOString(),
      title: d.title, summary: d.summary, explanation: null, explanationSource: null, path: d.path, facts: d.facts,
      detectedAt: now.toISOString(), lastSeenAt: now.toISOString(), resolvedAt: null, resolution: null,
      notifiedAt: null, notifyStatus: null, resolvedNotifiedAt: null,
    };
    this.rows.push(row);
    return { ...row };
  }
  private row(id: string) {
    return this.rows.find((r) => r.id === id)!;
  }
  async touch(id: string, d: Detection, now: Date) {
    const r = this.row(id);
    if (r.status !== "open") return;
    Object.assign(r, { observed: d.observed, expected: d.expected, title: d.title, summary: d.summary, lastSeenAt: now.toISOString() });
    if (SEVERITIES.indexOf(d.severity) > SEVERITIES.indexOf(r.severity)) r.severity = d.severity;
  }
  async resolve(id: string, resolution: Resolution, now: Date) {
    const r = this.row(id);
    if (r.status !== "open") return;
    Object.assign(r, { status: "resolved", resolution, resolvedAt: now.toISOString() });
  }
  async setExplanation(id: string, e: ExplanationRecord) {
    Object.assign(this.row(id), { explanation: e.text, explanationSource: e.source });
  }
  async markNotified(id: string, status: string, at: Date | null) {
    Object.assign(this.row(id), { notifyStatus: status, notifiedAt: at?.toISOString() ?? null });
  }
  async markResolvedNotified(id: string, at: Date) {
    this.row(id).resolvedNotifiedAt = at.toISOString();
  }
  async countNotifiedSince(id: string, since: Date) {
    return this.rows.filter((r) => r.websiteId === id && r.notifiedAt && Date.parse(r.notifiedAt) >= since.getTime()).length;
  }
  async recentlyRecovered(id: string, type: string, subject: string, since: Date) {
    return this.rows.some((r) => r.websiteId === id && r.type === type && r.subject === subject && r.resolution === "recovered" && Date.parse(r.resolvedAt!) >= since.getTime());
  }
  async expireStale(before: Date, now: Date) {
    let n = 0;
    for (const r of this.rows) if (r.status === "open" && Date.parse(r.lastSeenAt) < before.getTime()) { Object.assign(r, { status: "resolved", resolution: "expired", resolvedAt: now.toISOString() }); n++; }
    return n;
  }
  async resolveAllOpen(id: string, resolution: Resolution, now: Date) {
    let n = 0;
    for (const r of this.rows) if (r.websiteId === id && r.status === "open") { Object.assign(r, { status: "resolved", resolution, resolvedAt: now.toISOString() }); n++; }
    return n;
  }  async get(websiteId: string, id: string) {
    const r = this.rows.find((x) => x.id === id && x.websiteId === websiteId);
    return r ? { ...r } : null;
  }
  async listSnoozes(websiteId: string, now: Date) {
    return (this.snoozes.get(websiteId) ?? []).filter((s) => Date.parse(s.until) > now.getTime());
  }
  async saveSnooze(websiteId: string, snooze: AlertSnooze) {
    const rest = (this.snoozes.get(websiteId) ?? []).filter((s) => s.type !== snooze.type || s.subject !== snooze.subject);
    this.snoozes.set(websiteId, [...rest, snooze]);
    return snooze;
  }
  async purgeExpiredSnoozes(now: Date) {
    let n = 0;
    for (const [id, list] of this.snoozes) {
      const keep = list.filter((s) => Date.parse(s.until) > now.getTime());
      n += list.length - keep.length;
      this.snoozes.set(id, keep);
    }
    return n;
  }

}

type Counts = { pageviews: number; visitors: number };

/**
 * Traffic as a function of the window: `perHour(start)` gives one hour's counts, and a window's
 * figure is the sum of its hours (visitors too — close enough for a fake).
 */
export function fakeTraffic(perHour: (hourStart: Date) => Counts, goals: Array<{ goalId: string; name: string; counts: number[] }> = []): AnalyticsAnomalyReads & { breakdowns: number } {
  const reads = {
    breakdowns: 0,
    async trafficInWindows(_id: string, windows: ReadonlyArray<{ start: Date; end: Date }>) {
      return windows.map((w) => {
        const out = { pageviews: 0, visitors: 0 };
        for (let t = w.start.getTime(); t < w.end.getTime(); t += 3_600_000) {
          const c = perHour(new Date(t));
          out.pageviews += c.pageviews;
          out.visitors += c.visitors;
        }
        return out;
      });
    },
    async goalCompletionsByDay() {
      return goals;
    },
    async windowBreakdown() {
      reads.breakdowns += 1;
      return {
        pages: [{ name: "/pricing", cur: 20, ref: 180 }, { name: "/", cur: 90, ref: 110 }],
        sources: [{ name: "google", cur: 30, ref: 260 }, { name: "direct", cur: 60, ref: 70 }],
      };
    },
  };
  return reads;
}

export function fakeErrors(candidates: ErrorSurgeCandidate[] = []): ErrorAnomalyReads & { includes: string[][] } {
  const reads = {
    includes: [] as string[][],
    async surgeCandidates(_id: string, _c: unknown, _b: unknown, opts: { limit: number; include?: readonly string[] }) {
      reads.includes.push([...(opts.include ?? [])]);
      return candidates;
    },
  };
  return reads;
}
