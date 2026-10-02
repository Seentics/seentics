import { env } from "../../config";
import { log as baseLog } from "./logger";

const log = baseLog.child({ category: "ops_alert" });

/**
 * Tell the operators a background job failed — the nightly retention sweep, a
 * TimescaleDB compression or retention job, a cleanup. Sent through the gateway's
 * POST /internal/notify (`ops_alert`), which mails OPS_ALERT_EMAILS and sends each
 * distinct title at most once an hour, so a job failing every run is one email an
 * hour, not one a run.
 *
 * Always logged at error, so a deployment with no gateway (OSS) still leaves a trace.
 * Never throws: an alert that cannot be delivered must not fail the job reporting it.
 */
export async function alertOps(title: string, details: Record<string, string | number> = {}): Promise<void> {
  log.error({ msg: "ops_alert", title, ...details });
  const cfg = env();
  if (!cfg.opsAlertUrl || !cfg.globalApiKey) return;
  try {
    const res = await fetch(cfg.opsAlertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": cfg.globalApiKey },
      body: JSON.stringify({ kind: "ops_alert", title: title.slice(0, 200), details: clip(details) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log.error({ msg: "ops_alert_not_delivered", title, status: res.status });
  } catch (e) {
    log.error({ msg: "ops_alert_not_delivered", title, err: String(e) });
  }
}

/** The gateway takes a dozen fields, strings up to 1,000 characters. */
function clip(details: Record<string, string | number>): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(details)
      .slice(0, 12)
      .map(([k, v]) => [k.slice(0, 64), typeof v === "string" ? v.slice(0, 1_000) : v]),
  );
}
