import { validateWebhookUrl } from "../../../platform/http/origin";
import { assertPublicHost } from "../../../platform/http/public-host";
import type { HttpRequest, HttpResponse, Outcome, ProviderContext } from "../interfaces";

export const REQUEST_TIMEOUT_MS = 10_000;
/** Responses are read for an error message only; nothing legitimate here is large. */
const MAX_RESPONSE_CHARS = 2_000;

/** A request that could not complete — DNS, connection, timeout. Always retryable. */
export class TransportError extends Error {}

/**
 * The production `ProviderContext`.
 *
 * Redirects are reported, not followed: a 3xx could carry the request, its body and its
 * authorisation header to a host nobody checked. The timeout covers the whole exchange.
 */
export function createProviderContext(fetchImpl: typeof fetch = fetch, timeoutMs: number = REQUEST_TIMEOUT_MS): ProviderContext {
  return {
    async request(req: HttpRequest): Promise<HttpResponse> {
      try {
        const res = await fetchImpl(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        return { status: res.status, text: (await res.text()).slice(0, MAX_RESPONSE_CHARS) };
      } catch (err) {
        throw new TransportError(err instanceof Error && err.name === "TimeoutError" ? "request timed out" : "could not reach the service");
      }
    },

    async assertPublicUrl(url: string): Promise<void> {
      if (!validateWebhookUrl(url)) throw new TransportError("URL must be https and not point at an internal address");
      try {
        await assertPublicHost(new URL(url).hostname);
      } catch {
        throw new TransportError("URL resolves to a non-public address");
      }
    },
  };
}

/**
 * Turn an HTTP status into the outcome the delivery service understands.
 *
 * 2xx is success. 401/403 mean the credential was refused — worth switching the connection
 * off for. 408, 429 and 5xx are the service's trouble and may pass. Every other status,
 * including a redirect we did not follow, is a request that will not succeed by repeating it.
 */
export function outcomeFromStatus(status: number, text: string, okStatuses: readonly number[] = []): Outcome {
  if (okStatuses.length ? okStatuses.includes(status) : status >= 200 && status < 300) {
    return { kind: "ok", httpStatus: status };
  }
  const detail = errorDetail(text);
  const message = `HTTP ${status}${detail ? `: ${detail}` : ""}`;
  if (status === 401 || status === 403) return { kind: "failed", retryable: false, auth: true, httpStatus: status, message };
  if (status === 408 || status === 429 || status >= 500) return { kind: "failed", retryable: true, httpStatus: status, message };
  if (status >= 300 && status < 400) return { kind: "failed", retryable: false, httpStatus: status, message: `HTTP ${status}: redirect not followed` };
  return { kind: "failed", retryable: false, httpStatus: status, message };
}

/** A short, single-line reason from a JSON error body, or the start of whatever it said. */
function errorDetail(text: string): string {
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const errors = body.errors as Array<{ detail?: string }> | undefined;
    const pick = body.detail ?? body.message ?? body.title ?? errors?.[0]?.detail;
    if (typeof pick === "string") return pick.replace(/\s+/g, " ").slice(0, 200);
  } catch { /* not JSON */ }
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}
