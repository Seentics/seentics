import { parseUserAgent } from "../../../platform/http/analytics-ingest-meta";
import { log as baseLog } from "../../../platform/observability/logger";
import { errorFingerprint } from "../lib/fingerprint";
import {
  insertErrorEvents,
  upsertErrorGroups,
  type ErrorRow,
} from "../repositories/error-writes.repository";
import type { ErrorIngest, ErrorTrackerEvent } from "../interfaces";

const log = baseLog.child({ category: "errors" });

/** Path only, so a fault is grouped by route rather than by query string. */
function pathOf(rawUrl: string): string {
  if (!rawUrl?.trim()) return "/";
  try {
    return new URL(rawUrl).pathname || "/";
  } catch {
    return (rawUrl.split(/[?#]/)[0] ?? "/").slice(0, 500);
  }
}

/**
 * Writes the errors a batch carried.
 *
 * Groups before samples, deliberately. The group row is what the dashboard reads and what
 * survives retention; a sample without its group would be invisible, while a group whose
 * samples failed to land still shows an accurate count. If only one of the two can
 * succeed, it should be that one.
 */
export class ErrorIngestService implements ErrorIngest {
  async processEvents(batchId: string, events: readonly ErrorTrackerEvent[]): Promise<void> {
    const rows = events.map(toRow).filter((r): r is ErrorRow => r !== null);
    if (rows.length === 0) return;

    await upsertErrorGroups(rows);
    await insertErrorEvents(rows);

    log.info({
      msg: "errors_ingested",
      batch_id: batchId,
      rows: rows.length,
      groups: new Set(rows.map((r) => r.fingerprint)).size,
    });
  }
}

function toRow(ev: ErrorTrackerEvent): ErrorRow | null {
  const message = (ev.message ?? "").trim();
  // The schema already rejects an empty message; this covers whitespace-only, which it
  // does not, and which would fingerprint every such error into one meaningless group.
  if (!ev.websiteId || !message) return null;

  const kind = ev.kind === "unhandledrejection" ? "unhandledrejection" : "error";
  const sourceFile = (ev.source ?? "").trim();
  const ua = parseUserAgent(ev.clientUa ?? "");

  return {
    websiteId: ev.websiteId,
    fingerprint: errorFingerprint({ kind, message, sourceFile }),
    kind,
    message,
    stack: (ev.stack ?? "").trim(),
    sourceFile,
    lineNo: Number.isFinite(ev.line_no) ? (ev.line_no as number) : null,
    colNo: Number.isFinite(ev.col_no) ? (ev.col_no as number) : null,
    pagePath: pathOf(ev.url ?? ""),
    sessionId: ev.sid?.trim() || null,
    visitorId: ev.vid?.trim() || null,
    browser: ua.browser ?? "",
    os: ua.os ?? "",
    deviceType: ua.device ?? "",
    // A tracker clock can be wrong or deliberately set forward, and a row dated next year
    // would sit at the top of every list permanently. Trust it only when it is sane.
    occurredAt: plausibleTimestamp(ev.ts),
  };
}

/** Reject a timestamp in the future or implausibly old; fall back to arrival time. */
function plausibleTimestamp(ts: number): Date {
  const now = Date.now();
  if (!Number.isFinite(ts)) return new Date(now);
  // A month back covers a queued beacon from a tab left open; anything older is a wrong clock.
  if (ts > now + 60_000 || ts < now - 30 * 24 * 60 * 60 * 1000) return new Date(now);
  return new Date(ts);
}

let instance: ErrorIngestService | null = null;

/** Process-local accessor, matching the other ingest services. */
export function errorIngestService(): ErrorIngest {
  if (!instance) instance = new ErrorIngestService();
  return instance;
}
