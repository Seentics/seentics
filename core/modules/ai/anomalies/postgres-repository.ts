import { sql } from "../../../db";
import type { AnomalyRepository, ExplanationRecord } from "./repository";
import {
  ANOMALY_TYPES,
  DEFAULT_ALERT_SETTINGS,
  SENSITIVITIES,
  SEVERITIES,
  type AlertSettings,
  type AnomalyMetric,
  type AnomalyType,
  type Detection,
  type Resolution,
  type Sensitivity,
  type Severity,
  type StoredAnomaly,
} from "./types";

type Row = {
  id: string;
  website_id: string;
  type: string;
  subject: string;
  status: string;
  severity: string;
  metric: string;
  observed: number;
  expected: number;
  score: number;
  window_start: Date;
  window_end: Date;
  title: string;
  summary: string;
  explanation: string | null;
  explanation_source: string | null;
  path: string;
  facts: Record<string, unknown> | null;
  detected_at: Date;
  last_seen_at: Date;
  resolved_at: Date | null;
  resolution: string | null;
  notified_at: Date | null;
  notify_status: string | null;
  resolved_notified_at: Date | null;
};

const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());

function toStored(r: Row): StoredAnomaly {
  return {
    id: r.id,
    websiteId: r.website_id,
    type: (ANOMALY_TYPES as readonly string[]).includes(r.type) ? (r.type as AnomalyType) : "traffic_drop",
    subject: r.subject,
    status: r.status === "resolved" ? "resolved" : "open",
    severity: (SEVERITIES as readonly string[]).includes(r.severity) ? (r.severity as Severity) : "medium",
    metric: r.metric as AnomalyMetric,
    observed: Number(r.observed),
    expected: Number(r.expected),
    score: Number(r.score),
    windowStart: iso(r.window_start)!,
    windowEnd: iso(r.window_end)!,
    title: r.title,
    summary: r.summary,
    explanation: r.explanation,
    explanationSource: r.explanation_source === "ai" ? "ai" : r.explanation_source === "rules" ? "rules" : null,
    path: r.path,
    facts: r.facts ?? {},
    detectedAt: iso(r.detected_at)!,
    lastSeenAt: iso(r.last_seen_at)!,
    resolvedAt: iso(r.resolved_at),
    resolution: (r.resolution as Resolution | null) ?? null,
    notifiedAt: iso(r.notified_at),
    notifyStatus: r.notify_status,
    resolvedNotifiedAt: iso(r.resolved_notified_at),
  };
}

const asSensitivity = (s: string): Sensitivity => ((SENSITIVITIES as readonly string[]).includes(s) ? (s as Sensitivity) : "normal");

/** `AnomalyRepository` over Postgres. The only file in the anomaly code that touches `db`. */
export class PostgresAnomalyRepository implements AnomalyRepository {
  async getSettings(websiteIds: readonly string[]): Promise<Map<string, AlertSettings>> {
    const out = new Map<string, AlertSettings>(websiteIds.map((id) => [id, { ...DEFAULT_ALERT_SETTINGS }]));
    if (!websiteIds.length) return out;
    const rows = await sql<{ website_id: string; enabled: boolean; sensitivity: string }[]>`
      SELECT website_id::text AS website_id, enabled, sensitivity
      FROM ai_anomaly_settings
      WHERE website_id = ANY(${[...websiteIds]}::uuid[])
    `;
    for (const r of rows) out.set(r.website_id, { enabled: r.enabled, sensitivity: asSensitivity(r.sensitivity) });
    return out;
  }

  async saveSettings(websiteId: string, settings: AlertSettings, userId: string): Promise<AlertSettings> {
    const [row] = await sql<{ enabled: boolean; sensitivity: string }[]>`
      INSERT INTO ai_anomaly_settings (website_id, enabled, sensitivity, updated_by, updated_at)
      VALUES (${websiteId}::uuid, ${settings.enabled}, ${settings.sensitivity}, ${userId}::uuid, NOW())
      ON CONFLICT (website_id) DO UPDATE
        SET enabled = EXCLUDED.enabled, sensitivity = EXCLUDED.sensitivity,
            updated_by = EXCLUDED.updated_by, updated_at = NOW()
      RETURNING enabled, sensitivity
    `;
    return { enabled: row!.enabled, sensitivity: asSensitivity(row!.sensitivity) };
  }

  async listOpen(websiteId: string): Promise<StoredAnomaly[]> {
    const rows = await sql<Row[]>`
      SELECT * FROM ai_anomalies WHERE website_id = ${websiteId}::uuid AND status = 'open' ORDER BY detected_at DESC
    `;
    return rows.map(toStored);
  }

  async list(websiteId: string, opts: { status: "open" | "all"; since: Date; limit: number }): Promise<StoredAnomaly[]> {
    const rows = opts.status === "open"
      ? await sql<Row[]>`
          SELECT * FROM ai_anomalies WHERE website_id = ${websiteId}::uuid AND status = 'open'
          ORDER BY detected_at DESC LIMIT ${opts.limit}
        `
      : await sql<Row[]>`
          SELECT * FROM ai_anomalies
          WHERE website_id = ${websiteId}::uuid AND (status = 'open' OR detected_at >= ${opts.since.toISOString()}::timestamptz)
          ORDER BY detected_at DESC LIMIT ${opts.limit}
        `;
    return rows.map(toStored);
  }

  async open(websiteId: string, d: Detection, now: Date): Promise<StoredAnomaly | null> {
    const rows = await sql<Row[]>`
      INSERT INTO ai_anomalies (
        website_id, type, subject, status, severity, metric, observed, expected, score,
        window_start, window_end, title, summary, path, facts, detected_at, last_seen_at
      ) VALUES (
        ${websiteId}::uuid, ${d.type}, ${d.subject}, 'open', ${d.severity}, ${d.metric}, ${d.observed}, ${d.expected}, ${d.score},
        ${d.window.start.toISOString()}::timestamptz, ${d.window.end.toISOString()}::timestamptz, ${d.title}, ${d.summary}, ${d.path},
        ${JSON.stringify(d.facts)}::jsonb, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz
      )
      ON CONFLICT (website_id, type, subject) WHERE status = 'open' DO NOTHING
      RETURNING *
    `;
    return rows[0] ? toStored(rows[0]) : null;
  }

  async touch(id: string, d: Detection, now: Date): Promise<void> {
    await sql`
      UPDATE ai_anomalies SET
        observed = ${d.observed}, expected = ${d.expected}, score = ${d.score},
        window_end = ${d.window.end.toISOString()}::timestamptz,
        title = ${d.title}, summary = ${d.summary}, facts = ${JSON.stringify(d.facts)}::jsonb,
        severity = CASE
          WHEN array_position(${[...SEVERITIES]}::text[], ${d.severity}::text) > array_position(${[...SEVERITIES]}::text[], severity::text)
          THEN ${d.severity} ELSE severity END,
        last_seen_at = ${now.toISOString()}::timestamptz
      WHERE id = ${id}::uuid AND status = 'open'
    `;
  }

  async resolve(id: string, resolution: Resolution, now: Date): Promise<void> {
    await sql`
      UPDATE ai_anomalies SET status = 'resolved', resolution = ${resolution}, resolved_at = ${now.toISOString()}::timestamptz
      WHERE id = ${id}::uuid AND status = 'open'
    `;
  }

  async setExplanation(id: string, e: ExplanationRecord): Promise<void> {
    await sql`
      UPDATE ai_anomalies SET
        explanation = ${e.text}, explanation_source = ${e.source}, model = ${e.model},
        input_tokens = input_tokens + ${e.inputTokens}, output_tokens = output_tokens + ${e.outputTokens},
        cost_usd = cost_usd + ${e.costUsd.toFixed(6)}::numeric
      WHERE id = ${id}::uuid
    `;
  }

  async markNotified(id: string, status: string, at: Date | null): Promise<void> {
    await sql`
      UPDATE ai_anomalies SET notify_status = ${status}, notified_at = ${at ? at.toISOString() : null}::timestamptz
      WHERE id = ${id}::uuid
    `;
  }

  async markResolvedNotified(id: string, at: Date): Promise<void> {
    await sql`UPDATE ai_anomalies SET resolved_notified_at = ${at.toISOString()}::timestamptz WHERE id = ${id}::uuid`;
  }

  async countNotifiedSince(websiteId: string, since: Date): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ai_anomalies
      WHERE website_id = ${websiteId}::uuid AND detected_at >= ${since.toISOString()}::timestamptz
        AND notified_at >= ${since.toISOString()}::timestamptz
    `;
    return row?.n ?? 0;
  }

  async recentlyRecovered(websiteId: string, type: string, subject: string, since: Date): Promise<boolean> {
    const rows = await sql`
      SELECT 1 FROM ai_anomalies
      WHERE website_id = ${websiteId}::uuid AND type = ${type} AND subject = ${subject}
        AND status = 'resolved' AND resolution = 'recovered' AND resolved_at >= ${since.toISOString()}::timestamptz
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async expireStale(before: Date, now: Date): Promise<number> {
    const rows = await sql`
      UPDATE ai_anomalies SET status = 'resolved', resolution = 'expired', resolved_at = ${now.toISOString()}::timestamptz
      WHERE status = 'open' AND last_seen_at < ${before.toISOString()}::timestamptz
      RETURNING 1
    `;
    return rows.length;
  }

  async resolveAllOpen(websiteId: string, resolution: Resolution, now: Date): Promise<number> {
    const rows = await sql`
      UPDATE ai_anomalies SET status = 'resolved', resolution = ${resolution}, resolved_at = ${now.toISOString()}::timestamptz
      WHERE website_id = ${websiteId}::uuid AND status = 'open'
      RETURNING 1
    `;
    return rows.length;
  }
}
