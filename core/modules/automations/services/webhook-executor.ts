/**
 * Async webhook executor with exponential back-off retry and delivery logging.
 */

import { db, webhookDeliveries } from '../../db';
import { log } from '../logger';
import { validateWebhookUrl } from '../origin';
import { renderTemplateDeep } from './template-engine';

export interface WebhookAction {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function executeWebhook(
  automationId: string,
  action: WebhookAction,
  context: Record<string, unknown>,
  runId?: string,
): Promise<void> {
  const url     = String(action.url ?? '');
  const method  = (action.method ?? 'POST').toUpperCase();
  const headers = (action.headers ?? {}) as Record<string, string>;
  const rawBody = action.body ?? {};

  if (!validateWebhookUrl(url)) {
    log.warn({ msg: 'webhook_blocked_ssrf', automationId, url });
    try {
      await db.insert(webhookDeliveries).values({
        automationId,
        runId: runId ?? null,
        url,
        statusCode: null,
        success: false,
        attemptCount: 0,
        lastAttemptAt: new Date(),
        responseMs: 0,
        error: 'URL blocked: failed SSRF validation',
      });
    } catch { /* best-effort log */ }
    return;
  }

  const renderedBody = renderTemplateDeep(rawBody, context);
  const payload = JSON.stringify({ ...renderedBody as object, _automation_id: automationId, _ts: Date.now() });

  let lastCode: number | null = null;
  let lastError: string | null = null;
  let success = false;
  let responseMs = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
      responseMs  = Date.now() - start;
      lastCode    = res.status;
      success     = res.ok;
      lastError   = res.ok ? null : `HTTP ${res.status}`;
      if (res.ok) break;
    } catch (err) {
      responseMs = Date.now() - start;
      lastError  = err instanceof Error ? err.message : String(err);
      lastCode   = null;
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  try {
    await db.insert(webhookDeliveries).values({
      automationId,
      runId: runId ?? null,
      url,
      statusCode: lastCode,
      success,
      attemptCount: MAX_ATTEMPTS,
      lastAttemptAt: new Date(),
      responseMs,
      error: lastError,
    });
  } catch (err) {
    log.warn({ msg: 'webhook_delivery_log_failed', automationId, err });
  }

  if (!success) {
    log.warn({ msg: 'webhook_failed', automationId, url, lastCode, lastError });
  }
}
