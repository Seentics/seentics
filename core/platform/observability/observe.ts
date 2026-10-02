import type { MiddlewareHandler } from "hono";
import {
  configure,
  context,
  logger as observeLogger,
  metrics,
  propagation,
  shutdown,
  SpanKind,
  SpanStatusCode,
  tracer,
} from "@seentics/observe";

/**
 * Core's own logs and traces, sent to Seentics Observability through our published
 * SDK (@seentics/observe) — the product watching itself.
 *
 * Off unless SEENTICS_INGEST_KEY is set, so development and self-hosted installs
 * send nothing. With it, every structured log line (./logger.ts) is also sent, and
 * every request is a span — continuing the gateway's trace, whose `traceparent` it
 * forwards, so one dashboard click is one trace across both.
 *
 * Tracker collection is customer visitor traffic, thousands of requests a second:
 * it gets no spans, and only its failures are sent as logs.
 */

export const observeEnabled = Boolean(process.env.SEENTICS_INGEST_KEY?.trim());

if (observeEnabled) {
  configure({
    service: process.env.SEENTICS_SERVICE_NAME || "analytics",
    // Bun.serve is not Node's http, which the automatic instrumentation hooks;
    // requests get their spans from `requestSpans`.
    instrumentations: [],
    onError: (e) => console.error(JSON.stringify({ level: "warn", service: "seentics-core", msg: "observe_sdk_error", err: String(e) })),
  });
}

const isTracker = (path: string) => path.includes("/tracker/");

/**
 * At most this many lines a second leave this process — a backstop against any
 * loop or flood, with what was held back counted and reported once a second.
 */
const MAX_LINES_PER_SECOND = 200;
let window = { second: 0, sent: 0, dropped: 0 };

function admit(): boolean {
  const second = Math.floor(Date.now() / 1000);
  if (second !== window.second) {
    if (window.dropped > 0) {
      observeLogger.warn("observe_log_lines_dropped", { dropped: window.dropped, limit_per_second: MAX_LINES_PER_SECOND });
    }
    window = { second, sent: 0, dropped: 0 };
  }
  if (window.sent >= MAX_LINES_PER_SECOND) {
    window.dropped++;
    return false;
  }
  window.sent++;
  return true;
}

/** One structured log line from ./logger.ts, forwarded as the same fields. */
export function forwardLog(level: "debug" | "info" | "warn" | "error", fields: Record<string, unknown>): void {
  if (!observeEnabled) return;
  const path = typeof fields.path === "string" ? fields.path : "";
  if (path && isTracker(path) && level !== "warn" && level !== "error") return;
  if (!admit()) return;
  const { msg, ...rest } = fields;
  observeLogger[level](typeof msg === "string" ? msg : "log", rest);
}

/** Ids in a path, so every site's `/analytics/dashboard/:id` is one span name. */
function spanPath(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n")
    .replace(/\/[0-9a-f]{24,}(?=\/|$)/gi, "/:id");
}

// ── Metrics ──────────────────────────────────────────────────────────────────
// Aggregated in this process and exported once a minute, so unlike spans they cost
// nothing per request: tracker traffic is counted too.

const requestDuration = metrics.createHistogram("http.server.request.duration", {
  unit: "ms",
  description: "Time to answer each request, by route, method and status class",
});

/** What Core does besides answer requests, counted where it happens. */
export const coreMetrics = {
  /** One website-day of rollups rebuilt from raw events (rollups/builder.ts). */
  rollupRebuild: metrics.createHistogram("analytics.rollup.rebuild.duration", {
    unit: "ms",
    description: "Time to rebuild one website-day of rollups from raw events",
  }),

  // ── Ingest (modules/ingest) — the path every tracked event takes ──
  /** Rows `/collect` handed to the in-memory buffer, by lane. */
  ingestRowsAccepted: metrics.createCounter("ingest.rows.accepted", {
    description: "Tracker rows accepted into the ingest buffer, by lane",
  }),
  /** Rows lost before the durable queue, by lane and why (byte_cap, queue_full, flush_failed). */
  ingestRowsDropped: metrics.createCounter("ingest.rows.dropped", {
    description: "Tracker rows dropped before reaching the durable queue, by lane and reason",
  }),
  /** One buffer drain onto the durable queue. */
  ingestFlushDuration: metrics.createHistogram("ingest.flush.duration", {
    unit: "ms",
    description: "Time to move the ingest buffer onto the durable queue",
  }),
  /** Batches put on the durable queue, by lane and outcome (queued, requeued, dropped). */
  ingestBatchesQueued: metrics.createCounter("ingest.batches.queued", {
    description: "Batches written to the durable ingest queue, by lane and outcome",
  }),
  /** One durable-queue batch processed by BatchWorker, by lane and outcome (ok, failed). */
  ingestBatchProcessDuration: metrics.createHistogram("ingest.batch.process.duration", {
    unit: "ms",
    description: "Time to process one queued batch into its tables, by lane and outcome",
  }),
  /** Rows processed out of the durable queue, by lane and outcome. */
  ingestRowsProcessed: metrics.createCounter("ingest.rows.processed", {
    description: "Rows processed from the durable ingest queue, by lane and outcome",
  }),

  // ── Background jobs (app/scheduler.ts) ──
  /** One scheduled job run, by job and outcome (ok, failed). */
  jobDuration: metrics.createHistogram("job.duration", {
    unit: "ms",
    description: "Time each scheduled job took, by job and outcome",
  }),
  /** Rows the retention sweep deleted, by what was deleted. */
  retentionRowsDeleted: metrics.createCounter("retention.rows.deleted", {
    description: "Rows deleted by the data retention sweep, by kind",
  }),
};

/**
 * Rows waiting in the ingest buffer, per lane, read when metrics are exported. Called
 * once by whoever owns the buffer; a gauge rather than a counter because the backlog,
 * not the throughput, is what shows a flush falling behind.
 */
export function observeIngestBacklog(depth: () => Record<string, number>): void {
  if (!observeEnabled) return;
  metrics.createObservableGauge("ingest.buffer.rows", { description: "Rows waiting in the ingest buffer, by lane" })
    .addCallback((r) => {
      for (const [lane, rows] of Object.entries(depth())) r.observe(rows, { lane });
    });
}

/**
 * A background job as its own trace: one span, its duration in `job.duration`, and
 * failures marked on both. The job's own result or error passes through untouched.
 */
export async function traceJob<T>(job: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const done = (outcome: "ok" | "failed") => coreMetrics.jobDuration.record(performance.now() - started, { job, outcome });
  if (!observeEnabled) {
    try {
      const result = await run();
      done("ok");
      return result;
    } catch (e) {
      done("failed");
      throw e;
    }
  }
  return tracer.startActiveSpan(`job ${job}`, { kind: SpanKind.INTERNAL }, async (span) => {
    span.setAttribute("job.name", job);
    try {
      const result = await run();
      done("ok");
      return result;
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
      done("failed");
      throw e;
    } finally {
      span.end();
    }
  });
}

if (observeEnabled) {
  metrics.createObservableGauge("process.memory.rss", { unit: "By", description: "Resident memory of the process" })
    .addCallback((r) => r.observe(process.memoryUsage().rss));
  metrics.createObservableGauge("process.memory.heap_used", { unit: "By", description: "JavaScript heap in use" })
    .addCallback((r) => r.observe(process.memoryUsage().heapUsed));
  metrics.createObservableCounter("process.cpu.time", { unit: "s", description: "CPU time used by the process" })
    .addCallback((r) => {
      const { user, system } = process.cpuUsage();
      r.observe((user + system) / 1e6);
    });
}

const statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

/**
 * A server span per request, continuing the gateway's trace from its `traceparent`,
 * and every request's duration in `http.server.request.duration`.
 */
export function requestSpans(): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (!observeEnabled || path === "/health") return next();
    const started = performance.now();
    const route = spanPath(path);
    const measure = (status: number) =>
      requestDuration.record(performance.now() - started, { "http.route": route, "http.request.method": c.req.method, "http.status_class": statusClass(status) });
    if (isTracker(path)) {
      try {
        await next();
      } finally {
        measure(c.res?.status ?? 500);
      }
      return;
    }
    const parent = propagation.extract(context.active(), Object.fromEntries(c.req.raw.headers));
    return context.with(parent, () =>
      tracer.startActiveSpan(`${c.req.method} ${spanPath(path)}`, { kind: SpanKind.SERVER }, async (span) => {
        span.setAttribute("http.request.method", c.req.method);
        span.setAttribute("url.path", path);
        try {
          await next();
          span.setAttribute("http.response.status_code", c.res.status);
          if (c.res.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        } catch (e) {
          span.recordException(e as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) });
          throw e;
        } finally {
          span.end();
          measure(c.res?.status ?? 500);
        }
      }),
    );
  };
}

/** Sends what is buffered; for the process's own shutdown handler. */
export const shutdownObserve = (): Promise<void> => (observeEnabled ? shutdown() : Promise.resolve());
