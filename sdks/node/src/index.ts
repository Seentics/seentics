import type { SeenticsConfig, LogEntry, ErrorEvent, SpanData, MetricPoint, MetricType, LogLevel } from './types';
import { FlushBuffer } from './buffer';
import { Span, newSpanId } from './span';

export type { SeenticsConfig, LogEntry, ErrorEvent, SpanData, MetricPoint, MetricType, LogLevel };
export type { SpanStatus } from './types';
export { Span } from './span';

const DEFAULT_BASE_URL    = 'https://api.seentics.io';
const DEFAULT_INTERVAL    = 5_000;
const DEFAULT_MAX_SIZE    = 100;

export class Seentics {
  private readonly cfg: Required<SeenticsConfig>;
  private readonly logBuf:    FlushBuffer<LogEntry>;
  private readonly errorBuf:  FlushBuffer<ErrorEvent>;
  private readonly spanBuf:   FlushBuffer<SpanData>;
  private readonly metricBuf: FlushBuffer<MetricPoint>;

  /** Structured log helpers: seentics.log.info('msg', { key: 'value' }) */
  readonly log: {
    debug: (msg: string, attrs?: Record<string, string>) => void;
    info:  (msg: string, attrs?: Record<string, string>) => void;
    warn:  (msg: string, attrs?: Record<string, string>) => void;
    error: (msg: string, attrs?: Record<string, string>) => void;
    fatal: (msg: string, attrs?: Record<string, string>) => void;
  };

  constructor(config: SeenticsConfig) {
    this.cfg = {
      baseUrl:       config.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE_URL,
      environment:   config.environment ?? '',
      flushInterval: config.flushInterval ?? DEFAULT_INTERVAL,
      flushMaxSize:  config.flushMaxSize  ?? DEFAULT_MAX_SIZE,
      ...config,
    };

    const post = <T>(path: string, key: string) =>
      (items: T[]) => this._post(path, { [key]: items });

    this.logBuf    = new FlushBuffer(post<LogEntry>   ('/api/v1/observability/logs/ingest',    'logs'),    this.cfg.flushMaxSize, this.cfg.flushInterval);
    this.errorBuf  = new FlushBuffer(post<ErrorEvent> ('/api/v1/observability/errors/ingest',  'errors'),  this.cfg.flushMaxSize, this.cfg.flushInterval);
    this.spanBuf   = new FlushBuffer(post<SpanData>   ('/api/v1/observability/traces/ingest',  'spans'),   this.cfg.flushMaxSize, this.cfg.flushInterval);
    this.metricBuf = new FlushBuffer(post<MetricPoint>('/api/v1/observability/metrics/ingest', 'metrics'), this.cfg.flushMaxSize, this.cfg.flushInterval);

    const self = this;
    this.log = {
      debug: (msg, attrs) => self._pushLog('debug', msg, attrs),
      info:  (msg, attrs) => self._pushLog('info',  msg, attrs),
      warn:  (msg, attrs) => self._pushLog('warn',  msg, attrs),
      error: (msg, attrs) => self._pushLog('error', msg, attrs),
      fatal: (msg, attrs) => self._pushLog('fatal', msg, attrs),
    };
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  private _pushLog(level: LogLevel, message: string, attrs?: Record<string, string>): void {
    this.logBuf.add({
      project_id:   this.cfg.projectId,
      service:      this.cfg.service,
      environment:  this.cfg.environment || undefined,
      level,
      message,
      attributes:   attrs,
    });
  }

  // ── Errors ────────────────────────────────────────────────────────────────

  /**
   * Capture an exception. The stack trace is extracted automatically.
   *
   * @example
   * try { ... } catch (err) { seentics.captureError(err) }
   */
  captureError(
    err: unknown,
    context?: {
      userId?:     string;
      release?:    string;
      traceId?:    string;
      attributes?: Record<string, string>;
    },
  ): void {
    const e = err instanceof Error ? err : new Error(String(err));
    this.errorBuf.add({
      project_id:   this.cfg.projectId,
      service:      this.cfg.service,
      environment:  this.cfg.environment || undefined,
      error_type:   e.constructor.name,
      message:      e.message,
      stack_trace:  e.stack,
      user_id:      context?.userId,
      release:      context?.release,
      attributes: {
        ...(context?.traceId ? { trace_id: context.traceId } : {}),
        ...(context?.attributes ?? {}),
      } || undefined,
    });
  }

  // ── Tracing ───────────────────────────────────────────────────────────────

  /**
   * Start a new root span (new trace).
   *
   * @example
   * const span = seentics.startSpan('process-order')
   * try { ... } catch (err) { span.recordError(err) } finally { span.end() }
   */
  startSpan(
    operation: string,
    opts?: {
      traceId?:      string;
      parentSpanId?: string;
      attributes?:   Record<string, string>;
    },
  ): Span {
    const span = new Span(
      data => this.spanBuf.add(data),
      this.cfg.projectId,
      this.cfg.service,
      operation,
      opts?.traceId,
      opts?.parentSpanId,
    );
    if (opts?.attributes) span.setAttributes(opts.attributes);
    return span;
  }

  /**
   * Start a child span under an existing span (same trace).
   *
   * @example
   * const child = seentics.startChildSpan(parentSpan, 'query-db')
   */
  startChildSpan(parent: Span, operation: string, attrs?: Record<string, string>): Span {
    return this.startSpan(operation, {
      traceId:      parent.traceId,
      parentSpanId: parent.spanId,
      attributes:   attrs,
    });
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this._pushMetric('gauge', name, value, labels);
  }

  counter(name: string, value: number, labels?: Record<string, string>): void {
    this._pushMetric('counter', name, value, labels);
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this._pushMetric('histogram', name, value, labels);
  }

  private _pushMetric(type: MetricType, name: string, value: number, labels?: Record<string, string>): void {
    this.metricBuf.add({
      project_id: this.cfg.projectId,
      service:    this.cfg.service,
      name,
      type,
      value,
      labels,
    });
  }

  // ── Middleware ────────────────────────────────────────────────────────────

  /**
   * Express / Fastify request-tracing middleware.
   * Adds one span per request; attaches `req.seenticsSpan` for downstream use.
   *
   * @example
   * app.use(seentics.requestMiddleware())
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestMiddleware(): (req: any, res: any, next: any) => void {
    return (req, res, next) => {
      const span = this.startSpan(`${String(req.method)} ${String(req.path ?? req.url)}`);
      res.on('finish', () => {
        const code: number = res.statusCode;
        if (code >= 500) span.setStatus('error', `HTTP ${code}`);
        else span.setStatus('ok');
        span.setAttribute('http.method',      String(req.method  ?? ''));
        span.setAttribute('http.status_code', String(code));
        span.setAttribute('http.path',        String(req.path ?? req.url ?? ''));
        span.end();
      });
      req.seenticsSpan = span;
      next();
    };
  }

  /**
   * Express error-handler middleware. Mount *after* all routes.
   * Captures 5xx errors and calls next(err) to continue the chain.
   *
   * @example
   * app.use(seentics.errorMiddleware())
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorMiddleware(): (err: any, req: any, res: any, next: any) => void {
    return (err, req, res, next) => {
      this.captureError(err, {
        traceId: (req.seenticsSpan as Span | undefined)?.traceId,
        attributes: {
          method: String(req.method ?? ''),
          path:   String(req.path ?? req.url ?? ''),
          status: String(res.statusCode ?? ''),
        },
      });
      next(err);
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Flush all buffered data to the API immediately. */
  async flush(): Promise<void> {
    await Promise.all([
      this.logBuf.flush(),
      this.errorBuf.flush(),
      this.spanBuf.flush(),
      this.metricBuf.flush(),
    ]);
  }

  /**
   * Flush all buffers and stop background timers.
   * Call in your process shutdown handler.
   *
   * @example
   * process.on('SIGTERM', async () => { await seentics.close(); process.exit(0) })
   */
  async close(): Promise<void> {
    this.logBuf.stop();
    this.errorBuf.stop();
    this.spanBuf.stop();
    this.metricBuf.stop();
    await this.flush();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async _post(path: string, body: unknown): Promise<void> {
    await fetch(`${this.cfg.baseUrl}${path}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  }
}
