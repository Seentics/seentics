import type { SpanData, SpanStatus } from './types';

function randomHex(bytes: number): string {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }
  // Node < 19 fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto') as typeof import('crypto');
  return nodeCrypto.randomBytes(bytes).toString('hex');
}

export function newTraceId(): string { return randomHex(16); }
export function newSpanId():  string { return randomHex(8);  }

export class Span {
  readonly traceId:      string;
  readonly spanId:       string;
  readonly parentSpanId: string | undefined;

  private readonly startMs: number;
  private _status: SpanStatus = 'unset';
  private _errorMessage?: string;
  private _attrs: Record<string, string> = {};
  private _ended = false;

  constructor(
    private readonly onEnd:     (data: SpanData) => void,
    private readonly projectId: string,
    private readonly service:   string,
    private readonly operation: string,
    traceId?:      string,
    parentSpanId?: string,
  ) {
    this.traceId      = traceId ?? newTraceId();
    this.spanId       = newSpanId();
    this.parentSpanId = parentSpanId;
    this.startMs      = Date.now();
  }

  setAttribute(key: string, value: string): this {
    this._attrs[key] = value;
    return this;
  }

  setAttributes(attrs: Record<string, string>): this {
    Object.assign(this._attrs, attrs);
    return this;
  }

  setStatus(status: SpanStatus, errorMessage?: string): this {
    this._status = status;
    if (errorMessage !== undefined) this._errorMessage = errorMessage;
    return this;
  }

  recordError(err: unknown): this {
    this._status = 'error';
    this._errorMessage = err instanceof Error ? err.message : String(err);
    return this;
  }

  end(): void {
    if (this._ended) return;
    this._ended = true;
    const endMs = Date.now();
    this.onEnd({
      project_id:     this.projectId,
      trace_id:       this.traceId,
      span_id:        this.spanId,
      parent_span_id: this.parentSpanId,
      service:        this.service,
      operation:      this.operation,
      start_time:     new Date(this.startMs).toISOString(),
      end_time:       new Date(endMs).toISOString(),
      duration_ms:    endMs - this.startMs,
      status:         this._status === 'unset' ? 'ok' : this._status,
      error_message:  this._errorMessage,
      attributes:     Object.keys(this._attrs).length > 0 ? { ...this._attrs } : undefined,
    });
  }
}
